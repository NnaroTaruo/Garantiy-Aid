# Program document checklists

This shared-backend feature lets mobile users choose the exact staff-requested document, including multiple named Other requirements. It does not decide eligibility or enroll a beneficiary.

1. In mobile, open Profile > Enrollment documents.
2. Tap View program document checklists. Choose the program your facilitator named; use Previous/Next if needed.
3. Tap the requested requirement, such as Certificate of Indigency or School Enrollment Proof. The form selects its category and name. Active programs are listed for preparation; closed programs appear only for your own existing enrollments. Ask your facilitator which applies to you.
4. Choose a PDF, JPEG or PNG up to 5 MB, then Upload document. A file is received only after the server confirms it. Staff still need to accept it.
5. Refresh documents after staff review. Rejected files offer Upload corrected document. The requested name is locked during correction so a replacement cannot be used for a different requirement.

You can also select a category manually. More document categories exposes birth/barangay/medical certificates, PWD ID and senior citizen ID. For Other requested document, enter the name exactly as staff provided it; names are limited to 150 characters. A failed upload keeps the selected file/name for retry. Checklist failures offer Refresh checklists and do not claim there are no requirements.

The original port-3000 backend keeps its original three categories and does not support this shared checklist/name flow. The shared backend uses /api/v1/mobile and an additional GET /beneficiaries/me/document-requirements route. Apply mobile-document-requirements.patch after mobile-support.patch; no extra migration or package is needed. See [shared integration](shared-backend-integration.md).

The checklist phase displays names, review status and feedback. Phase 11 adds View saved document for private preview/download; see [document viewing](document-viewing.md). Files stay private; no public file URL or staff credential is placed in the app.
