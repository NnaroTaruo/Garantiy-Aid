<p align="center">
  <img src="mobile/assets/icon.png" alt="GarantiyAid logo" width="120" height="120" />
</p>

<h1 align="center">GarantiyAid</h1>

<p align="center">A capstone prototype for government assistance scheduling and claims.</p>

Beneficiaries use the mobile app to sign in with a phone code, submit documents, check enrollment and schedules, show a QR claim pass, and view assistance records. Staff use the shared web system to review enrollments, publish schedules, verify claims, and record releases.

## What we tested

- A staff-published schedule sent a push notification to a physical Android phone. Tapping the alert opened the matching notification details.
- Signing out removed the phone's alert registration. Signing in again with the same account restored it.
- The staff website verified a test QR claim, rejected a duplicate attempt, and recorded a simulated physical release and receipt.

The local prototype uses development OTP codes and simulated face matching. The Wallet shows assistance records and simulated credits.

## Run locally

| Guide | Use it for |
| --- | --- |
| [Mobile app](mobile/README.md) | Run the React Native and Expo app in a browser or on Android. |
| [Standalone API](backend/README.md) | Set up the local Express and PostgreSQL API with sample data. |
| [Shared staff integration](mobile/docs/shared-backend-integration.md) | Connect staff enrollment, scheduling, claim, and release workflows. |
| [Android phone alerts](mobile/docs/push-notifications.md) | Set up the development build and test staff-triggered alerts. |

See the [verification notes](mobile/docs/verification.md) and [remaining work](mobile/docs/remaining-work.md) for current test results and deployment status. The [PDF progress guide](output/pdf/GarantiyAid-Mobile-Update-and-Completed-Tasks.pdf) is an earlier project snapshot.
