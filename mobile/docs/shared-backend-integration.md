# Shared staff-backend integration

Updated on November 9, 2026 to staff frontend `f6dfcdf` (FRONTEND 4.0) and backend `42b4552` (BACKEND v4.0). The existing frontend directory remains `.tmp/web-integration-review-20261030/frontend`; the backend remains `shared-backend/`, now on local branch `feat/mobile-web-v4-integration`. Both upstream repositories remain separate from this mobile repository. Private environment values, mobile secrets, existing accounts and uploaded files are preserved; a private data snapshot and the previous backend work are retained under `.tmp/v4-update-20261109/` and in the backend's stash.

Use [mobile-v4.patch](../../integrations/shared-backend/mobile-v4.patch) directly on backend `42b4552`. It includes all four mobile phases plus compatibility with the upstream transaction adapter, UPLOAD_ROOT, named/removed documents, physical-package rules and QR_OR_BIOMETRIC. Do not also apply the older phase patches to version 4. Source updates do not import the teammate's database or connect to a hosted backend. The local extension has not been pushed or merged into the teammate's repositories.

The following phase history describes the original version-3 base. Phase 1 was implemented locally on October 30, 2026 against backend `050c389e7b75a2d0aa06fcb0eff7199c32bb1d6c` and frontend `e2d926838d3bb59a91a8a9ac09ee1b0eddf1ff8f`. The backend checkout, dependencies, private environment, and database files are Git-ignored.

Portable backend changes are preserved in [mobile-auth.patch](../../integrations/shared-backend/mobile-auth.patch) for teammate review. They are not merged or deployed to the team's GitHub backend.

Phase 2 was implemented locally on November 3, 2026 on backend branch `feat/mobile-document-review`: mobile documents now reach staff review, show decisions/notes, and accept corrected files. The preceding authentication milestone was committed as `c45b049` in mobile and `ce3ddc5` in the backend. Apply [mobile-documents.patch](../../integrations/shared-backend/mobile-documents.patch) after the authentication patch. The mobile implementation and patches are tracked in this repository; the separate staff backend changes have not been merged or deployed upstream.

Phase 3 adds the own-account overview used by Home, Schedule and Enrollment status. Apply [mobile-overview.patch](../../integrations/shared-backend/mobile-overview.patch) after the document patch. The existing staff workflow supplies program assignments, enrollment decisions/notes and published distribution schedules. No new migration is needed. Shared QR, wallet/claims, notifications and a general program catalog remain pending; backend changes await teammate review and deployment.

Phase 4 on November 5 connects mobile-issued QR passes to the existing staff verifier. Apply [mobile-qr.patch](../../integrations/shared-backend/mobile-qr.patch) after the overview patch; no migration or dependency is added. Own-account issuance reuses published-assignment eligibility and staff verification rules. Reopening preserves the same credential. Revoked, expired, used and separately staff-issued passes are not replaced. The mobile screen supports refresh and clear EN/BS feedback, hides expired QR codes, and isolates pending responses after logout or account changes. Staff still verify identity and release assistance; shared mobile wallet/claim views, notifications, real SMS, biometrics and a general program catalog remain pending.

Phase 5 on November 9 adds [mobile-claims.patch](../../integrations/shared-backend/mobile-claims.patch) after the version-4 patch. It connects the existing mobile Wallet view to own-account claim status, physical-release history, package/quantity, release timestamps, receipt numbers, review indicators, existing wallet summaries and claim-linked credit/reversal ledger entries. The route is read-only and does not create wallets, claims, releases or transactions. Physical goods remain claims. No new migration or dependency is needed. Notifications and transfer history remain later phases; changes are local and not deployed upstream.

## Apply in the teammate's backend

For version 4.0, use a clean checkout of backend `42b4552`, then run:

```powershell
git switch -c feat/mobile-beneficiary-auth 42b4552
git apply --check C:\Users\Ronan\Documents\Garantiy-Aid\integrations\shared-backend\mobile-v4.patch
git apply C:\Users\Ronan\Documents\Garantiy-Aid\integrations\shared-backend\mobile-v4.patch
git apply --check C:\Users\Ronan\Documents\Garantiy-Aid\integrations\shared-backend\mobile-claims.patch
git apply C:\Users\Ronan\Documents\Garantiy-Aid\integrations\shared-backend\mobile-claims.patch
npm ci
```

Follow `docs/mobile-v4-integration.md`, `docs/mobile-auth-integration.md` and `docs/mobile-claims-integration.md` included in the patches. The teammate controls shared DATABASE_URL, secrets, and data. First apply migrations to a separate development instance; do not apply the original mobile backend's migrations to the shared database. Do not reset or reseed an existing database. For the historical version-3 base only, the four original phase patches still apply in authentication/documents/overview/QR order.

## Test this workspace

The local shared `.env` targets a separate embedded PostgreSQL instance on port 51234, distinct from the original backend's 51214. The ignored, workspace-specific helper `.tmp/start-shared-db.mjs` starts it using the already-installed Prisma runtime. If needed, run from this repository's root in a separate terminal:

```powershell
$env:LOCALAPPDATA='C:\Users\Ronan\Documents\Garantiy-Aid\.tmp\local-app-data'
node .tmp/start-shared-db.mjs
```

Automated checks use a separate migrated test instance. In this workspace its helper starts PostgreSQL on 51244; run it in another terminal from the repository root:

```powershell
$env:LOCALAPPDATA='C:\Users\Ronan\Documents\Garantiy-Aid\.tmp\local-app-data'
node .tmp/start-shared-test-db.mjs
```

Use a dedicated test terminal for the override below. The running browser API keeps its own `.env` and database at 51234. On another machine, use a separately provisioned test PostgreSQL database instead of these ignored workspace helpers.

```powershell
cd C:\Users\Ronan\Documents\Garantiy-Aid\shared-backend
$env:DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:51244/template1?sslmode=disable'
npm.cmd run prisma:migrate:deploy
$env:RUN_MOBILE_DB_TESTS='1'
$env:AUTH_RATE_LIMIT_PER_15_MINUTES='100'
npm run test:mobile:integration
npm run test:mobile:documents
```

Run these database suites sequentially. If selecting both files directly with Node against embedded Prisma, use `node --test --test-concurrency=1 test/mobile-auth.integration.js test/mobile-documents.integration.js`.

From `mobile/` in that test terminal, run `npm.cmd run test:shared` to exercise the actual TypeScript mobile API module against the shared Express API and test database. It uses an ephemeral HTTP port and removes its synthetic records afterward. It verifies registration, OTP login, profile read/edit, staff visibility, document review/corrections, staff enrollment submission/review/approval, draft scheduling/rescheduling/publication, schedule eligibility and earliest selection, account isolation, private response fields, and logout revocation. No SMS or browser is involved.

## Browser or phone preview

With the shared API running on port 4000 and active service areas configured, open a separate terminal:

```powershell
cd C:\Users\Ronan\Documents\Garantiy-Aid\mobile
$env:EXPO_PUBLIC_API_URL='http://127.0.0.1:4000/api/v1/mobile'
npm run web -- --port 8765
```

This process override preserves the original `.env`. Use `http://10.0.2.2:4000/api/v1/mobile` for an emulator or your computer's LAN IP for Expo Go. CORS must include the browser's exact origin. To return to the older backend, run `Remove-Item Env:EXPO_PUBLIC_API_URL` in that terminal and restart Expo. Tokens from the other backend are rejected and cleared on restoration.

Create a new fictional account with a unique phone, enter the development OTP, skip optional face enrollment, and open Profile. Staff using the same shared backend see that beneficiary and its saved profile edits. Login, restoration, and logout use shared sessions.

If signup uses a phone that already has a verified mobile account, it requests a login code and verifies it as login, opening Home. An unfinished account continues registration verification. A matching beneficiary under another phone remains blocked until the user signs in with the registered phone or staff complete an authorized account-linking process.

Registration, OTP, sessions/logout, active barangays, profile read/edit, private document intake/review/corrections, and assigned program/enrollment/schedule information are integrated locally. In Profile > Enrollment documents, choose a category and sample PDF/image, upload, then have authorized staff review it through their existing document screen/API. Refresh documents to see Accepted or Rejected plus staff feedback. A rejected record offers Upload corrected document; choose a corrected file in the same category and submit. The old record becomes Replaced, and the new one waits for review. You can cancel correction or retry a failed upload without losing the selected file. The user confirmed that document flow through staff acceptance in the local browser.

For the new overview, tap Home > Refresh schedule or Profile > Enrollment status > Refresh status. Accounts without assignments show empty states. Authorized staff submit program enrollments; a different reviewer can request corrections or approve them. The mobile displays the exact staff notes, review date, and localized enrollment status. An unspecified grant amount displays Not specified rather than zero. Authorized staff prepare allocations and schedules while a distribution is draft, then open the event; only eligible published assignments appear on mobile. The displayed date/time and venue belong to the assigned session, including sessions on a different day or at a different venue. See the backend patch's `docs/mobile-overview-integration.md` for the selection rules and manual walkthrough.

For QR, open Schedule > Open my QR claim pass after staff publish an eligible QR-enabled assignment. Check session date/time, venue, queue and expiry. Refresh reopens the same mobile-issued credential. Have an authorized administrator/facilitator preview and verify it in that distribution through the staff workflow. QR_AND_BIOMETRIC still requires biometrics; QR-only verification stops at VERIFIED. Neither pass issuance nor QR verification itself releases assistance or credits a wallet. Administrator revocation is respected on refresh; separately staff-issued/reissued passes require staff delivery. See the fourth patch's `docs/mobile-qr-integration.md` for the security contract and complete manual check.

Version 4 also supports QR_OR_BIOMETRIC: QR alone can complete verification for that explicitly configured requirement. New physical-assistance events require package name, unit and quantity before opening. Staff-removed documents disappear from the mobile list and cannot be downloaded or reused by duplicate upload matching; corrections retain a named Other requirement. Selecting individual named Other requirements in the mobile form remains later work. The user manually confirmed enrollment approval, published scheduling and mobile QR display, then created the fresh LOCAL TEST - Mobile QR Test 2 event for November 10. Administrator manual entry successfully verified its mobile-issued credential; mobile refresh hid the used QR and staff rejected reuse. The facilitator then recorded a clearly labelled simulated release of one test food pack with LOCAL-TEST-RELEASE-001 evidence and issued its receipt. Exactly one claim is now CLAIMED with one saved receipt snapshot, facilitator/timestamp/package attribution and no wallet transactions; no actual goods or money moved. Camera verification, receipt printing and its verification QR remain untested; the old November 7 event is a separate expired test.

The mobile API uses multipart only for the shared `/api/v1/mobile` base. Its original local backend keeps raw-byte uploads and received status. Staff can review mobile uploads because both use the same table; uploaded_by_beneficiary records the real uploader without fabricating a staff account. File contents remain private; file-viewing UI, real SMS, notifications, transfer history, recovery, and a general program catalog are later work. Those unintegrated features still show request errors under the shared prefix. Existing staff records need a separate authorized mobile-linking workflow.

## Verified result

On November 9, version-4 frontend checks report 202 tests passed plus lint/build success. The backend reports 409 passed, eight skipped and zero failed; both explicit authentication/document database suites pass sequentially. All 39 mobile regressions, TypeScript, and the actual mobile TypeScript-client/database suite pass against the updated checkout. QR coverage includes concurrent initial issuance/reopening, hash/audit privacy, owner isolation, eligibility, expiry, revocation, separate staff reissue, a synthetic biometric-first pending state, QR-first pending biometrics, QR-only verification, QR_OR_BIOMETRIC preview, staff idempotency/duplicates, and no wallet credit. The consolidated version-4 patch reproduces all 29 mobile backend files on a fresh upstream checkout. All eight upstream migrations applied successfully to the separate test database and existing development database; existing application rows and private environment values were verified unchanged.

Phase 5 checks pass: 41 mobile regressions, TypeScript, the actual client/API/database suite, web and Android exports, and seven controlled Chrome views at 320/390 widths in EN/BS with no page errors or horizontal overflow. API coverage now includes actual staff release and receipt issuance, historical statuses, review flags, account isolation, nullable wallets and signed synthetic claim-linked ledger fixtures. Both backend patches apply in order on a clean upstream checkout and reproduce the three phase-5 files. Synthetic ledger fixtures verify read mapping, not end-to-end simulated settlement. No new migrations or dependencies were added.

The user confirmed manual document review through acceptance, enrollment approval, published scheduling, mobile QR display, administrator manual QR verification, mobile used-pass hiding, staff duplicate rejection, a simulated facilitator release record and receipt issuance/preview. To see the shared release in mobile, open Wallet > Refresh records. Staff camera verification, an actual handover, physical-device networking, receipt printing/verification QR, live SMS, and multi-instance throughput remain untested. Shared notifications and transfer history remain later work. The staff backend has inherited schema/migration drift outside this feature, documented for separate review.
