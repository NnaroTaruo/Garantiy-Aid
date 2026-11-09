# View saved documents

1. Sign in to mobile and open Profile > Enrollment documents.
2. Under Uploaded documents, tap View saved document on your own file.
3. Images display in the app. In a browser, PDFs use its built-in viewer; use Download a copy if that viewer is unavailable. On Android, tap Open or save a copy and choose an installed PDF viewer or save destination.
4. Close document returns to the list. If staff removed a file, close the view and refresh documents. A connection failure offers Try again; an expired session returns you to sign-in.

Only saved PDF/JPEG/PNG files up to 5 MB are supported. The app fetches through the existing authenticated endpoint and checks MIME, recorded size and file signature before opening. It never exposes a public storage path or puts a bearer token in a URL. Browser previews use temporary blob URLs; Android uses app-cache files. Closing or leaving the account attempts cleanup and discards delayed results. Native leftovers after a process interruption are removed on the next preview. Copies you explicitly download/save outside GarantiyAid remain on that device or app after sign-out.

Both the original mobile API and shared staff API use this viewer. The shared backend needs `mobile-document-viewing.patch` after `mobile-document-requirements.patch` so it serves the upload-validated MIME rather than guessing from the filename. No database migration is added. See [shared integration](shared-backend-integration.md).

The SDK-57-compatible `expo-sharing` dependency opens the Android system chooser. Run `npm.cmd ci` inside mobile after updating the checkout. Use Expo Go for the project's SDK; rebuild an existing custom development client when adding the native module. Web uses a blob download and does not need native sharing. Automated checks cover the native calls with mocks and compile the Android bundle; a physical-phone test of the chooser, available viewers, cache cleanup and account switching is still pending.
