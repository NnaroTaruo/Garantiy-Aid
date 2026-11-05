# Shared staff-backend integration

Phase 1 implemented locally on October 30, 2026 against Bryllando/garantiyaid-backend commit `050c389e7b75a2d0aa06fcb0eff7199c32bb1d6c`. The reviewed frontend is `e2d926838d3bb59a91a8a9ac09ee1b0eddf1ff8f`. The separate backend checkout is `shared-backend/` at this repository's root on branch `feat/mobile-beneficiary-auth`. It, its dependencies, private environment, and database files are Git-ignored.

Portable backend changes are preserved in [mobile-auth.patch](../../integrations/shared-backend/mobile-auth.patch) for teammate review. They are not merged or deployed to the team's GitHub backend.

Phase 2 was implemented locally on November 3, 2026 on backend branch `feat/mobile-document-review`: mobile documents now reach staff review, show decisions/notes, and accept corrected files. The preceding authentication milestone was committed as `c45b049` in mobile and `ce3ddc5` in the backend. Apply [mobile-documents.patch](../../integrations/shared-backend/mobile-documents.patch) after the authentication patch. The mobile implementation and patches are tracked in this repository; the separate staff backend changes have not been merged or deployed upstream.

Phase 3 adds the own-account overview used by Home, Schedule and Enrollment status. Apply [mobile-overview.patch](../../integrations/shared-backend/mobile-overview.patch) after the document patch. The existing staff workflow supplies program assignments, enrollment decisions/notes and published distribution schedules. No new migration is needed. Shared QR, wallet/claims, notifications and a general program catalog remain pending; backend changes await teammate review and deployment.

## Apply in the teammate's backend

Start from the reviewed backend commit or reconcile its newer changes, then run in that checkout:

```powershell
git switch -c feat/mobile-beneficiary-auth
git apply --check C:\Users\Ronan\Documents\Garantiy-Aid\integrations\shared-backend\mobile-auth.patch
git apply C:\Users\Ronan\Documents\Garantiy-Aid\integrations\shared-backend\mobile-auth.patch
git apply --check C:\Users\Ronan\Documents\Garantiy-Aid\integrations\shared-backend\mobile-documents.patch
git apply C:\Users\Ronan\Documents\Garantiy-Aid\integrations\shared-backend\mobile-documents.patch
git apply --check C:\Users\Ronan\Documents\Garantiy-Aid\integrations\shared-backend\mobile-overview.patch
git apply C:\Users\Ronan\Documents\Garantiy-Aid\integrations\shared-backend\mobile-overview.patch
npm ci
```

Follow `docs/mobile-auth-integration.md` included in the patch. The teammate controls shared DATABASE_URL, secrets, and data. First apply migrations to a separate development instance; do not apply the original mobile backend's migrations to the shared database.

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

The mobile API uses multipart only for the shared `/api/v1/mobile` base. Its original local backend keeps raw-byte uploads and received status. Staff can review mobile uploads because both use the same table; uploaded_by_beneficiary records the real uploader without fabricating a staff account. File contents remain private; file-viewing UI, real SMS, QR, wallet/claims, notifications, recovery, and a general program catalog are later work. Those unintegrated features still show request errors under the shared prefix. Existing staff records need a separate authorized mobile-linking workflow.

## Verified result

37 mobile regressions, TypeScript, and the final web/Android exports pass. The shared backend reports 321 passed, eight skipped, and zero failed in its default suite; all three explicit integration runs pass (backend authentication, backend documents, and the actual mobile API client) using the separate test database. Checks cover enrollment decisions, draft rescheduling/publication, earliest eligible assignment, ownership, session-local dates/venues, nullable amounts, private DTOs, logout, and the preceding document/authentication flows. Controlled headless Chrome screenshots cover Home/Schedule and 320px/390px enrollment screens including Bisaya; no horizontal overflow or browser errors remain. The user also confirmed the manual document review flow through acceptance. Physical-device testing, a complete manual staff scheduling walkthrough, live SMS, and multi-instance throughput are still pending. The staff backend has inherited schema/migration drift outside this feature, documented for separate review.
