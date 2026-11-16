# AI Biometric Authentication checklist

Checked November 16, 2026 against the Android beneficiary app and the staff web/backend integration. Beneficiaries sign in by phone code. Face verification is used for identity checks during claiming, and capture is staff-assisted.

| # | Module requirement | What is implemented |
| --- | --- | --- |
| 1 | Register Face | Beneficiaries can give and withdraw consent and view status on mobile. An assigned Barangay Facilitator registers the face profile on the staff website after consent. |
| 2 | Capture Face | The staff website has camera capture and retake controls. The mobile app does not take selfies. Physical camera testing remains pending. |
| 3 | Liveness Detection | Staff verification calls the configured processor before accepting a match. Remote DeepFace anti-spoof requests are implemented; the current demo uses simulation and does not prove spoof resistance. |
| 4 | Verify Identity | DSWD Staff and assigned facilitators can verify a face for a claim when the event allows biometrics. The verification workflow is testable in simulation. |
| 5 | Match Against Database | A claim capture is compared against the selected beneficiary's saved template. Real matching with camera captures remains unverified. |
| 6 | Detect Duplicate Face | Enrollment checks for similar active templates and holds a possible duplicate for admin or DSWD review. The workflow is tested with synthetic input; real duplicate accuracy remains unverified. |
| 7 | Flag Unrecognized Face | A failed comparison is recorded as **No match**, and verification does not pass. Staff can review the attempt and retry. This checks the selected person's identity rather than identifying an unknown person. |
| 8 | Re-enroll Face | Admins and assigned facilitators can replace an eligible template using valid consent. Mobile shows the updated enrollment status. |

The focused checks passed: 17 backend biometric checks, nine staff UI/API checks, four mobile consent regressions, and the mobile HTTP/PostgreSQL integration. They cover encrypted templates, roles, synthetic matches and mismatches, duplicate handling, and consent flowing from mobile to staff. They use synthetic inputs or mocked remote responses. The broader simulated claim test did not finish successfully: its cleanup failed on a test database foreign-key constraint. Real camera tests were not run.

To finish real biometric validation, connect the staff workspace and Android app to the same test backend. Configure the real processor and test with consenting volunteers: two live captures of the same person, a different person, an attempted photo or screen replay, duplicate enrollment, and re-enrollment. See [face consent and staff enrollment](biometrics-setup.md).
