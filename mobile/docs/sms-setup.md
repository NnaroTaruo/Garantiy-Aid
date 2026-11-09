# Verification texts and account recovery

Updated November 10, 2026. Recover account now requests the existing login verification code and opens the working OTP screen. The backend has an opt-in Semaphore adapter. The team confirmed it does not have an SMS provider account yet, so the current local setup remains DEVELOPMENT and does not send texts.

## What works now

- From Log in, choose Trouble signing in? Recover account, enter the registered number and request a code. Enter the development code shown on the next screen to sign in to the same account. The session is created only after successful verification.
- Failed requests keep the entered number and can be retried. Repeated taps are blocked while waiting; leaving the page prevents a delayed response from navigating back. English/Bisaya labels are retained.
- This account uses phone login codes rather than a saved password. Recovery does not reset identity or change the registered number. People who no longer control that number must contact the facilitator for an authorized linking/reassignment process, which remains separate work.

## To enable real SMS later

1. The team needs a Semaphore account, a private API key, credits and a registered default or approved sender. Review the [official API documentation](https://www.semaphore.co/docs) and current account terms before buying credits. No account has been created or charged by this implementation.
2. Have the backend teammate apply the patches in order to backend `42b4552`: `mobile-v4.patch`, `mobile-claims.patch`, `mobile-notifications.patch`, `mobile-sms.patch`. Generate Prisma and deploy the migrations to a separate development instance first. The SMS patch includes `docs/mobile-sms-integration.md` with the server setup and tests.
3. Put the API key and SMS configuration only in the backend's private environment or secret manager. Keep the existing mobile auth secret private. Do not put secrets in an Expo public variable, Git or chat. Set MOBILE_AUTH_MODE=SMS only on the configured instance; the example remains DISABLED and the local demo remains DEVELOPMENT until ready.
4. Restart that API and point mobile to it using EXPO_PUBLIC_API_URL. Test with a unique fictional beneficiary and a real Philippine number you control. In SMS mode, the OTP screen does not show a development code. Verify that the text actually arrives before entering it. Gateway acceptance alone is not proof of carrier delivery.
5. Test registration, login, account recovery, resend after 60 seconds, incorrect/expired codes and a failed send. Switching authentication modes requires signing in again; development codes and sessions do not authenticate in SMS mode.

No real SMS or carrier delivery has been tested yet. SMS request errors are sanitized, failed codes are invalidated, and a failed initial registration send leaves one unverified account that can resume after the cooldown. Account/profile/claim records are not reset by the migration. SMS authentication is separate from the staff notification worker, which remains simulated; push delivery and delivery preferences are still later work.
