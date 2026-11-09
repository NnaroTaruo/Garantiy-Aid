# Remaining mobile work

Reviewed November 10, 2026, after staff support, named document checklists, private saved-file viewing/downloads, saved in-app notification preferences and the Android phone-alert code. These are work areas; external setup and hands-on validation are separate from completed local code.

| Priority | Work | What remains |
| --- | --- | --- |
| Account setup + device test | Android phone alerts | Code, tests and `mobile-push-notifications.patch` are complete locally (opt-in registration, post-commit Expo sender, logout/account-change cutoff, generic alerts, tap routing). Remaining steps: create the EAS project ID, Android package, Firebase `google-services.json` and FCM V1 key; set `MOBILE_PUSH_MODE=EXPO`; build a development or release app; then validate delivery, taps, logout and account changes on a phone. Follow [Android phone alerts](push-notifications.md). Real delivery is unverified. |
| Provider setup | Real verification SMS | Choose/configure an SMS provider, private key/sender/credits and test receipt on a real phone. The optional Semaphore adapter is prepared, but the team has no provider account and local mode remains DEVELOPMENT. |
| Team validation | Real face matching | Configure and validate the staff backend's real model/liveness service. Mobile consent/status is connected; the local processor remains SIMULATED. The facilitator captures faces. |
| Team integration | Shared hosted backend | Review/merge the portable mobile backend patches with the web teammate, deploy a shared API/database and durable private document storage, and configure mobile URLs/secrets outside Expo public variables. Local GitHub publication alone does not deploy it. |
| Release testing | Android end-to-end check and installable build | Test real device networking, supported Expo/development build, file picker/opening, keyboard/Back/safe areas, login/logout/account changes and the full staff-to-mobile workflow. Exports pass, but physical-device validation and release-build distribution are pending. |

Other planned gaps include staff-verified linking of existing beneficiary records/lost phone numbers, a full beneficiary program/application catalog, and any additional ledger/receipt/dispute screens required by the team's final module list. Treat those as separate scope checks rather than silently adding financial transfers or eligibility decisions to mobile. The current wallet is an assistance record, not a real-money account.

Recent local work still needs a manual staff/mobile walkthrough, including support replies/resolution, named document correction/approval and saved-file viewing. Browser preview/download checks use public sample files and synthetic accounts; Android's real open/save chooser still needs a phone test. Manual browser QR verification, duplicate rejection, simulated goods release and receipt issuance were already confirmed; camera scanning, actual goods/money transfer and receipt printing were not.
