# GarantiyAid

<!-- impeccable:product-schema 1 -->

## Platform

android

## Stack

React Native with Expo, as specified by the capstone manuscript. The mobile app uses TypeScript and Expo Router. Its supporting local REST API uses Node.js, Express, Prisma, and PostgreSQL. Registration, phone OTP access, profiles, enrollments, schedules, QR issuance, and read-only claim and wallet records are connected. Integration with the team's staff web workflow remains open.

## Users

Social welfare beneficiaries in selected Cebu City barangays. Ronan is responsible for mobile development. Staff, facilitators, and administrators use the team's web application.

## Product Purpose

Help beneficiaries register, view an assigned distribution schedule and queue number, present a QR claim pass, and view claim records and updates.

Shared-backend integration began on October 30, 2026 against the team's Express backend (Bryllando/garantiyaid-backend). Phase 1 adds separate beneficiary mobile accounts, development OTP/session access, active service areas, and profile read/edit using the same Beneficiary records as staff. It is implemented in a local feature checkout with a portable review patch, not merged or deployed upstream. Other mobile features still require shared endpoints; the original mobile backend remains available independently. Phone ownership does not approve beneficiary eligibility, and existing staff records are not automatically linked by phone/name.

Phase 2 on November 3 connects private beneficiary documents to staff review. Mobile displays accepted/rejected status, staff feedback and review time, and submits corrected files while preserving the original version. Uploader attribution distinguishes beneficiaries from staff. These changes remain local; shared schedules, QR, wallet/claims, and notifications are not connected yet.

Phase 3 connects Home, Schedule, and Enrollment status to the shared backend's own-account overview. It returns assigned program details, all saved enrollment statuses, staff feedback/review dates, and the earliest eligible published schedule. Session dates/times use Asia/Manila and the assigned slot's venue. Missing grant amounts remain unspecified. Refresh actions handle new assignments and staff decisions; older responses cannot overwrite newer refresh results. The preceding shared document upload/rejection/correction/acceptance flow was confirmed by the user in the local browser. These phases remain local; shared QR, wallet/claims, notifications, and a general program catalog are pending.

Phase 4 on November 5 adds own-account mobile QR issuance/reopening in the shared backend, using its existing scanner format, eligibility and verification rules. Only hashes are stored; reopening preserves the mobile credential. Used/revoked/expired and separately staff-issued tokens are not replaced. QR_AND_BIOMETRIC retains its independent biometric requirement, including the existing biometric-first pending path. The mobile screen refreshes, hides expired codes and guards delayed account responses. Automated staff QR verification passes without releasing assistance or crediting a wallet. Physical camera scanning, shared mobile wallet/claim views, notifications, real SMS and biometric capture/matching remain pending. Backend changes are preserved in ordered review patches and are not deployed upstream.

On November 9, the local staff copies were updated to frontend `f6dfcdf` and backend `42b4552` (version 4.0). The consolidated `mobile-v4.patch` now carries all mobile phases for that backend base; historical version-3 patches remain available. Compatibility preserves the transaction-aware adapter, upload root, named/removed documents and QR_OR_BIOMETRIC without bypassing mandatory combined checks. Physical-assistance test events follow the new package-detail requirement. Updating source does not publish to teammate repositories or share their database.

The November 9 manual browser walkthrough also passed mobile QR display, administrator credential preview/verification, hiding the used mobile pass, and staff duplicate rejection. The facilitator subsequently recorded a clearly labelled simulated release of one test food pack and issued its receipt. The new November 10 test event has exactly one CLAIMED claim, one saved receipt snapshot, a USED token, saved package/evidence/staff/timestamp attribution, and zero linked wallet transactions; no actual goods or money moved. Both apps ran on one computer, so physical camera scanning and an actual handover remain separate checks. Receipt printing and its verification QR are untested.

Phase 5 on November 9 connects the mobile Wallet screen to shared own-account claim/release history, package/quantity, release time, receipt number/issue time and review indicators. Existing wallet summaries and claim-linked benefit credit/reversal entries are read-only; absent accounts remain null and physical goods never become credits. EN/BS status labels distinguish verification from release, and stale refresh results cannot overwrite newer records. The incremental mobile-claims.patch applies after mobile-v4.patch. All phases remain local pending teammate review/deployment; shared notifications, transfer history, live SMS and biometrics remain later work.

## Operating Context

The manuscript proposes one REST backend shared by the mobile and web apps. The supplied ERD defines beneficiaries, schedules, QR tokens, claims, notifications, enrollment, documents, consent, wallet accounts, and transactions. The local API now provides the beneficiary-facing account and record endpoints. Authorized staff scheduling actions, QR scanning, identity verification, and atomic claim completion still need to be integrated through the shared backend and staff web application.

## Capabilities and Constraints

As of October 19, 2026, account creation collects personal identity, birth date, sex, home address, barangay/service area, city, and mobile number. Registration submits the beneficiary details to PostgreSQL before OTP verification. Generated phone OTP codes support registration and sign-in in development; SMS delivery is not connected. Session restoration, protected tabs, logout, and stored profile details use the backend. Session guards discard obsolete responses after logout or account switching.

Program enrollment, assigned schedules, server-issued expiring QR passes, claim status, wallet history, transaction receipts, and the in-app notification inbox use saved account records. Notification read timestamps persist across sessions; cached messages and delayed responses are isolated by account. The beneficiary app displays staff-assigned records and cannot approve its own claims. The wallet is an assistance ledger; it does not hold or transfer funds. The seed provides fictional local test records with fixed dates and labeled demo notifications rather than a live government distribution feed.

Profile editing now saves first/middle/last name, address, and barangay to the signed-in beneficiary record. The form retains failed drafts, prevents repeat submissions while saving, and applies confirmed values across Home and Profile. Phone changes need a separate verification flow; birth date, sex, verification, and account status remain read-only. A changed service area must be active; existing program and schedule assignments are managed by staff.

Beneficiaries can upload requested enrollment documents as PDF, JPEG, or PNG files up to 5 MB. Files use private local storage and saved metadata; access and cached lists are scoped to the signed-in account. Repeated/concurrent uploads of identical contents in one category return one record. The original local backend records received status; the shared integration also supports staff decisions and corrected files. Acceptance does not approve enrollment or establish identity/authenticity. Mobile intake categories do not determine official requirements.

Automatic notification creation by staff events, SMS/push delivery and preferences, password/account recovery, live staff escalation, and real biometric matching/liveness remain unconnected. Face consent and camera capture are optional previews; captured face-enrollment photos are not uploaded. Help uses saved schedules and claim status, while other answers remain fixed preview responses. No government database connection or live payment integration is in scope. Web and Android exports pass, but a complete visual review of the latest fixes and physical Android validation remain pending. Shared durable document storage, file viewing, scanning, and retention/deletion workflows remain future work.

## Brand Commitments

The user's Figma mobile screens are the visual authority: https://www.figma.com/design/tZEG9H4ZRsP86KvhBjtd3X/Garantiy-Aid?node-id=0-1. Preserve their blue and green identity, pale background, shield logo, compact forms, claiming card, and Home/Wallet/Help/Profile navigation. Reproduce the screen content inside the device frame; the Figma phone housing and canvas annotations are not application chrome. No replacement visual identity is requested.

## Evidence on Hand

User-supplied manuscript: C:/Users/Ronan/Downloads/GarantiyAid-Capstone30-Manuscript1.pdf. User-supplied ERD: C:/Users/Ronan/Downloads/ERD.jpg. Publicly viewable Figma includes 30 mobile frames covering the primary flow, recovery, enrollment, privacy, chat scenarios, and exception states. Precise Figma fonts and downloadable logo assets are unavailable to the anonymous inspector; Inter and a small recreated vector mark are implementation assumptions.

## Accessibility & Inclusion

English/Bisaya selection, readable text, phone-sized layouts, keyboard-safe forms, system Back support, and at least 48 dp touch targets. Phone is the initial supported layout; tablets are not a release target yet.
