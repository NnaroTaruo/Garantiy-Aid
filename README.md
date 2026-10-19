# GarantiyAid

GarantiyAid is a capstone prototype for beneficiary registration, phone OTP authentication, distribution scheduling, secure QR claim passes, and saved claim and assistance records.

## Projects

- [`mobile/`](mobile/README.md) — React Native and Expo beneficiary app based on the supplied Figma design.
- [`backend/`](backend/README.md) — Express, Prisma, and PostgreSQL REST API.

Registration, generated OTP verification, persistent sessions, profile loading and editing, program enrollments, assigned schedules, QR pass issuance, read-only claim and wallet history, and in-app notifications use the backend database. Biometrics and SMS/push delivery remain previews. Staff scanning, claim approval, and notification creation still need integration with the team's web workflow. The wallet records assistance; it does not hold or transfer funds.

The latest update connects **Profile > Enrollment documents** to private uploads and saved document records. PDF, JPEG, and PNG files up to 5 MB are accepted, with file-type checks, safe retries, account isolation, and received status. Profile edits, the notification inbox, and read state also persist across logout/login. Receiving a document does not approve enrollment; staff review remains separate.

Read the [October 19 PDF progress guide](output/pdf/GarantiyAid-Mobile-Update-and-Completed-Tasks.pdf) or its [editable source](mobile/docs/app-update-and-testing-guide.md) for the earlier progress snapshot and local setup. The READMEs cover the newer notification, profile-editing, and document-upload milestones.

If the PDF preview does not open, use the [direct PDF download](https://raw.githubusercontent.com/NnaroTaruo/Garantiy-Aid/main/output/pdf/GarantiyAid-Mobile-Update-and-Completed-Tasks.pdf).

## Local development

Open the repository folder in VS Code. These commands use PowerShell and assume Node.js and npm are installed. Keep the API and mobile preview running in separate terminals.

### 1. Install the backend and start local PostgreSQL

```powershell
cd backend
npm install
if (!(Test-Path .env)) { Copy-Item .env.example .env }
npm run db:local
```

Edit `backend/.env` before continuing:

- Set `DATABASE_URL` to the **direct `postgres://` connection string** printed by `db:local`. This project uses the PostgreSQL driver, so choose that URL rather than the `prisma+postgres://` URL. The printed port can differ from the example `.env` file.
- On a first setup, replace the example `AUTH_PEPPER` with a random secret of at least 32 characters. Keep your existing configured value when returning to the project.
- Keep `CORS_ORIGINS` set to `http://localhost:8765,http://127.0.0.1:8765` for the browser commands below.

To generate an authentication secret locally, run this command and copy the result into `AUTH_PEPPER`:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Apply the database setup and start the API

In the backend terminal:

```powershell
npm run db:generate
npm run db:deploy
npm run db:seed
npm run dev
```

The seed creates fictional local test records and resets them to their fixed example values. Its October 2, 2026 schedule has expired; see the [backend notes](backend/README.md) for the test account and expected results.

Open [the API health endpoint](http://127.0.0.1:3000/health). Expect `status: ok` and `database: connected`. Leave the API terminal open.

### 3. Configure the mobile browser preview

Open another terminal at the repository root:

```powershell
cd mobile
npm install
if (!(Test-Path .env)) { Copy-Item .env.example .env }
```

Set `EXPO_PUBLIC_API_URL=http://127.0.0.1:3000` in `mobile/.env`, then start Expo:

```powershell
npm run web -- --port 8765
```

Open [the browser preview](http://127.0.0.1:8765). Restart Expo after changing the API URL. See the [mobile instructions](mobile/README.md) for emulator and physical-phone addresses.

The private `.env` files are ignored by Git; commit `.env.example` when sharing configuration examples.

## Checks

Run `npm test` and `npm run typecheck` from both `backend/` and `mobile/`. From `mobile/`, also run `npm run export:web` and `npm run export:android` to check the browser and Android bundles. Android export checks compilation; a physical-device walkthrough is still required.
