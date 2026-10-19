# GarantiyAid mobile

React Native + Expo beneficiary frontend built from Ronan's Figma mobile designs.

## Run in the browser

Start the [backend API](../backend/README.md) first. From the repository root, open another PowerShell terminal:

```powershell
cd mobile
npm install
if (!(Test-Path .env)) { Copy-Item .env.example .env }
```

Set `EXPO_PUBLIC_API_URL=http://127.0.0.1:3000` in `mobile/.env`, then run:

```powershell
npm run web -- --port 8765
```

Open `http://127.0.0.1:8765`. Port `8765` matches the backend's configured browser origins. Keep an existing environment file and restart Expo whenever its API URL changes. The development OTP appears on the verification screen and in the backend terminal because SMS delivery is not connected yet.

## Run on your phone or emulator

Set `EXPO_PUBLIC_API_URL` in `mobile/.env` for the target device:

| Target | API URL |
| --- | --- |
| Browser on this computer | `http://127.0.0.1:3000` |
| Android Studio emulator | `http://10.0.2.2:3000` |
| Expo Go on a physical phone | `http://<computer-LAN-IP>:3000` |

For Expo Go, use the computer's actual LAN address, keep the phone and computer on the same Wi-Fi, and run `npm start` from `mobile/`. Open Expo Go on Android and scan the terminal's QR code. Use an Expo Go version compatible with this SDK 57 project.

The API must remain running on the computer. The phone must be able to reach its LAN address on port `3000`. The private `.env` file is ignored by Git.

Skip optional face enrollment or choose demo capture. Camera access is requested only after the consent screen and the Enable camera button. Photos are not uploaded, and demo capture does not perform face matching or liveness checks.

## Implemented frontend

- English/Bisaya four-step account creation backed by PostgreSQL, including active-barangay validation, generated OTP verification, phone login, complete saved beneficiary details, and server-side logout.
- Optional biometric consent, front-camera photo capture, retake, demo enrollment success, and consent withdrawal.
- Database-backed program enrollment, Home claiming schedule, schedule details, queue number, and server-issued QR claim pass with empty/error/retry states. Staff identity verification and claim completion remain future work.
- Database-backed read-only claim status, assistance-ledger balance, transaction history, and receipt details. The ledger records distributed assistance and does not transfer or hold funds.
- Saved profile details and enrollment status from the backend, plus a database-backed notification inbox, message details, unread badge, and persistent read state with retry on failure. Notification delivery preferences, missing-document file selection, and password/recovery screens remain previews.
- Sample assistant conversations for schedule, documents, face scan failure, and enrollment; the claim-status answer reads saved claim data, while staff support remains a preview.
- Schedule update and expired-QR states.

Registration, authentication, beneficiary profiles, program enrollments, the next distribution schedule, QR claim-pass issuance, claim status, wallet transaction history, and in-app notifications use the local backend database. Biometric records remain synthetic. The mobile claim and wallet views are read-only; a future staff workflow will record a verified claim and its transaction atomically. Session tokens are encrypted with Expo SecureStore on Android and iOS, while the browser preview uses local storage. On startup the app validates the saved session through `/beneficiaries/me`; expired sessions return to Welcome and signed-out users cannot open the tab routes.

To test notifications, apply the backend migration and seed, then sign in as `0917 555 0147`. Tap the Home bell to view two labeled demo messages. Open one, return to the list, then log out and sign in again: it stays read. The badge clears when all messages are read. New accounts have an empty inbox. Messages load at sign-in/restoration and when the inbox opens; use **Refresh notifications** for newer records. English/Bisaya messages use stored translations when supplied and English otherwise. Staff-generated events and SMS/OS push delivery still need integration; there is no background push connection.

## Figma reference

[Garantiy-Aid design](https://www.figma.com/design/tZEG9H4ZRsP86KvhBjtd3X/Garantiy-Aid?node-id=0-1)

The original canvas contains phone housing and flow annotations. The implementation recreates the actual app content inside those phones. It preserves the pale backgrounds, blue action buttons, green success states, compact forms, claiming card, and Home/Wallet/Help/Profile navigation. Touch targets and small text were enlarged for use on a real device. The QR screen renders the opaque value issued for the signed-in beneficiary and distribution. Inter and a recreated shield icon approximate the anonymously viewable design; replace the mark with the original exported Figma asset for exact brand fidelity.

## Project structure

```text
app/                 Expo Router screens and navigation
src/components.tsx   Shared controls and layout
src/theme.ts         Figma-derived colors and typography
src/state.tsx        Session, backend overview/wallet state, and remaining preview records
src/screens/         Entry flow, main tabs, detail screens, and help
docs/backend-contract.md  Integration work for the backend team
```

## Verification

```powershell
npm test
npm run typecheck
npm run export:web
npm run export:android
```

The regression tests cover delayed session responses, logout and account switching, token-storage ordering, and Wallet loading/error/empty states. They use controlled requests and storage without requiring an emulator.

Read the [update and testing guide](docs/app-update-and-testing-guide.md) or the [PDF version](../output/pdf/GarantiyAid-Mobile-Update-and-Completed-Tasks.pdf) for the full completed-task list and browser testing steps.

Android bundle export checks compilation, not device behavior. Test camera permissions, system Back, keyboard, larger text, and safe areas on a real phone before presenting the capstone.
