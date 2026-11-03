# Shared staff-backend integration

Phase 1 implemented locally on October 30, 2026 against Bryllando/garantiyaid-backend commit `050c389e7b75a2d0aa06fcb0eff7199c32bb1d6c`. The reviewed frontend is `e2d926838d3bb59a91a8a9ac09ee1b0eddf1ff8f`. The separate backend checkout is `shared-backend/` at this repository's root on branch `feat/mobile-beneficiary-auth`. It, its dependencies, private environment, and database files are Git-ignored.

Portable backend changes are preserved in [mobile-auth.patch](../../integrations/shared-backend/mobile-auth.patch) for teammate review. They are not merged or deployed to the team's GitHub backend.

## Apply in the teammate's backend

Start from the reviewed backend commit or reconcile its newer changes, then run in that checkout:

```powershell
git switch -c feat/mobile-beneficiary-auth
git apply --check C:\Users\Ronan\Documents\Garantiy-Aid\integrations\shared-backend\mobile-auth.patch
git apply C:\Users\Ronan\Documents\Garantiy-Aid\integrations\shared-backend\mobile-auth.patch
npm ci
```

Follow `docs/mobile-auth-integration.md` included in the patch. The teammate controls shared DATABASE_URL, secrets, and data. First apply migrations to a separate development instance; do not apply the original mobile backend's migrations to the shared database.

## Test this workspace

The local shared `.env` targets a separate embedded PostgreSQL instance on port 51234, distinct from the original backend's 51214. The ignored, workspace-specific helper `.tmp/start-shared-db.mjs` starts it using the already-installed Prisma runtime. If needed, run from this repository's root in a separate terminal:

```powershell
$env:LOCALAPPDATA='C:\Users\Ronan\Documents\Garantiy-Aid\.tmp\local-app-data'
node .tmp/start-shared-db.mjs
```

After that database is running and the shared checkout is migrated:

```powershell
cd C:\Users\Ronan\Documents\Garantiy-Aid\shared-backend
$env:RUN_MOBILE_DB_TESTS='1'
$env:AUTH_RATE_LIMIT_PER_15_MINUTES='100'
npm run test:mobile:integration
```

From `mobile/`, run `npm run test:shared` to exercise the actual TypeScript mobile API module against the shared Express API and database. It uses an ephemeral HTTP port and removes its synthetic records afterward. It verifies registration, OTP login, profile read/edit, shared staff visibility, field errors, and logout revocation. No SMS or browser is involved.

## Browser or phone preview

With the shared API running on port 4000 and active service areas configured, open a separate terminal:

```powershell
cd C:\Users\Ronan\Documents\Garantiy-Aid\mobile
$env:EXPO_PUBLIC_API_URL='http://127.0.0.1:4000/api/v1/mobile'
npm run web -- --port 8765
```

This process override preserves the original `.env`. Use `http://10.0.2.2:4000/api/v1/mobile` for an emulator or your computer's LAN IP for Expo Go. CORS must include the browser's exact origin. To return to the older backend, run `Remove-Item Env:EXPO_PUBLIC_API_URL` in that terminal and restart Expo. Tokens from the other backend are rejected and cleared on restoration.

Create a new fictional account with a unique phone, enter the development OTP, skip optional face enrollment, and open Profile. Staff using the same shared backend see that beneficiary and its saved profile edits. Login, restoration, and logout use shared sessions.

Only registration, OTP, sessions/logout, active barangays, profile loading, and profile editing are integrated. Other tabs require shared endpoints and show their request errors until later milestones. Phone verification does not approve eligibility; existing staff records need an authorized linking workflow. Real SMS, documents/review, schedules, QR, wallet/claims, notifications, and recovery remain later work. The older mobile backend remains available for its previously completed features.

## Verified result

31 mobile regressions and mobile TypeScript pass. The shared backend suite reports 320 passed, seven skipped, and zero failed; both separately invoked HTTP/database integration suites pass. Staff list/detail APIs see mobile-created records and edits. No browser-layout, physical-device, live SMS, or multi-instance throughput result is implied. The original database still matches its schema. The staff repository has inherited migration/schema differences outside the new auth tables, documented in the backend handoff, for separate review.
