# Mobile/backend integration checklist

These are the mobile frontend's requirements, derived from the manuscript and latest ERD. The first beneficiary-account endpoints now live in `../../backend`; the remaining rows describe later milestones.

## Implemented mobile API

| Endpoint | Mobile use |
| --- | --- |
| `GET /barangays` | Loads active service areas and their database IDs. |
| `POST /auth/register` | Stores the collected beneficiary details and issues a registration OTP. |
| `POST /auth/otp/request` | Issues or resends registration/login OTPs with cooldown and expiry. |
| `POST /auth/otp/verify` | Activates registration or logs in and returns a bearer session. |
| `POST /auth/logout` | Revokes the current bearer session. |
| `GET /beneficiaries/me` | Returns the authenticated beneficiary profile. |
| `PATCH /beneficiaries/me` | Validates and saves permitted name, address, and barangay changes for the signed-in beneficiary. |
| `GET /beneficiaries/me/overview` | Returns program enrollments and the next assigned distribution schedule. |
| `GET /beneficiaries/me/wallet` | Returns the beneficiary's wallet summary, current claim status, claim history, and posted assistance receipts. |
| `GET /beneficiaries/me/notifications` | Lists the signed-in beneficiary's sent in-app messages, newest first. |
| `PATCH /beneficiaries/me/notifications/:notificationId/read` | Saves the message's first read timestamp; safe to retry. |
| `POST /beneficiaries/me/claim-pass` | Issues a hashed, expiring QR pass for the authenticated beneficiary's next distribution. |

| Capability                      | Required behavior and fields                                                                                                                                                                                                                    |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Registration and authentication | **Implemented for phone OTP.** Secure device token storage, startup restoration, protected tab navigation, and logout are connected. Password recovery and face login remain.                                                                 |
| Beneficiary profile             | **Saved profile and editing implemented:** first/middle/last name, address, and barangay updates persist across sessions. Phone, birth date, sex, verification, and account status remain read-only; program assignments stay staff-managed.                                                                                                                                    |
| Program enrollment              | **Implemented for program, enrollment date, grant amount, and status.** Required documents, validation results, and assigned staff contact remain.                                                                                              |
| Schedules                       | **Implemented for the next assigned schedule:** distribution and schedule IDs, program, date, start/end, queue number, location, and status. Saved change messages can be displayed; staff-event creation remains.                                                                       |
| QR claim pass                   | **Mobile issuance implemented:** server-issued opaque token, distribution scope, expiry, and replacement revocation. Staff-side validation and used status remain.                                                                            |
| Claims                          | **Read-only mobile status implemented:** saved claim status, verification method, program, amount, distribution date, and claimed timestamp. Authorized staff validation, duplicate blocking, and atomic claim completion remain.                 |
| Consent and biometrics          | Versioned privacy notice and consent, consent ID and timestamps, withdrawal, secure photo upload if allowed, face enrollment result, and server-side matching/liveness. The client captures a photo; it does not declare a real identity match. |
| Wallet and transactions         | **Database-backed read-only ledger implemented:** account balance/currency/status, transaction amount/type/date/status/reference, linked claim status, and receipt details. It records assistance and never holds or transfers funds.             |
| Notifications                   | **In-app inbox implemented:** ID, optional schedule ID, title/message, optional Bisaya translations, type, sent timestamp, and persisted read timestamp. Staff-event creation, SMS/push delivery, preferences, and device registration remain.                                                                                               |
| Assistant and escalation        | Session/language, authorized answers about the beneficiary, service errors, assigned staff contact, and explicit submitted-ticket confirmation.                                                                                                 |

The mobile app centralizes API calls with a timeout, loading/error states, server-issued codes, persistent sessions, and protected signed-in routes. Claim and wallet data are display-only in the beneficiary app. The future staff endpoint must verify the claim and create the associated transaction in one database transaction so partial completion cannot occur. Do not embed database, SMS, or biometric-service credentials in Expo public environment variables.

Notification responses use `{ data: [...] }`, with each entry containing `id`, `scheduleId`, `title`, `titleBs`, `message`, `messageBs`, `notificationType`, `sentAt`, and `readAt`. PATCH returns `{ data: { id, readAt } }`. Delivery `status` remains separate from `readAt`; inbox queries include only `channel: in_app`, `status: sent`, and `sentAt <= now`. Other beneficiaries' IDs return 404 on PATCH. Dates are ISO timestamps, displayed in Manila time. The mobile inbox refreshes when opened and on demand; there is no polling or OS push delivery.

Profile PATCH accepts a partial JSON object containing only `firstName`, `middleName`, `lastName`, `address`, and `barangayId`, and returns `{ data: Beneficiary }` in the same shape as GET. Names are trimmed, limited to 100 characters, and accept Unicode letters with normal name punctuation. Blank/null `middleName` clears it. Addresses require 5–500 characters. A new barangay must be active; keeping the existing one is allowed even if it has become inactive. Empty bodies, unsupported fields, and invalid input return 422; field errors use `error.fields`. Ownership always comes from the bearer session, never a supplied beneficiary ID. The mobile form sends only these five editable fields and updates its shared profile cache after server confirmation.

The team's staff backend should create a notification in the same database transaction as a schedule change or completed claim. Set the recipient from the authorized event, verify ownership of any linked schedule, supply the message and optional translation, and leave `readAt` null. The beneficiary app cannot create notifications or complete claims. The seed includes two historical demo messages and preserves their read timestamps when rerun.

Add offline schedule/pass caching only after agreeing token expiry and revocation behavior. The current pass is held only while its screen is open and is reissued by the server when opened again.
