# Garantiy-Aid backend

This is the real-data API for the beneficiary mobile app. It implements account access, the signed-in beneficiary profile, program enrollments, the next assigned distribution schedule, scoped QR claim-pass issuance, and read-only claim and assistance-ledger history. Data is stored in PostgreSQL through Prisma.

## Run locally

Run these commands from `backend/`. Keep an existing configured `.env`; create it from the example only on a first setup.

1. Install the packages, prepare the environment file, and start Prisma's local PostgreSQL server:

```powershell
npm install
if (!(Test-Path .env)) { Copy-Item .env.example .env }
npm run db:local
```

2. In `.env`, set `DATABASE_URL` to the **direct `postgres://` URL** printed by `db:local`, rather than its `prisma+postgres://` URL. The driver in this project connects directly to PostgreSQL. On a first setup, replace the example `AUTH_PEPPER` with a random secret of at least 32 characters; preserve an existing configured secret.

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

3. Generate the Prisma client, apply the included migrations, seed local example records, and start the API:

```powershell
npm run db:generate
npm run db:deploy
npm run db:seed
npm run dev
```

The seed is for local testing and resets its example records to the values in `src/seed.ts`. Keep `CORS_ORIGINS=http://localhost:8765,http://127.0.0.1:8765` when using the documented browser preview. Do not commit the private `.env` file.

The API listens at `http://localhost:3000`. `GET /health` confirms that PostgreSQL is connected. The seed creates the verified mobile test account `0917 555 0147` with an approved 4Ps enrollment, a schedule dated October 2, 2026, and one completed claim with a posted PHP 1,500 assistance entry. The schedule has expired as of October 19, 2026, so the account correctly has no upcoming schedule or available QR pass. The fixed seed does not advance dates automatically.

During development, OTP codes are printed in the backend terminal and returned as `developmentOtp` in the response. Production never returns or logs the code; an SMS provider must be connected before production use.

## Implemented endpoints

- `GET /health`
- `GET /barangays`
- `POST /auth/register`
- `POST /auth/otp/request`
- `POST /auth/otp/verify`
- `POST /auth/logout`
- `GET /beneficiaries/me`
- `GET /beneficiaries/me/overview`
- `GET /beneficiaries/me/wallet`
- `POST /beneficiaries/me/claim-pass`

Protected endpoints use `Authorization: Bearer <accessToken>`. Access tokens are random, stored only as hashes, expire after seven days, and are revoked by logout.

Claim passes are opaque, distribution-scoped values returned only when issued. PostgreSQL stores a keyed hash rather than the raw QR value. Issuing a replacement revokes the previous active pass, and each pass expires at the end of its assigned schedule. Staff-side scanning and claim approval remain separate work.

`GET /beneficiaries/me/wallet` returns the signed-in beneficiary's wallet-account summary, current scheduled claim status, claim history, and posted transaction receipts. The wallet is an assistance ledger for recorded distributions; it does not hold funds or initiate transfers. Mobile access is read-only. A later staff workflow must verify a claim and create its claim and transaction records together in one atomic database operation.
