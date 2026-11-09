# Face consent and staff enrollment

Ronan confirmed the flow: **mobile saves consent/status; the facilitator captures the face**. This phase connects the beneficiary app to the existing staff biometric workflow, locally on backend version 4.0. No mobile photo capture or face login is implemented.

1. Start the shared database, shared backend and mobile preview using [the integration guide](shared-backend-integration.md). Use the shared /api/v1/mobile API base. The original port-3000 API does not implement these endpoints.
2. In mobile, sign in to your beneficiary account and open Profile > View face verification > Review consent.
3. Read the versioned notice and retention date. Agree and save consent records your own consent on the shared database. Not now leaves your consent unchanged and returns Home.
4. The barangay facilitator opens the same beneficiary in the staff biometric workspace. The mobile consent appears in the existing consent list. Staff capture the face using their existing enrollment controls. If a prior profile is revoked, staff use their re-enrollment workflow.
5. Return to mobile and Refresh status. It shows the saved enrollment, staff review, expiry or withdrawal status. Consent alone does not mean a face was enrolled.
6. In Security & Privacy, choose Withdraw face consent, then Confirm withdrawal. This revokes use of the linked template. Phone sign-in remains available; new face verification requires new consent and staff enrollment. Contact authorized staff about permanent deletion and retained audit records.

The local server currently uses SIMULATED processing. The screen explicitly labels simulated enrollment. The shared backend already supports a remote face service, but this task does not configure or validate that model. Staff camera capture, anti-spoof behavior, actual matching and physical-device networking still require separate validation. A different model's saved template produces a warning; it is not treated as a verified real enrollment.

For the teammate: apply mobile-v4.patch, mobile-claims.patch, mobile-notifications.patch, mobile-sms.patch, then [mobile-biometrics.patch](../../integrations/shared-backend/mobile-biometrics.patch) on backend 42b4552. Generate Prisma and deploy migrations against an approved development database. The new recorder field attributes consent to the beneficiary without fabricating a staff account. Existing staff enrollment roles and claim verification remain unchanged. The included backend docs/mobile-biometrics-integration.md describes DTOs, concurrency and privacy.
