# Beneficiary Enrollment & Management checklist

Checked November 16, 2026 against the Android beneficiary app and the local staff system with a shared test database.

| # | Module requirement | Staff website | Beneficiary Android app |
| --- | --- | --- | --- |
| 1 | Register Beneficiary | System Administrators and Barangay Facilitators can create records. Facilitators register within their assigned barangay. | New beneficiaries can create their own record with phone-code signup. Staff can then find that record on the same backend. |
| 2 | Upload Documents | Admins and facilitators upload; admins and DSWD Staff review. | Beneficiaries can upload their own documents, see review results, and replace documents marked for correction. |
| 3 | Assign to Program | All three staff roles can submit a beneficiary to an active program for review. Required documents and application dates are checked. | Beneficiaries can track the submitted enrollment. Applying or assigning from the app is not part of this flow. |
| 4 | View Beneficiary List | All three staff roles can open the registry. A facilitator sees their assigned barangay. | Beneficiaries can view their own record. |
| 5 | Search / Filter Records | Staff can search and filter by status. Admins and DSWD Staff can filter by barangay; facilitators are already scoped to theirs. | The staff registry is not exposed on mobile. |
| 6 | Edit Beneficiary Records | Admins and facilitators can edit records. Facilitators cannot change barangay assignments or lifecycle status. | Beneficiaries can edit their own allowed profile fields and see saved changes from staff when using the same backend. |
| 7 | Verify Eligibility | Staff can see the program criteria and results. Approval requires every mandatory rule and accepted required documents; authorized reviewers record manual decisions where needed. | Beneficiaries see their enrollment status and review notes. Eligibility is decided on the staff website. |
| 8 | Approve / Reject Enrollment | An admin or DSWD reviewer can approve, request correction, or reject with a reason. The person who submitted the case cannot review it. | The beneficiary can see the resulting status and review note in **Enrollment status**. |

Verification: 56 backend checks, three staff client contract checks, and both real HTTP/PostgreSQL integration suites passed. The shared-client suite confirms staff registration, search/filter, a staff edit reflected on mobile, eligibility results, and both approval and rejection. Document tests cover upload, correction, acceptance, and access boundaries.

For the demo, register a new fictional beneficiary **on mobile first**, upload an example document, and find the beneficiary in **Beneficiary records** on the staff website. Have one staff user submit an enrollment and a different authorized user review it; then refresh **Enrollment status** on mobile. This workflow requires both clients to use the same backend. The hosted APK still uses the separate Railway test backend.

Staff-created records do not automatically receive a mobile login. Staff-verified linking of an existing record to mobile is separate work. Use the existing mobile account when one is already linked.
