import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.ts";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required.");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

const barangay = await prisma.barangay.upsert({
  where: { barangayCode: "CEBU-PUNTA-PRINCESA" },
  update: { barangayName: "Punta Princesa", city: "Cebu City", province: "Cebu", isActive: true },
  create: {
    barangayCode: "CEBU-PUNTA-PRINCESA",
    barangayName: "Punta Princesa",
    city: "Cebu City",
    province: "Cebu",
  },
});

const program = await prisma.program.upsert({
  where: { programCode: "4PS" },
  update: {
    programName: "Pantawid Pamilyang Pilipino Program",
    programType: "Conditional cash transfer",
    description: "National poverty reduction and human development program.",
    grantAmount: "1500.00",
    isActive: true,
  },
  create: {
    programCode: "4PS",
    programName: "Pantawid Pamilyang Pilipino Program",
    programType: "Conditional cash transfer",
    description: "National poverty reduction and human development program.",
    grantAmount: "1500.00",
  },
});

const beneficiary = await prisma.beneficiary.upsert({
  where: { contactNumber: "+639175550147" },
  update: { isVerified: true, status: "active" },
  create: {
    firstName: "Maria",
    middleName: null,
    lastName: "Santos",
    birthDate: new Date("1988-04-18T00:00:00.000Z"),
    sex: "female",
    address: "123 Mabini Street",
    barangayId: barangay.barangayId,
    contactNumber: "+639175550147",
    isVerified: true,
    status: "active",
  },
});

await prisma.enrollment.upsert({
  where: {
    beneficiaryId_programId: {
      beneficiaryId: beneficiary.beneficiaryId,
      programId: program.programId,
    },
  },
  update: { status: "approved" },
  create: {
    beneficiaryId: beneficiary.beneficiaryId,
    programId: program.programId,
    enrollmentDate: new Date("2026-09-10T00:00:00.000Z"),
    status: "approved",
  },
});

const distributionDate = new Date("2026-10-02T00:00:00.000Z");
const distribution = await prisma.distribution.upsert({
  where: {
    programId_distributionDate_location: {
      programId: program.programId,
      distributionDate,
      location: "Barangay Punta Princesa Hall",
    },
  },
  update: { title: "October 2026 4Ps Distribution", status: "scheduled" },
  create: {
    programId: program.programId,
    title: "October 2026 4Ps Distribution",
    distributionDate,
    location: "Barangay Punta Princesa Hall",
    status: "scheduled",
  },
});

await prisma.schedule.upsert({
  where: {
    distributionId_beneficiaryId: {
      distributionId: distribution.distributionId,
      beneficiaryId: beneficiary.beneficiaryId,
    },
  },
  update: {
    slotStart: new Date("2026-10-02T01:00:00.000Z"),
    slotEnd: new Date("2026-10-02T02:00:00.000Z"),
    queueNumber: 47,
    status: "scheduled",
  },
  create: {
    distributionId: distribution.distributionId,
    beneficiaryId: beneficiary.beneficiaryId,
    slotStart: new Date("2026-10-02T01:00:00.000Z"),
    slotEnd: new Date("2026-10-02T02:00:00.000Z"),
    queueNumber: 47,
    status: "scheduled",
  },
});

const pastDistributionDate = new Date("2026-08-28T00:00:00.000Z");
const pastDistribution = await prisma.distribution.upsert({
  where: {
    programId_distributionDate_location: {
      programId: program.programId,
      distributionDate: pastDistributionDate,
      location: "Barangay Punta Princesa Hall",
    },
  },
  update: { title: "August 2026 4Ps Distribution", status: "completed" },
  create: {
    programId: program.programId,
    title: "August 2026 4Ps Distribution",
    distributionDate: pastDistributionDate,
    location: "Barangay Punta Princesa Hall",
    status: "completed",
  },
});

const pastSchedule = await prisma.schedule.upsert({
  where: {
    distributionId_beneficiaryId: {
      distributionId: pastDistribution.distributionId,
      beneficiaryId: beneficiary.beneficiaryId,
    },
  },
  update: {
    slotStart: new Date("2026-08-28T01:00:00.000Z"),
    slotEnd: new Date("2026-08-28T02:00:00.000Z"),
    queueNumber: 32,
    status: "claimed",
  },
  create: {
    distributionId: pastDistribution.distributionId,
    beneficiaryId: beneficiary.beneficiaryId,
    slotStart: new Date("2026-08-28T01:00:00.000Z"),
    slotEnd: new Date("2026-08-28T02:00:00.000Z"),
    queueNumber: 32,
    status: "claimed",
  },
});

const claimedAt = new Date("2026-08-28T01:42:00.000Z");
const claim = await prisma.claim.upsert({
  where: {
    beneficiaryId_distributionId: {
      beneficiaryId: beneficiary.beneficiaryId,
      distributionId: pastDistribution.distributionId,
    },
  },
  update: {
    scheduleId: pastSchedule.scheduleId,
    claimStatus: "completed",
    verificationMethod: "qr",
    qrVerified: true,
    isDuplicateFlag: false,
    claimedAt,
  },
  create: {
    beneficiaryId: beneficiary.beneficiaryId,
    distributionId: pastDistribution.distributionId,
    scheduleId: pastSchedule.scheduleId,
    claimStatus: "completed",
    verificationMethod: "qr",
    qrVerified: true,
    claimedAt,
    createdAt: claimedAt,
  },
});

const wallet = await prisma.walletAccount.upsert({
  where: { beneficiaryId: beneficiary.beneficiaryId },
  update: { balance: "1500.00", currency: "PHP", accountStatus: "active", lastTransactionAt: claimedAt },
  create: {
    beneficiaryId: beneficiary.beneficiaryId,
    balance: "1500.00",
    currency: "PHP",
    accountStatus: "active",
    lastTransactionAt: claimedAt,
  },
});

await prisma.transaction.upsert({
  where: { referenceNo: "GAI-2026-0828-032" },
  update: {
    claimId: claim.claimId,
    walletId: wallet.walletId,
    beneficiaryId: beneficiary.beneficiaryId,
    amount: "1500.00",
    transactionType: "assistance_credit",
    status: "posted",
    createdAt: claimedAt,
  },
  create: {
    claimId: claim.claimId,
    walletId: wallet.walletId,
    beneficiaryId: beneficiary.beneficiaryId,
    amount: "1500.00",
    transactionType: "assistance_credit",
    referenceNo: "GAI-2026-0828-032",
    status: "posted",
    createdAt: claimedAt,
  },
});

await prisma.$disconnect();
console.info("Seeded the mobile beneficiary, schedule, completed claim, and wallet history.");
