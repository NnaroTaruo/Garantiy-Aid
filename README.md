# GarantiyAid

GarantiyAid is a capstone prototype for beneficiary registration, phone OTP authentication, distribution scheduling, secure QR claim passes, and saved claim and assistance records.

## Projects

- [`mobile/`](mobile/README.md) — React Native and Expo beneficiary app based on the supplied Figma design.
- [`backend/`](backend/README.md) — Express, Prisma, and PostgreSQL REST API.

Registration, generated OTP verification, persistent sessions, profile loading, program enrollments, assigned schedules, QR pass issuance, and read-only claim and wallet history use the backend database. Notifications and biometrics remain previews. Staff scanning and claim approval still need integration with the team's web workflow. The wallet records assistance; it does not hold or transfer funds.

The latest update prevents stale account responses after logout or account switching, corrects Wallet loading/error/empty states, and clarifies that registration details are saved to the server.

Read the [step-by-step PDF progress guide](output/pdf/GarantiyAid-Mobile-Update-and-Completed-Tasks.pdf) or its [editable source](mobile/docs/app-update-and-testing-guide.md) for completed features, local setup, tests, and remaining work.

## Local development

Start the database and API:

```powershell
cd backend
npm install
npm run db:local
npm run db:deploy
npm run db:seed
npm run dev
```

Then start the browser preview in another terminal:

```powershell
cd mobile
npm install
npm run web -- --port 8765
```

Open `http://127.0.0.1:8765`.
