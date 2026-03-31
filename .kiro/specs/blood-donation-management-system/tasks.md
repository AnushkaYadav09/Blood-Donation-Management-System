# Tasks: Blood Donation Management System

## Task List

- [x] 1. Project Setup and Infrastructure
  - [x] 1.1 Initialize Node.js/Express backend project with TypeScript
  - [x] 1.2 Initialize React frontend project with TypeScript
  - [x] 1.3 Set up PostgreSQL database with PostGIS extension
  - [x] 1.4 Create database schema (all tables and indexes from design.md)
  - [x] 1.5 Configure Docker Compose for local development (app, db, nginx)
  - [x] 1.6 Set up Jest and fast-check for backend testing
  - [x] 1.7 Configure environment variables and secrets management

- [x] 2. Donor Authentication and Account Management
  - [x] 2.1 Implement donor registration endpoint (POST /api/donors/register) with field validation
  - [x] 2.2 Implement email uniqueness check (GET /api/donors/check-email/:email)
  - [x] 2.3 Implement password hashing with bcrypt (salted)
  - [x] 2.4 Implement donor login endpoint (POST /api/donors/login) with JWT issuance
  - [x] 2.5 Implement account lockout after 5 failed login attempts (15-minute lock)
  - [x] 2.6 Implement JWT middleware for protected route authentication
  - [x] 2.7 Implement session expiry (30-minute JWT TTL with activity-based refresh)
  - [x] 2.8 Implement password reset flow (generate time-limited link, validate, update)
  - [x] 2.9 Implement re-authentication requirement for email/password changes
  - [x] 2.10 Write unit tests for authentication flows (login, lockout, reset)
  - [x] 2.11 Write property test for P14: unauthenticated requests to protected endpoints are rejected
    - Tag: `Feature: blood-donation-management-system, Property 14: Unauthenticated requests to protected endpoints are rejected`

- [x] 3. Donor Registration
  - [x] 3.1 Implement registration form UI with all required fields (name, blood group, phone, email, DOB, gender, location)
  - [x] 3.2 Implement blood group dropdown (A+, A-, B+, B-, AB+, AB-, O+, O-)
  - [x] 3.3 Implement gender dropdown (Male, Female, Other)
  - [x] 3.4 Implement frontend validation (required fields, email format, age >= 18)
  - [x] 3.5 Implement confirmation email sending on successful registration (Nodemailer)
  - [x] 3.6 Write property test for P1: registration rejects underage dates of birth
    - Tag: `Feature: blood-donation-management-system, Property 1: Registration rejects underage donors`
  - [x] 3.7 Write property test for P2: registration rejects invalid/incomplete payloads
    - Tag: `Feature: blood-donation-management-system, Property 2: Registration validates required fields`
  - [x] 3.8 Write unit test for duplicate email rejection (Requirement 1.3)
  - [x] 3.9 Write unit test for confirmation email sent on successful registration (Requirement 1.7)

- [x] 4. Eligibility Screener
  - [x] 4.1 Implement screening questionnaire API (POST /api/donors/:id/screening)
  - [x] 4.2 Implement weight validation (reject < 50 kg)
  - [x] 4.3 Implement age validation from stored date of birth (reject < 18)
  - [x] 4.4 Implement communicable disease disqualification logic
  - [x] 4.5 Implement pregnancy and breastfeeding disqualification logic (female donors only)
  - [x] 4.6 Implement donation interval check (3 months male, 4 months female)
  - [x] 4.7 Implement eligibility status endpoint (GET /api/donors/:id/eligibility)
  - [x] 4.8 Implement screening questionnaire UI with all required fields and dropdowns
  - [x] 4.9 Write property test for P3: disqualifying health conditions result in ineligibility
    - Tag: `Feature: blood-donation-management-system, Property 3: Eligibility disqualification for health conditions`
  - [x] 4.10 Write property test for P4: weight below 50 kg results in ineligibility
    - Tag: `Feature: blood-donation-management-system, Property 4: Eligibility rejects low weight donors`
  - [x] 4.11 Write property test for P5: donation within minimum interval results in ineligibility
    - Tag: `Feature: blood-donation-management-system, Property 5: Eligibility rejects donors within minimum donation interval`

- [x] 5. Donation History Tracking
  - [x] 5.1 Implement record donation endpoint (POST /api/donations)
  - [x] 5.2 Implement get donation history endpoint (GET /api/donors/:id/donations) sorted descending
  - [x] 5.3 Implement next eligible date calculation endpoint (GET /api/donors/:id/next-eligible-date)
  - [x] 5.4 Implement eligibility status update when donation is recorded
  - [x] 5.5 Implement donation history UI on donor profile page (reverse chronological, total count, next eligible date)
  - [x] 5.6 Write property test for P6: donation history returned in reverse chronological order
    - Tag: `Feature: blood-donation-management-system, Property 6: Donation history is returned in reverse chronological order`
  - [x] 5.7 Write property test for P7: next eligible date is exactly 3/4 months after donation
    - Tag: `Feature: blood-donation-management-system, Property 7: Next eligible date calculation is correct`
  - [x] 5.8 Write property test for P8: donation count matches stored record count
    - Tag: `Feature: blood-donation-management-system, Property 8: Donation count matches stored records`
  - [x] 5.9 Write unit test for eligibility status update after donation (Requirement 3.4)

- [x] 6. Location-Based Blood Bank Discovery
  - [x] 6.1 Implement nearby blood banks endpoint (GET /api/blood-banks/nearby) using PostGIS distance sorting
  - [x] 6.2 Implement blood bank search by city/postal code (GET /api/blood-banks/search)
  - [x] 6.3 Implement blood bank detail endpoint including name, address, distance, hours, contact
  - [x] 6.4 Implement browser Geolocation API integration in frontend
  - [x] 6.5 Implement manual location entry fallback UI
  - [x] 6.6 Implement map view with directions using Leaflet (blood bank detail page)
  - [x] 6.7 Write property test for P9: blood bank search results sorted by distance
    - Tag: `Feature: blood-donation-management-system, Property 9: Blood bank search results are sorted by distance`
  - [x] 6.8 Write unit test for blood bank detail response containing all required fields (Requirement 4.4)

- [x] 7. Hospital Portal and Donor Interaction
  - [x] 7.1 Implement hospital registration and authentication (POST /api/hospitals/login)
  - [x] 7.2 Implement donor search endpoint for hospitals (GET /api/hospitals/donors/search) with blood group, radius, and eligibility filters
  - [x] 7.3 Implement opt-in filtering (only donors with allow_hospital_contact=true appear in results)
  - [x] 7.4 Implement privacy masking (exclude phone/email from search results before acceptance)
  - [x] 7.5 Implement contact request endpoint (POST /api/hospitals/contact-requests)
  - [x] 7.6 Implement donor accept/decline endpoint (PUT /api/donors/:id/contact-requests/:requestId)
  - [x] 7.7 Implement contact request notification (email + SMS to donor on hospital request)
  - [x] 7.8 Implement hospital portal UI (search, results, contact request flow)
  - [x] 7.9 Write property test for P10: donor search respects all filters and privacy rules
    - Tag: `Feature: blood-donation-management-system, Property 10: Donor search respects all filters and privacy rules`
  - [x] 7.10 Write unit test for contact request notification sent to donor (Requirement 5.3)

- [x] 8. Donor Availability Toggle
  - [x] 8.1 Implement availability toggle endpoint (PUT /api/donors/:id/availability)
  - [x] 8.2 Implement availability toggle UI on donor profile
  - [x] 8.3 Ensure availability status is persisted and returned in donor profile responses
  - [x] 8.4 Write unit test for availability persistence across sessions (Requirement 6.4)

- [x] 9. Rewards and Goodies Display
  - [x] 9.1 Implement rewards endpoint (GET /api/blood-banks/:id/rewards)
  - [x] 9.2 Implement earned rewards endpoint (GET /api/donors/:id/earned-rewards)
  - [x] 9.3 Implement earned rewards calculation when donation is recorded
  - [x] 9.4 Implement rewards display UI on blood bank detail page
  - [x] 9.5 Implement earned rewards display UI on donor profile after donation
  - [x] 9.6 Write unit test for rewards display including name, description, eligibility condition (Requirement 7.3)
  - [x] 9.7 Write unit test for earned rewards displayed after donation (Requirement 7.4)

- [x] 10. Nearby Donation Camps
  - [x] 10.1 Implement nearby camps endpoint (GET /api/donation-camps/nearby) sorted by distance, filtered to future dates only
  - [x] 10.2 Implement camp detail response including name, organizer, date, time, venue, address, goodies
  - [x] 10.3 Implement camp interest registration endpoint (POST /api/donation-camps/:id/register)
  - [x] 10.4 Implement confirmation notification on camp registration (email to donor)
  - [x] 10.5 Implement donation camps UI (list view sorted by distance)
  - [x] 10.6 Write property test for P15: past camps excluded from listing
    - Tag: `Feature: blood-donation-management-system, Property 15: Active donation camps are filtered by date`
  - [x] 10.7 Write unit test for camp detail response containing all required fields (Requirement 8.2)
  - [x] 10.8 Write unit test for confirmation notification on camp registration (Requirement 8.4)

- [x] 11. Donation Reminder Notifications
  - [x] 11.1 Implement notification preferences endpoint (PUT /api/donors/:id/notification-preferences)
  - [x] 11.2 Implement reminder scheduling logic (schedule job 3/4 months after donation based on gender)
  - [x] 11.3 Implement daily cron job to send due reminders (node-cron)
  - [x] 11.4 Implement reminder notification content (encouragement message, nearby blood banks link, eligibility status)
  - [x] 11.5 Implement opt-out check before sending any notification
  - [x] 11.6 Implement notification preferences UI (enable/disable email and SMS independently)
  - [x] 11.7 Write property test for P11: reminder scheduled at correct gender-based interval
    - Tag: `Feature: blood-donation-management-system, Property 11: Donation reminder is scheduled at the correct gender-based interval`
  - [x] 11.8 Write property test for P12: opted-out donors excluded from notifications
    - Tag: `Feature: blood-donation-management-system, Property 12: Opted-out donors do not receive notifications`
  - [x] 11.9 Write property test for P13: reminder notification contains required content
    - Tag: `Feature: blood-donation-management-system, Property 13: Reminder notification content is complete`
  - [x] 11.10 Write unit test for reminder sent when scheduled date is reached (Requirement 9.3)

- [x] 12. Integration and End-to-End Testing
  - [x] 12.1 Write integration test for full donor registration flow (form → DB → confirmation email)
  - [x] 12.2 Write integration test for full donation recording flow (screening → record → eligibility update → reminder scheduled)
  - [x] 12.3 Write integration test for hospital search and contact request flow (search → request → accept → details revealed)
  - [x] 12.4 Write integration test for notification delivery (cron fires → email/SMS sent)
