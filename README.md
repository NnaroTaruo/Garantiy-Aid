# GarantiyAid

GarantiyAid is a capstone prototype for beneficiary registration, phone OTP authentication, distribution scheduling, secure QR claim passes, and saved claim and assistance records.

## Projects

- [`mobile/`](mobile/README.md) — React Native and Expo beneficiary app based on the supplied Figma design.
- [`backend/`](backend/README.md) — Express, Prisma, and PostgreSQL REST API.

Registration, generated OTP verification, persistent sessions, profile loading and editing, program enrollments, assigned schedules, QR pass issuance, read-only claim and wallet history, and in-app notifications use the backend database. Shared biometric consent and staff enrollment status are saved; local face processing remains simulated. Real SMS/push delivery remains inactive. The milestones below describe staff integration. The wallet records assistance; it does not hold or transfer funds.

The document-upload milestone connects **Profile > Enrollment documents** to private uploads and saved document records. PDF, JPEG, and PNG files up to 5 MB are accepted, with file-type checks, safe retries, account isolation, and received status. Profile edits, the notification inbox, and read state also persist across logout/login. Receiving a document does not approve enrollment; staff review remains separate.

Shared staff-backend integration covers beneficiary registration, development OTP, sessions/logout, profiles, private documents with staff review/corrections, assigned enrollments/schedules, and QR passes. The local staff frontend and backend were updated to version 4.0 on November 9, 2026. The [integration guide](mobile/docs/shared-backend-integration.md) includes a consolidated version-4 backend patch, checks, and remaining gaps; earlier ordered patches are retained for version 3. The mobile integration changes have not been merged or deployed to the team's shared backend.

Home, Schedule, and Enrollment status now read the shared backend's assigned programs, enrollment decisions/feedback, and published schedules. Empty accounts show empty states; session dates/times and venues match staff assignments. Refresh actions load later staff changes.

Mobile-issued QR passes connect to the staff verifier. Eligible beneficiaries can reopen the same pass, refresh its status, and see expiry/revocation feedback. Staff-issued passes retain their separate delivery path. Required biometrics, staff claim verification and assistance release remain controlled by staff.

Phase 5 connects Wallet to shared claim status and physical-release history, including package/quantity, release time and receipt number. It also reads existing wallet summaries and claim-linked credit/reversal entries. Physical goods never become wallet credits, and an absent wallet remains absent. Apply `mobile-claims.patch` after `mobile-v4.patch`; see the integration guide.

Phase 6 connects the notification inbox, unread indicator and saved read status to the staff backend. New enrollment decisions, published schedules, completed claim verification, physical releases and simulated benefit credits/reversals produce controlled English/Bisaya in-app messages in the same transaction as the staff action. Apply `mobile-notifications.patch` after the claims patch, generate Prisma and deploy its additive notification migration. SMS/push delivery, preferences, full transfer history, recovery and biometric capture/matching remain pending. All backend patches await teammate review and deployment.

Phase 7 connects Recover account to the existing login-code verification flow and prepares an opt-in Semaphore SMS adapter. The team has no provider account yet, so local development still displays development codes and no real SMS delivery has been validated. The [SMS setup guide](mobile/docs/sms-setup.md) covers activation prerequisites, private backend configuration and the new mode/delivery safeguards. Apply `mobile-sms.patch` after the notification patch and deploy its additive migration. Live SMS activation, lost-number account linking, push/preferences, remaining record screens and real biometrics remain pending.

Phase 8 saves mobile biometric consent, displays facilitator enrollment status and supports confirmed withdrawal in Security & Privacy. The facilitator captures the face through the existing staff workflow. The local processor is SIMULATED and the app labels its records accordingly. Apply `mobile-biometrics.patch` after the SMS patch and deploy its additive migration. See the [biometrics guide](mobile/docs/biometrics-setup.md). Real model/device validation and upstream deployment remain pending.

Read the [October 19 PDF progress guide](output/pdf/GarantiyAid-Mobile-Update-and-Completed-Tasks.pdf) or its [editable source](mobile/docs/app-update-and-testing-guide.md) for the earlier progress snapshot and local setup. These READMEs describe the later milestones.

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
