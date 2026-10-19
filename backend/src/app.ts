import express, { type Request } from "express";
import { config } from "./config.ts";
import { prisma } from "./db.ts";
import { ApiError } from "./errors.ts";
import { createOtp, createQrToken, createSessionToken, hashSecret, secretMatches } from "./security.ts";
import { parseOtpRequest, parseOtpVerification, parseRegistration } from "./validation.ts";

const OTP_LIFETIME_MS = 5 * 60 * 1000;
const OTP_RESEND_WAIT_MS = 60 * 1000;
const SESSION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

export const app = express();

app.disable("x-powered-by");
app.use(express.json({ limit: "32kb" }));
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && config.corsOrigins.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

function publicBeneficiary(beneficiary: {
  beneficiaryId: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  birthDate: Date;
  sex: string;
  address: string;
  barangayId: string;
  contactNumber: string;
  isVerified: boolean;
  status: string;
}) {
  return {
    id: beneficiary.beneficiaryId,
    firstName: beneficiary.firstName,
    middleName: beneficiary.middleName,
    lastName: beneficiary.lastName,
    birthDate: beneficiary.birthDate.toISOString().slice(0, 10),
    sex: beneficiary.sex,
    address: beneficiary.address,
    barangayId: beneficiary.barangayId,
    contactNumber: beneficiary.contactNumber,
    isVerified: beneficiary.isVerified,
    status: beneficiary.status,
  };
}

async function issueOtp(beneficiaryId: string, purpose: "register" | "login") {
  const recent = await prisma.otpChallenge.findFirst({
    where: {
      beneficiaryId,
      purpose,
      consumedAt: null,
      createdAt: { gte: new Date(Date.now() - OTP_RESEND_WAIT_MS) },
    },
    orderBy: { createdAt: "desc" },
  });
  if (recent) throw new ApiError(429, "OTP_TOO_SOON", "Wait one minute before requesting another code.");

  const code = createOtp();
  await prisma.$transaction([
    prisma.otpChallenge.updateMany({
      where: { beneficiaryId, purpose, consumedAt: null },
      data: { consumedAt: new Date() },
    }),
    prisma.otpChallenge.create({
      data: {
        beneficiaryId,
        purpose,
        codeHash: hashSecret(code, "otp", config.authPepper),
        expiresAt: new Date(Date.now() + OTP_LIFETIME_MS),
      },
    }),
  ]);

  if (config.nodeEnv !== "production") console.info(`[development OTP] ${code}`);
  return config.nodeEnv !== "production" ? code : undefined;
}

async function requireBeneficiary(req: Request) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) throw new ApiError(401, "UNAUTHORIZED", "A bearer token is required.");
  const token = header.slice(7).trim();
  if (!token) throw new ApiError(401, "UNAUTHORIZED", "A bearer token is required.");

  const session = await prisma.authSession.findUnique({
    where: { tokenHash: hashSecret(token, "session", config.authPepper) },
    include: { beneficiary: true },
  });
  if (!session || session.revokedAt || session.expiresAt <= new Date()) {
    throw new ApiError(401, "SESSION_EXPIRED", "Your session has expired. Please sign in again.");
  }
  return { session, beneficiary: session.beneficiary };
}

function findNextSchedule(beneficiaryId: string) {
  return prisma.schedule.findFirst({
    where: {
      beneficiaryId,
      slotEnd: { gte: new Date() },
      status: { in: ["scheduled", "rescheduled"] },
      distribution: { status: { not: "cancelled" } },
    },
    include: { distribution: { include: { program: true } } },
    orderBy: { slotStart: "asc" },
  });
}

app.get("/", (_req, res) => {
  res.json({ service: "Garantiy-Aid API", version: "0.1.0" });
});

app.get("/health", async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ status: "ok", database: "connected" });
});

app.get("/barangays", async (_req, res) => {
  const barangays = await prisma.barangay.findMany({
    where: { isActive: true },
    orderBy: [{ city: "asc" }, { barangayName: "asc" }],
    select: { barangayId: true, barangayCode: true, barangayName: true, city: true, province: true },
  });
  res.json({ data: barangays.map(({ barangayId, ...item }) => ({ id: barangayId, ...item })) });
});

app.post("/auth/register", async (req, res) => {
  const input = parseRegistration(req.body);
  const barangay = await prisma.barangay.findFirst({ where: { barangayId: input.barangayId, isActive: true } });
  if (!barangay) throw new ApiError(422, "INVALID_BARANGAY", "Select an active barangay.");

  const existing = await prisma.beneficiary.findUnique({ where: { contactNumber: input.contactNumber } });
  if (existing) throw new ApiError(409, "PHONE_ALREADY_REGISTERED", "This mobile number already has an account.");

  const beneficiary = await prisma.beneficiary.create({ data: input });
  const developmentOtp = await issueOtp(beneficiary.beneficiaryId, "register");
  res.status(201).json({
    data: {
      beneficiary: publicBeneficiary(beneficiary),
      verificationRequired: true,
      ...(developmentOtp ? { developmentOtp } : {}),
    },
  });
});

app.post("/auth/otp/request", async (req, res) => {
  const { contactNumber, purpose } = parseOtpRequest(req.body);
  const beneficiary = await prisma.beneficiary.findUnique({ where: { contactNumber } });
  if (!beneficiary) throw new ApiError(404, "ACCOUNT_NOT_FOUND", "No account uses this mobile number.");
  if (purpose === "login" && !beneficiary.isVerified) {
    throw new ApiError(403, "ACCOUNT_NOT_VERIFIED", "Verify this account before signing in.");
  }
  if (purpose === "register" && beneficiary.isVerified) {
    throw new ApiError(409, "ACCOUNT_ALREADY_VERIFIED", "This account is already verified. Sign in instead.");
  }

  const developmentOtp = await issueOtp(beneficiary.beneficiaryId, purpose);
  res.status(202).json({ data: { expiresInSeconds: OTP_LIFETIME_MS / 1000, ...(developmentOtp ? { developmentOtp } : {}) } });
});

app.post("/auth/otp/verify", async (req, res) => {
  const { contactNumber, purpose, code } = parseOtpVerification(req.body);
  const beneficiary = await prisma.beneficiary.findUnique({ where: { contactNumber } });
  if (!beneficiary) throw new ApiError(404, "ACCOUNT_NOT_FOUND", "No account uses this mobile number.");

  const challenge = await prisma.otpChallenge.findFirst({
    where: { beneficiaryId: beneficiary.beneficiaryId, purpose, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!challenge || challenge.expiresAt <= new Date()) {
    throw new ApiError(400, "OTP_EXPIRED", "This code has expired. Request a new one.");
  }
  if (challenge.attemptsRemaining <= 0) {
    throw new ApiError(429, "OTP_ATTEMPTS_EXCEEDED", "Request a new code and try again.");
  }
  if (!secretMatches(code, challenge.codeHash, "otp", config.authPepper)) {
    await prisma.otpChallenge.update({
      where: { challengeId: challenge.challengeId },
      data: { attemptsRemaining: { decrement: 1 } },
    });
    throw new ApiError(400, "OTP_INCORRECT", "The verification code is incorrect.");
  }

  const token = createSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS);
  const [, verifiedBeneficiary] = await prisma.$transaction([
    prisma.otpChallenge.update({ where: { challengeId: challenge.challengeId }, data: { consumedAt: new Date() } }),
    prisma.beneficiary.update({
      where: { beneficiaryId: beneficiary.beneficiaryId },
      data: purpose === "register" ? { isVerified: true, status: "active" } : {},
    }),
    prisma.authSession.create({
      data: {
        beneficiaryId: beneficiary.beneficiaryId,
        tokenHash: hashSecret(token, "session", config.authPepper),
        expiresAt,
      },
    }),
  ]);

  res.json({
    data: {
      accessToken: token,
      tokenType: "Bearer",
      expiresAt: expiresAt.toISOString(),
      beneficiary: publicBeneficiary(verifiedBeneficiary),
    },
  });
});

app.post("/auth/logout", async (req, res) => {
  const { session } = await requireBeneficiary(req);
  await prisma.authSession.update({ where: { sessionId: session.sessionId }, data: { revokedAt: new Date() } });
  res.sendStatus(204);
});

app.get("/beneficiaries/me", async (req, res) => {
  const { beneficiary } = await requireBeneficiary(req);
  res.json({ data: publicBeneficiary(beneficiary) });
});

app.get("/beneficiaries/me/overview", async (req, res) => {
  const { beneficiary } = await requireBeneficiary(req);
  const [enrollments, nextSchedule] = await Promise.all([
    prisma.enrollment.findMany({
      where: { beneficiaryId: beneficiary.beneficiaryId },
      include: { program: true },
      orderBy: { enrollmentDate: "desc" },
    }),
    findNextSchedule(beneficiary.beneficiaryId),
  ]);

  res.json({
    data: {
      enrollments: enrollments.map(({ program, ...enrollment }) => ({
        id: enrollment.enrollmentId,
        enrollmentDate: enrollment.enrollmentDate.toISOString().slice(0, 10),
        status: enrollment.status,
        program: {
          id: program.programId,
          code: program.programCode,
          name: program.programName,
          type: program.programType,
          description: program.description,
          grantAmount: Number(program.grantAmount),
        },
      })),
      nextSchedule: nextSchedule
        ? {
            id: nextSchedule.scheduleId,
            distributionId: nextSchedule.distributionId,
            title: nextSchedule.distribution.title,
            date: nextSchedule.distribution.distributionDate.toISOString().slice(0, 10),
            slotStart: nextSchedule.slotStart.toISOString(),
            slotEnd: nextSchedule.slotEnd.toISOString(),
            queueNumber: nextSchedule.queueNumber,
            location: nextSchedule.distribution.location,
            status: nextSchedule.status,
            program: {
              id: nextSchedule.distribution.program.programId,
              code: nextSchedule.distribution.program.programCode,
              name: nextSchedule.distribution.program.programName,
              grantAmount: Number(nextSchedule.distribution.program.grantAmount),
            },
          }
        : null,
    },
  });
});

app.get("/beneficiaries/me/wallet", async (req, res) => {
  const { beneficiary } = await requireBeneficiary(req);
  const [wallet, claims, nextSchedule] = await Promise.all([
    prisma.walletAccount.findUnique({
      where: { beneficiaryId: beneficiary.beneficiaryId },
      include: {
        transactions: {
          where: {
            beneficiaryId: beneficiary.beneficiaryId,
            claim: { beneficiaryId: beneficiary.beneficiaryId },
          },
          include: { claim: { include: { distribution: { include: { program: true } } } } },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    prisma.claim.findMany({
      where: { beneficiaryId: beneficiary.beneficiaryId },
      include: { distribution: { include: { program: true } } },
      orderBy: [{ claimedAt: "desc" }, { createdAt: "desc" }],
    }),
    findNextSchedule(beneficiary.beneficiaryId),
  ]);
  const currentRecord = nextSchedule
    ? claims.find((claim) => claim.distributionId === nextSchedule.distributionId)
    : undefined;
  const transactionsByClaimId = new Map(
    wallet?.transactions.map((transaction) => [transaction.claimId, transaction]) ?? [],
  );

  res.json({
    data: {
      wallet: wallet
        ? {
            id: wallet.walletId,
            balance: Number(wallet.balance),
            currency: wallet.currency,
            status: wallet.accountStatus,
            lastTransactionAt: wallet.lastTransactionAt?.toISOString() ?? null,
          }
        : null,
      currentClaim: nextSchedule
        ? {
            id: currentRecord?.claimId ?? null,
            distributionId: nextSchedule.distributionId,
            scheduleId: nextSchedule.scheduleId,
            status: currentRecord?.claimStatus ?? "not_claimed",
            verificationMethod: currentRecord?.verificationMethod ?? null,
            claimedAt: currentRecord?.claimedAt?.toISOString() ?? null,
            date: nextSchedule.distribution.distributionDate.toISOString().slice(0, 10),
            queueNumber: nextSchedule.queueNumber,
            location: nextSchedule.distribution.location,
            amount: Number(
              (currentRecord && transactionsByClaimId.get(currentRecord.claimId)?.amount) ??
                nextSchedule.distribution.program.grantAmount,
            ),
            program: {
              id: nextSchedule.distribution.program.programId,
              code: nextSchedule.distribution.program.programCode,
              name: nextSchedule.distribution.program.programName,
            },
          }
        : null,
      claims: claims.map((claim) => ({
        id: claim.claimId,
        distributionId: claim.distributionId,
        scheduleId: claim.scheduleId,
        status: claim.claimStatus,
        verificationMethod: claim.verificationMethod,
        claimedAt: claim.claimedAt?.toISOString() ?? null,
        createdAt: claim.createdAt.toISOString(),
        date: claim.distribution.distributionDate.toISOString().slice(0, 10),
        amount: Number(
          transactionsByClaimId.get(claim.claimId)?.amount ?? claim.distribution.program.grantAmount,
        ),
        program: {
          id: claim.distribution.program.programId,
          code: claim.distribution.program.programCode,
          name: claim.distribution.program.programName,
        },
      })),
      transactions:
        wallet?.transactions.map((transaction) => ({
          id: transaction.transactionId,
          claimId: transaction.claimId,
          amount: Number(transaction.amount),
          type: transaction.transactionType,
          reference: transaction.referenceNo,
          status: transaction.status,
          createdAt: transaction.createdAt.toISOString(),
          claimStatus: transaction.claim.claimStatus,
          claimedAt: transaction.claim.claimedAt?.toISOString() ?? null,
          date: transaction.claim.distribution.distributionDate.toISOString().slice(0, 10),
          program: {
            id: transaction.claim.distribution.program.programId,
            code: transaction.claim.distribution.program.programCode,
            name: transaction.claim.distribution.program.programName,
          },
        })) ?? [],
    },
  });
});

app.post("/beneficiaries/me/claim-pass", async (req, res) => {
  const { beneficiary } = await requireBeneficiary(req);
  const schedule = await findNextSchedule(beneficiary.beneficiaryId);
  if (!schedule) {
    throw new ApiError(404, "CLAIM_PASS_UNAVAILABLE", "No upcoming distribution is assigned to your account.");
  }

  const claimCode = createQrToken();
  const [, pass] = await prisma.$transaction([
    prisma.qrToken.updateMany({
      where: {
        beneficiaryId: beneficiary.beneficiaryId,
        distributionId: schedule.distributionId,
        qrStatus: "active",
      },
      data: { qrStatus: "revoked" },
    }),
    prisma.qrToken.create({
      data: {
        beneficiaryId: beneficiary.beneficiaryId,
        distributionId: schedule.distributionId,
        tokenHash: hashSecret(claimCode, "qr", config.authPepper),
        expiresAt: schedule.slotEnd,
      },
    }),
  ]);

  res.status(201).json({
    data: {
      id: pass.qrTokenId,
      claimCode,
      status: pass.qrStatus,
      issuedAt: pass.createdAt.toISOString(),
      expiresAt: pass.expiresAt.toISOString(),
      schedule: {
        id: schedule.scheduleId,
        distributionId: schedule.distributionId,
        date: schedule.distribution.distributionDate.toISOString().slice(0, 10),
        slotStart: schedule.slotStart.toISOString(),
        slotEnd: schedule.slotEnd.toISOString(),
        queueNumber: schedule.queueNumber,
        location: schedule.distribution.location,
        program: {
          id: schedule.distribution.program.programId,
          code: schedule.distribution.program.programCode,
          name: schedule.distribution.program.programName,
        },
      },
    },
  });
});

app.use((_req, _res, next) => next(new ApiError(404, "NOT_FOUND", "Endpoint not found.")));

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof ApiError) {
    return res.status(error.status).json({ error: { code: error.code, message: error.message, fields: error.fields } });
  }
  if (typeof error === "object" && error && "code" in error && error.code === "P2002") {
    return res.status(409).json({ error: { code: "DUPLICATE_VALUE", message: "That value is already in use." } });
  }
  console.error(error);
  res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Something went wrong." } });
});
