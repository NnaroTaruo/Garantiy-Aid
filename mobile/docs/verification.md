# Frontend verification

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
