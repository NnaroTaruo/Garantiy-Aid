# User Account & Access Management checklist

Checked November 16, 2026 against the beneficiary Android app and the local staff web/backend integration. The hosted Android preview uses a separate test backend, and the staff website has not been connected to it for a joint demo.

| # | Module requirement | Beneficiary Android app | Staff website |
| --- | --- | --- | --- |
| 1 | Register Account | **Works in demo.** Enter personal details and address, then verify a phone code. | Staff do not self-register. A System Administrator creates staff accounts. |
| 2 | Login Account | **Works in demo.** Enter the registered phone number and its code. | **Works locally.** System Administrator, DSWD Staff, and Barangay Facilitator use their staff credentials and an authenticator code. |
| 3 | Logout | **Works.** The server revokes the session and the app returns to the welcome screen. | **Works locally.** The signed-out session no longer grants access. |
| 4 | Email / OTP Verification | **Demo code works.** OTP is the selected method; real SMS delivery is still pending. | Staff authenticate with an authenticator app for item 11. |
| 5 | Manage Profile | **Works.** A beneficiary can update their own name, address, and barangay. | **Works locally.** Staff can update permitted fields in My account & security. |
| 6 | Change Password | **Not applicable.** Beneficiaries sign in with phone codes. | **Works locally.** Staff enter their current password and a fresh authenticator code. |
| 7 | Forgot / Reset Password | **Not applicable.** Recover account requests a login code for the registered phone; changing a lost number is a separate process. | **Implemented.** Reset token expiry, single use, and session revocation are tested. Real reset email arrival must be verified on the staff deployment. |
| 8 | Role-Based Access Control | **Works.** Beneficiary sessions can access their own records and cannot use staff endpoints. | **Works locally.** The server checks staff roles; a non-admin cannot manage staff accounts. |
| 9 | Manage User Accounts | Administrative action. | **Works locally.** A System Administrator can create, list, and edit DSWD Staff and Barangay Facilitator accounts. |
| 10 | Activate / Deactivate Account | Administrative action in this checklist. | **Works locally.** A System Administrator can deactivate and reactivate staff accounts. Deactivation revokes their sessions. |
| 11 | Two-Factor Authentication (TOTP) | **Not applicable.** A beneficiary phone code is the sign-in method. | **Works locally.** Staff enroll an authenticator and use fresh codes after entering their password. |

Verification: 78 mobile regressions, 28 staff backend account/security tests, nine staff frontend contract tests, and five mobile SMS tests passed. The mobile client integration and a separate staff HTTP walkthrough passed against isolated PostgreSQL. The SMS tests use a simulated gateway response; the staff walkthrough did not send email.

For the capstone demo, create a fictional beneficiary, verify the displayed demo code, edit the profile, sign out, and sign back in. On the staff system, use a test administrator and a disposable staff account to demonstrate creation, password and authenticator setup, and deactivation. When the hosted staff website and Android preview use the same test backend, confirm the Android registration appears in **Beneficiary records**. Follow the [SMS setup guide](sms-setup.md) for real phone verification.
