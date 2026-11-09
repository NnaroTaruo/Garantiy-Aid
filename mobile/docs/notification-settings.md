# Saved notification settings

1. Sign in using the shared staff backend, then open Profile > Notification settings.
2. Wait for the settings saved to your account to load.
3. Choose Enrollment updates, Schedule updates, and Claim and release updates.
4. Tap Save preferences. Wait for Preferences saved to your account before leaving.
5. Reopen the screen or sign out/in to check the saved values. Future automatic staff updates follow those settings; existing inbox messages remain available.

A failed save keeps your choices for retry. Settings are owned by the signed-in account and do not change another beneficiary's messages. Re-enabling a category does not generate alerts for earlier suppressed events. These preferences apply to automatic enrollment/schedule/claim IN_APP messages, not staff broadcasts or sign-in codes. The original mobile backend does not implement this endpoint and shows unavailable.

Apply `mobile-notification-preferences.patch` after `mobile-document-viewing.patch` in the shared backend, then run Prisma generate and migrate deploy. Its additive migration defaults the three settings to enabled, preserving existing behavior. There is no new package. See [shared integration](shared-backend-integration.md).

SMS reminders are still inactive. Phase 13 adds an optional **Phone alerts** card on this screen. It is a separate per-phone opt-in, and those alerts follow the categories saved above. Android's permission prompt appears only after you tap **Turn on phone alerts**. Alert text is generic and never shows names, programs or amounts. Delivery requires the account setup and a development or release build described in [Android phone alerts](push-notifications.md). Real phone delivery has not been validated yet. [Expo's SDK 57 notification reference](https://docs.expo.dev/versions/v57.0.0/sdk/notifications/) explains the Expo Go limitation. The in-app inbox works in the browser without that setup.
