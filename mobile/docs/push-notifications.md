# Android phone alerts (push)

Phase 13 adds opt-in Android phone alerts for the shared staff backend. On November 12, 2026, a physical Android phone registered for alerts and received the new schedule update. Expo accepted the send on the first attempt. The tester tapped the Android alert, opened the matching notification details, and the notice was marked read. Logout revoked the session and removed the phone registration. Signing in again with the same account automatically registered the phone for the new session.

## How it works

- **Turning alerts on.** Profile > Notification settings > Phone alerts > **Turn on phone alerts** is the only action that can show Android's notification permission prompt. The app creates the `account-updates` channel first, which Android 13+ requires before it will prompt. It then gets an Expo push token and saves it to the signed-in session through `PUT /beneficiaries/me/push-device`. The token is sent only in that request body. It is never shown, logged, stored on the phone, or placed in a URL.
- **What triggers an alert.** Staff actions that already create automatic in-app notices (enrollment decisions, published schedules, claim verification/release, simulated credit/reversal) also queue a phone alert in the same staff transaction. The backend sends it only after that transaction commits, makes the network call outside the database transaction, and re-checks the following at send time: session, owner, saved category preferences, and read state.
- **What the alert shows.** The lock-screen text is always generic: "GarantiyAid – You have a new account update. Open the app to view it." (or the Bisaya equivalent). It never contains a name, program, amount, venue or staff note. Tapping it opens Notification details, which loads the notice through the account that is currently signed in. If a different account is signed in, the app shows "Notification unavailable".
- **When alerts stop.**
  - Logout deletes this phone's registration on the server and clears alerts already shown on the phone.
  - Signing in to another account on the same phone never inherits alerts.
  - If the other account turns alerts on, the phone moves to that account and the previous account stops receiving alerts.
  - A new sign-in by the same person who turned alerts on resumes them without prompting again.
- **Unavailable states.** The card explains each of these in English and Bisaya:
  - browser preview;
  - Expo Go;
  - an app copy without an EAS project ID;
  - a server with push disabled (`MOBILE_PUSH_MODE=DISABLED`);
  - permission denied or blocked (with an Open Android settings button);
  - a token that Expo reports as no longer registered ("Turn on phone alerts again");
  - connection failures (with retry).
- The browser preview never calls the push routes and keeps using the in-app inbox.

## One-time account setup (requires your accounts)

This workspace is linked to [@ronan24/garantiyaid-mobile](https://expo.dev/accounts/ronan24/projects/garantiyaid-mobile), with its EAS project ID saved in mobile/app.json. Firebase project `garantiyaid-96ef3` has an Android app for `ph.garantiyaid.mobile`; its downloaded `mobile/google-services.json` is validated and referenced by `expo.android.googleServicesFile`. The matching FCM V1 service-account key was uploaded to EAS and assigned to this Android package on November 10, 2026. Its private JSON remains outside the repository. `mobile/eas.json` defines the internal `development` profile, and SDK-compatible `expo-dev-client` is installed. The first [Android development build](https://expo.dev/accounts/ronan24/projects/garantiyaid-mobile/builds/bae20dff-bda8-4dd2-88c7-969659c22b1f) finished and was installed on a phone. The app connected to Metro through the development launcher's URL field. The local API uses `MOBILE_PUSH_MODE=EXPO` for the test session. Keep the service-account key private.

1. **Create the EAS project.** In `mobile/`, sign in and link the project:
   ```powershell
   npx eas-cli@latest login
   npx eas-cli@latest init
   ```
   `init` writes `expo.extra.eas.projectId` (and `owner`) into `app.json`. Without it, the app shows "This copy of the app is not set up for phone alerts yet."
2. **Android package name.** This workspace uses `ph.garantiyaid.mobile`, saved under `expo.android.package` in `app.json`. Enter that exact value when registering the Android app in Firebase. It must match the native app and cannot be changed for an already registered Firebase app.
3. **Firebase app.** In the [Firebase console](https://console.firebase.google.com/), create or choose a project, then add an Android app with that exact package name. Download `google-services.json` into `mobile/` and add `"googleServicesFile": "./google-services.json"` under `expo.android` in `app.json`.
4. **FCM V1 key.** In Firebase, go to Project settings > Service accounts > **Generate new private key**. Save the JSON outside the repository, or add its filename to `.gitignore`. Never commit it. Upload it to Expo:
   ```powershell
   npx eas-cli@latest credentials
   ```
   Choose Android > your build profile > Google Service Account > *Manage your Google Service Account Key for Push Notifications (FCM V1)* > *Upload a new service account key*. Alternatively, upload it at expo.dev > project > Credentials > Android > FCM V1 service account key.
5. **Enable push on the shared backend.** Add these lines to `shared-backend/.env`, keeping the existing `MOBILE_AUTH_SECRET` and `FIELD_ENCRYPTION_KEY`:
   ```
   MOBILE_PUSH_MODE=EXPO
   ```
   Only if you enable *Enhanced push security* for the Expo project, also add `MOBILE_PUSH_EXPO_ACCESS_TOKEN=<token from expo.dev access tokens>`.
6. **Apply the migrations** to the development database, then restart the API. There are two additive push migrations: the outbox/device tables and registration-version protection. This workspace has both on development port 51234 and isolated test port 51244; another checkout must deploy them normally without resetting data:
   ```powershell
   cd C:\Users\Ronan\Documents\Garantiy-Aid\shared-backend
   # stop the running API (Ctrl+C in its terminal) first
   npx prisma migrate deploy
   npm run dev
   ```
7. **Build the app.** Expo Go cannot receive Android remote push.
   - Development build (debug builds allow `http://` APIs):
     ```powershell
     cd C:\Users\Ronan\Documents\Garantiy-Aid\mobile
     npx expo install expo-dev-client
     npx eas-cli@latest build:configure
     npx eas-cli@latest build --profile development --platform android
     ```
     Install the resulting APK on the phone. Then start Metro for it, using your computer's LAN IP:
     ```powershell
     $env:EXPO_PUBLIC_API_URL='http://192.168.1.10:4000/api/v1/mobile'
     npx expo start --dev-client
     ```
     Expo notes a known issue: in development builds, opening the app from an alert while it is fully closed can fail to finish the splash screen. Release builds are not affected.
   - For a release-style test, use `--profile preview` with an HTTPS API URL baked in through `EXPO_PUBLIC_API_URL` in `eas.json`. Android release builds block plain `http://` by default.

## Android testing (phone)

Use a physical Android phone, or an emulator image with Google Play services.

1. Start the shared database and API with `MOBILE_PUSH_MODE=EXPO`, and open http://127.0.0.1:4000/api/v1/health.
2. Open the development build on the phone and sign in with a test beneficiary account.
3. Go to Profile > Notification settings. Under **Phone alerts**, tap **Turn on phone alerts**, then choose **Allow** in Android's prompt. Expect "Phone alerts are on for this phone."
4. Press Home so the app is in the background.
5. In the staff website, approve an enrollment, request a correction, or publish a schedule for that beneficiary.
6. Within a few seconds, a "GarantiyAid – You have a new account update…" alert should appear. Check that it shows no name or program.
7. Tap the alert. The app opens Notification details for that update, and it is marked read.
8. With the app open, trigger another staff action. A banner appears and the Notifications list refreshes.
9. Turn off Schedule updates, tap **Save preferences**, then publish a schedule. Expect no alert and no new inbox message.
10. Tap **Turn off phone alerts**, trigger a staff action, and expect no alert. Turn alerts on again.
11. Log out, trigger a staff action for that beneficiary, and expect no alert. Sign back in: alerts resume without a new prompt.
12. Sign in as a second test beneficiary on the same phone. Actions for the first beneficiary produce no alert. Turn alerts on for the second account and confirm that only the second account's actions alert.
13. In Android Settings > Apps > GarantiyAid > Notifications, turn notifications off. Reopen Notification settings: the card warns that Android is blocking notifications and offers **Open Android settings**.
14. Optional: switch the app language to Bisaya before step 3, and confirm the alert text is in Bisaya.

Record the phone model and Android version, and whether each step passed. Until these steps pass on a device, do not report push delivery as working.

## Automated coverage (no real push sent)

- Mobile regressions (`npm test`) cover:
  - availability for browser, Expo Go, missing project ID and Android builds;
  - channel creation before the permission prompt;
  - the token sent only in the request body;
  - denied, blocked and token failures;
  - resume only for the owner;
  - turning off;
  - alert payload validation;
  - the settings card's states and retry in English and Bisaya;
  - late or 401 responses;
  - tap routing after session restore;
  - signed-out taps;
  - clearing shown alerts on account changes;
  - token rotation;
  - loading a tapped notice through the current account.
- `npm run test:shared` includes a real staff enrollment approval queuing exactly one alert after commit, a fake sender confirming the generic message, and logout removing the registration.
- The backend suites are described in `shared-backend/docs/mobile-push-integration.md`.

## Follow-up reliability fixes

Provider deadlines now include reading the response body. Temporary per-device rate limits retry with bounded backoff. Each send records the registration version it used, so a delayed failure cannot disable a replacement registration. Regression checks use a fake provider and isolated database; no real phone delivery is claimed.
