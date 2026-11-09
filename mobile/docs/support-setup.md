# Talk to staff

This connects the mobile support preview to the shared staff Help conversations queue. The Help assistant continues using your saved schedule and claim data, plus general guidance. Support messages are saved for staff review; they are not instant AI replies.

1. Start the shared database, backend, mobile preview and staff website using [the integration guide](shared-backend-integration.md). Use the shared /api/v1/mobile API base; the original port-3000 backend does not have these support routes.
2. Sign in to mobile and open Help > Talk to staff.
3. Describe a concern and tap Send to staff. A saved conversation, request reference and original message appear only after server confirmation. Failed sends retain your text and reuse the same retry identifier; refresh your requests before retrying a connection failure.
4. In the staff website, sign in to an authorized same-barangay facilitator, DSWD staff or administrator account. Open [Help cases / Help conversations](http://localhost:5173/help-cases), choose Escalation inbox and refresh the page. Find your beneficiary's request, open it and reply using the existing staff controls. Another barangay's facilitator cannot access it.
5. In mobile, tap Refresh conversation to see the saved staff reply. Follow up with Send reply while the response window remains open. Messages stay in the language in which they were written; toggling EN/BS changes labels, not staff text.
6. Staff can resolve the case. Mobile refresh then shows Resolved and disables new replies. Create a new request if you still need help. Back to requests and Refresh requests reload previous concerns after a later login; use Previous/Next for longer histories.

Avoid passwords, verification codes, ID numbers and document images. The existing server redactor removes recognized credential patterns. Staff response time is not guaranteed. There is no push/background refresh, attachment upload, SMS/email or external AI in this support flow. Retention and the response window follow the staff backend's chatbot settings; the saved thread shows its retention date.

For the teammate, apply mobile-v4.patch, mobile-claims.patch, mobile-notifications.patch, mobile-sms.patch, mobile-biometrics.patch, then [mobile-support.patch](../../integrations/shared-backend/mobile-support.patch) to backend 42b4552. No additional migration or package is needed for this phase. The included backend docs/mobile-support-integration.md explains the owner-bound source marker and retry behavior. These extensions remain separate from the teammate's repository until reviewed/merged and deployed.
