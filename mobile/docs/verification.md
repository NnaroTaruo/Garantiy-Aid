# Frontend verification

GitHub update prepared on November 5, 2026:

- Rechecked all 37 mobile regressions and the mobile TypeScript check: all pass. The November 4 database, build and browser checks below describe the same application changes; they were not rerun for this publication step.
- The update includes shared document review/corrections, existing-account login recovery, assigned enrollment/schedule views, their tests, documentation, and ordered backend patches. Private environments, uploaded files, database files, and temporary tools remain excluded. The pre-existing API whitespace edit is left outside the commit.
- Publishing this mobile repository does not merge or deploy changes to the team's separate staff backend. Physical-device testing and the remaining shared mobile features are still pending.

Shared enrollment/schedule milestone checked on November 4, 2026:

- Added the authenticated own-account overview to the shared backend, reusing its existing program, enrollment, allocation, session and schedule tables. No migration or runtime dependency was added. All three ordered backend patches apply cleanly to the reviewed upstream base and reproduce all 26 changed files.
- All 37 mobile regressions and TypeScript pass. The real TypeScript-client/HTTP/database suite passes staff submission, review/correction/resubmission/approval, draft scheduling, rescheduling and publication, earliest assignment selection, owner isolation, safe DTOs, nullable grants, session-local Manila dates/venues, filtering ineligible/expired/cancelled assignments, and logout. Backend authentication and document integration suites also pass. These checks ran on a separate migrated test instance at 51244.
- The shared backend default suite reports 321 passed, eight skipped, and zero failed. Web and Android exports pass after the final UI change; Android export checks compilation rather than an installed app.
- A temporary headless Chrome context checked Home, Schedule and Enrollment status with controlled API fixtures. Screenshots at 390px and 320px, including Bisaya enrollment feedback, show no horizontal overflow or browser errors. The first pass found a narrow long-name layout; allowing the status to wrap fixed it in the confirmation pass. These fixture screenshots are not a manual staff scheduling or physical-device result.
- Home and empty enrollment screens now offer refresh actions. Older same-account responses cannot replace newer refresh results or clear their loading/error state. Enrollment shows staff feedback/review time and Not specified for null grants. Saved staff text is displayed without inventing translations.
- The user confirmed the preceding local document upload -> staff rejection -> corrected upload -> staff acceptance -> mobile status flow. The browser development database was restarted after it refused connections; the existing beneficiary, two document records and enabled staff authenticator were preserved. No synthetic fixtures remain there. A complete manual staff program/scheduling walkthrough and physical Android validation remain pending.
- This milestone is local and preserved in `integrations/shared-backend/mobile-overview.patch`; it has not been committed, pushed or deployed. Shared mobile QR issuance, wallet/claims, notifications, real SMS, biometric matching and a general program catalog remain pending.

Shared document-review milestone checked on November 3, 2026:

- Committed the preceding authentication milestone as `c45b049` (mobile repo) and `ce3ddc5` (shared backend), leaving the pre-existing API whitespace edit untouched. No GitHub push was performed.
- Applied `20261103000100_allow_beneficiary_document_uploads` on the separate shared development instance at port 51234. Staff uploads retain attribution; a database check restricts beneficiary uploader IDs to the document owner.
- All 35 mobile regressions and TypeScript pass, including the verified-account signup-to-login fallback, unfinished registration verification, and duplicate-code prevention. Web/Android exports passed for the document milestone before this login-flow fix. The shared backend default suite reports 321 passed, eight skipped, and zero failed. All three explicit HTTP/database suites pass: backend authentication, backend documents, and the actual mobile API client; the mobile client integration was rerun after the login-flow fix.
- Verified mobile multipart upload -> authorized staff rejection -> mobile feedback -> corrected upload -> staff acceptance -> mobile status. Checks include UTF-8 filenames, temporary-file cleanup, size/type validation, spoofed input, binary downloads, account isolation, concurrent retries/corrections, and revocation while a streamed upload is in progress. Accepting documents does not modify enrollment or staff identity verification.
- UI checks use controlled hooks and EN/Bisaya strings; Android request construction uses controlled file objects. No adb executable is available on PATH, and browser automation reports that its browser access host is unavailable. Actual device file-provider behavior, touch/keyboard/layout review, and a complete staff-browser walkthrough remain pending.
- The document changes are local and preserved in a second portable backend patch applied after the authentication patch. Staff frontend routes/roles are reused. File viewing, durable hosted storage, malware scanning, retention/deletion, and other shared mobile features remain outside this milestone.

Shared-backend account milestone checked on October 30, 2026:

- Implemented a local feature branch based on the team's backend `050c389`: separate beneficiary accounts, development OTP, hashed/revocable sessions, public active barangays, own-profile GET/PATCH, and audit attribution. Existing staff authentication remains separate.
- All 31 mobile regression tests and the mobile TypeScript check pass. The shared backend's default suite reports 320 passed, seven skipped, and zero failures; the skips are opt-in database suites.
- Both explicit database suites pass: the shared backend's auth/security integration and `mobile/npm run test:shared`, which calls the actual mobile TypeScript API through real HTTP and PostgreSQL. Confirmed mobile registration/profile edits are visible through authenticated staff list/detail endpoints; logout revokes access. Neither is a live staff-browser or physical-device walkthrough.
- OTP checks cover expiry, committed failed guesses, cooldown, five-guess lockout, simultaneous single-use verification, inactive accounts, session expiry/revocation, and staff/mobile token separation. Mobile verification does not set staff `isVerified` or create an enrollment/wallet.
- New migrations apply on a separate Prisma development instance at 51234 with pool size one. The original mobile database at 51214 still matches its original Prisma schema. New mobile auth tables match the shared schema; the shared repository already has unrelated FK/index/default drift in its older migrations, documented in the handoff. No corrective migration for that inherited drift was applied.
- Source changes are local and preserved as a teammate-review patch. Shared document intake/review, overview/schedules, QR, wallet/claims, and notifications remain unimplemented under `/api/v1/mobile`. The original mobile `.env` was preserved. A pre-existing trailing-space edit in `mobile/src/api.ts` was left untouched.

Document-upload milestone checked on October 20, 2026:

- Committed the preceding profile-editing milestone as `a993769` before starting uploads.
- Applied `20261020010000_add_beneficiary_documents` and regenerated Prisma. The database/schema comparison reports no difference.
- All 30 mobile tests, six backend tests, and three real-database integration checks pass. New checks cover file size/signatures/names, private access, exact binary downloads, repeated/concurrent deduplication, account isolation, logout/login persistence, delayed list/upload responses, failed-selection retry, upload activity, and success only after server confirmation.
- Browser and Android API paths are exercised with controlled file objects. This is not a physical-device file-picker/upload test. The mobile UI check uses controlled React hooks.
- Both TypeScript checks and web/Android exports pass. The SDK-compatible Expo file-system module is now an explicit dependency for reading native selected files; no backend upload dependency was added.
- Browser automation reports no connected browser, so the visual walkthrough and actual Android file-provider behavior still require manual checks. Mobile file preview, official requirement rules, staff review, malware scanning, and retention/deletion workflows are not implemented.

Profile editing milestone checked on October 20, 2026:

- All 22 mobile regression tests, five backend tests, and both real-database integration checks pass. New checks cover editable-field validation, active service areas, protected fields, isolation between accounts, persistence across sessions, and delayed responses after logout/account switching.
- The form check covers retained invalid drafts, duplicate-save prevention, server field errors, allowed payload fields, normalized success values, and disabling inputs while saving. It uses controlled React hooks rather than a live browser.
- Both TypeScript checks and web/Android exports pass. This feature uses existing beneficiary fields and adds no database migration or dependencies.
- The local API was restarted with the updated routes. Browser automation reports no connected browser; a manual Profile > Edit profile > Save > logout/login walkthrough and physical Android checks remain pending.
- The user reports that the preceding notification feature works.

Notification milestone checked on October 20, 2026:

- Applied `20261019010000_add_notifications`; Prisma's database/schema comparison reports no difference.
- All 16 mobile regression tests and four backend tests pass. Notification checks cover failed-read retry, refresh/read races, delayed responses after logout or account changes, unauthorized sessions, saved-message rendering, translation fallback, and the Home unread indicator.
- `npm run test:integration` in `backend/` passes against local PostgreSQL. It checks unauthenticated requests, per-beneficiary ownership, hidden SMS/queued/future messages, invalid/unknown IDs, idempotent reads, and read persistence after logout/new login. Its isolated records are removed afterward.
- Both TypeScript checks and web/Android exports pass. Android export checks compilation, not an installed application.
- Seeded two explicitly labeled historical demo notifications for `0917 555 0147`. Other accounts receive their own saved inbox or an empty state. Seed reruns preserve demo read status.
- API health and the existing Metro preview at `http://127.0.0.1:8765/` return HTTP 200. Browser automation has no connected browser, so the notification walkthrough and visual/native-device checks remain pending. Automatic staff-event creation, SMS, and OS push are outside this milestone.

Rechecked on October 19, 2026:

- `npm test`: all 10 mobile regression tests pass. Controlled requests cover delayed wallet/schedule responses after logout, switching accounts, stale/current 401 responses, unfinished session restoration, native/browser token-storage ordering, storage failures, and Wallet loading/error/empty states.
- Mobile and backend `npm run typecheck`: pass. All four backend tests pass.
- `npm run export:web` and `npm run export:android`: pass for the latest application source. The Android export remains a compilation check rather than a device test.
- Registration copy now explains server storage in English and Bisaya.
- The authenticated wallet API returned one completed claim, one PHP 1,500 transaction, and reference `GAI-2026-0828-032`. Requests without authentication and after logout returned HTTP 401. Internal QR hashes and biometric/duplicate flags were absent from the response.
- The October 2 seed schedule is now past: overview returns no upcoming schedule, wallet returns no current scheduled claim, and QR issuance returns HTTP 404. Existing wallet history remains available.
- A complete visual browser review of the latest fixes and a physical Android walkthrough are still pending. The regression tests use controlled rendering and storage rather than a native device.

Earlier milestone checks follow; the September schedule and browser-layout observations describe that earlier snapshot.

Verified locally on September 17, 2026:

- `npm run typecheck`: pass. TypeScript includes source files only, excluding generated bundles.
- `npm run export:web`: pass.
- `npm run export:android`: pass. This produces a Hermes bundle, not an installed APK or a native-device test.
- Account creation validates personal information, birth date, sex, home address, barangay, city, mobile number, and the generated development OTP across four steps before storing the authenticated session.
- Registration validation accepts Unicode letters and common Filipino name/address punctuation while rejecting numeric or punctuation-only identity and location values. Error messages update with EN/BS changes and are exposed to assistive technology as labeled, assertive alerts.
- Browser layout checks: 390 × 844 and 320 × 680. Checked English and Bisaya Home/help layouts. Compact Home adapts its header to preserve the full beneficiary name and touch targets.
- Authenticated API check: the seeded beneficiary returns one approved 4Ps enrollment and the assigned October 2, 2026 schedule with queue 47; logout revokes the test session.
- QR issuance check: two successive passes are unique, use the `GAI1` format, expire with the assigned slot, and leave one active plus one revoked hash in PostgreSQL.
- Wallet API check: the seeded beneficiary returns a PHP 1,500 assistance-ledger balance, one completed claim, and the posted receipt `GAI-2026-0828-032`. The beneficiary endpoint exposes claim and receipt data without a mobile mutation for completing claims.
- Live Metro check: the web page and latest JavaScript bundle both return HTTP 200. Home, Schedule, Enrollment status, and the schedule assistant answer now read the authenticated overview; accounts without staff-assigned records receive empty states.
- Claim-status regression check: Wallet, Transactions, Receipt, and Help read the authenticated claim and ledger records. English and Bisaya free-text status queries reflect the saved claim status; signing out clears the cached wallet data.
- Brand icon provenance: original Figma reference and SVG rasterization are embedded in `assets/icon.png`; asset scan passes.

No Android emulator, adb, or connected phone was available. Front-camera permission/capture/retake, native safe areas, keyboard resize, system Back, OS font scaling, and performance still need a physical Android check. SMS delivery, push delivery, account recovery, biometric matching/liveness, staff escalation, QR scanning, and the future staff-side atomic claim completion flow were not tested.
