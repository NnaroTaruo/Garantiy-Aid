# GarantiyAid

<!-- impeccable:product-schema 1 -->

## Platform

android

## Stack

React Native with Expo, as specified by the capstone manuscript. The mobile app uses TypeScript and Expo Router. Its supporting local REST API uses Node.js, Express, Prisma, and PostgreSQL. Registration, phone OTP access, profiles, enrollments, schedules, QR issuance, and read-only claim and wallet records are connected. Integration with the team's staff web workflow remains open.

## Users

Social welfare beneficiaries in selected Cebu City barangays. Ronan is responsible for mobile development. Staff, facilitators, and administrators use the team's web application.

## Product Purpose

Help beneficiaries register, view an assigned distribution schedule and queue number, present a QR claim pass, and view claim records and updates.

## Operating Context

The manuscript proposes one REST backend shared by the mobile and web apps. The supplied ERD defines beneficiaries, schedules, QR tokens, claims, notifications, enrollment, documents, consent, wallet accounts, and transactions. The local API now provides the beneficiary-facing account and record endpoints. Authorized staff scheduling actions, QR scanning, identity verification, and atomic claim completion still need to be integrated through the shared backend and staff web application.

## Capabilities and Constraints

As of October 19, 2026, account creation collects personal identity, birth date, sex, home address, barangay/service area, city, and mobile number. Registration submits the beneficiary details to PostgreSQL before OTP verification. Generated phone OTP codes support registration and sign-in in development; SMS delivery is not connected. Session restoration, protected tabs, logout, and stored profile details use the backend. Session guards discard obsolete responses after logout or account switching.

Program enrollment, assigned schedules, server-issued expiring QR passes, claim status, wallet history, transaction receipts, and the in-app notification inbox use saved account records. Notification read timestamps persist across sessions; cached messages and delayed responses are isolated by account. The beneficiary app displays staff-assigned records and cannot approve its own claims. The wallet is an assistance ledger; it does not hold or transfer funds. The seed provides fictional local test records with fixed dates and labeled demo notifications rather than a live government distribution feed.

Automatic notification creation by staff events, SMS/push delivery and preferences, required-document uploads, profile changes, password/account recovery, live staff escalation, and real biometric matching/liveness remain unconnected. Face consent and camera capture are optional previews; captures are not uploaded. Help uses saved schedules and claim status, while other answers remain fixed preview responses. No government database connection or live payment integration is in scope. Web and Android exports pass, but a complete visual review of the latest fixes and physical Android validation remain pending.

## Brand Commitments

The user's Figma mobile screens are the visual authority: https://www.figma.com/design/tZEG9H4ZRsP86KvhBjtd3X/Garantiy-Aid?node-id=0-1. Preserve their blue and green identity, pale background, shield logo, compact forms, claiming card, and Home/Wallet/Help/Profile navigation. Reproduce the screen content inside the device frame; the Figma phone housing and canvas annotations are not application chrome. No replacement visual identity is requested.

## Evidence on Hand

User-supplied manuscript: C:/Users/Ronan/Downloads/GarantiyAid-Capstone30-Manuscript1.pdf. User-supplied ERD: C:/Users/Ronan/Downloads/ERD.jpg. Publicly viewable Figma includes 30 mobile frames covering the primary flow, recovery, enrollment, privacy, chat scenarios, and exception states. Precise Figma fonts and downloadable logo assets are unavailable to the anonymous inspector; Inter and a small recreated vector mark are implementation assumptions.

## Accessibility & Inclusion

English/Bisaya selection, readable text, phone-sized layouts, keyboard-safe forms, system Back support, and at least 48 dp touch targets. Phone is the initial supported layout; tablets are not a release target yet.
