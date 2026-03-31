# Requirements Document

## Introduction

A web-based Blood Donation Management System that connects donors with nearby blood banks and hospitals. The system manages donor registration, eligibility screening, donation history tracking, location-based blood bank discovery, reward/goodies display, and automated donation reminder notifications. Hospitals and blood banks can interact directly with eligible nearby donors.

## Glossary

- **System**: The Blood Donation Management System web application
- **Donor**: A registered user who is willing to donate blood
- **Hospital**: A medical institution that can search for and contact nearby donors
- **Blood_Bank**: A facility that collects, stores, and distributes blood
- **Donation_Camp**: A temporary blood donation event organized by a blood bank or hospital
- **Eligibility_Screener**: The component that evaluates a donor's eligibility based on health criteria
- **Notification_Service**: The component responsible for sending donation reminder notifications
- **Location_Service**: The component that determines the donor's geographic location and finds nearby facilities
- **Donor_Profile**: The stored record of a donor's personal information, health data, and donation history
- **Donation_Record**: A single entry in a donor's donation history including date, location, and blood bank

---

## Requirements

### Requirement 1: Donor Registration

**User Story:** As a new user, I want to register as a blood donor, so that I can participate in blood donation and be discoverable by hospitals.

#### Acceptance Criteria

1. THE System SHALL collect the following fields during registration: full name, blood group, phone number, email address, date of birth, gender, and location.
2. WHEN a user submits the registration form, THE System SHALL validate that all required fields are present and correctly formatted before creating a Donor_Profile.
3. WHEN a user provides an email address that already exists in the system, THE System SHALL display an error message indicating the email is already registered.
4. WHEN a user provides a date of birth indicating an age below 18 years, THE System SHALL reject the registration and display an eligibility message.
5. THE System SHALL present blood group selection as a dropdown menu containing: A+, A-, B+, B-, AB+, AB-, O+, O-.
6. THE System SHALL present gender selection as a dropdown menu containing: Male, Female, Other.
7. WHEN a Donor_Profile is successfully created, THE System SHALL send a confirmation email to the registered email address.

---

### Requirement 2: Donor Eligibility Screening

**User Story:** As a donor, I want to complete a pre-donation health screening, so that I can confirm my eligibility before donating blood.

#### Acceptance Criteria

1. WHEN a donor initiates a donation request, THE Eligibility_Screener SHALL present a structured screening questionnaire before proceeding.
2. THE Eligibility_Screener SHALL ask whether the donor has any communicable diseases, using a dropdown menu of conditions including but not limited to: HIV/AIDS, Hepatitis B, Hepatitis C, Tuberculosis, Malaria, Syphilis.
3. THE Eligibility_Screener SHALL ask whether the donor has received a tattoo or piercing within the past 6 months.
4. THE Eligibility_Screener SHALL ask the donor to confirm their current weight, and SHALL reject donors whose weight is below 50 kg.
5. THE Eligibility_Screener SHALL verify the donor's age from the stored date of birth, and SHALL reject donors under 18 years of age.
6. THE Eligibility_Screener SHALL present a dropdown menu of general medical conditions including: Diabetes, Hypertension, Heart Disease, Cancer, Epilepsy, Asthma, Kidney Disease, Autoimmune Disorders, and None.
7. WHEN the donor's gender is Female, THE Eligibility_Screener SHALL additionally ask whether the donor is currently pregnant.
8. WHEN the donor's gender is Female, THE Eligibility_Screener SHALL additionally ask whether the donor is currently breastfeeding.
9. IF a donor answers affirmatively to pregnancy, THE Eligibility_Screener SHALL mark the donor as ineligible and display a message explaining the disqualification.
10. IF a donor answers affirmatively to breastfeeding, THE Eligibility_Screener SHALL mark the donor as ineligible and display a message explaining the disqualification.
11. IF a donor reports a communicable disease, THE Eligibility_Screener SHALL mark the donor as ineligible and display a message explaining the disqualification.
12. WHEN all screening questions are answered and the donor meets all criteria, THE Eligibility_Screener SHALL mark the donor as eligible and allow the donation process to proceed.
13. THE Eligibility_Screener SHALL ask whether the donor has donated blood in the past 3 months (male) or 4 months (female), and SHALL mark the donor as ineligible if the minimum interval has not elapsed.

---

### Requirement 3: Donation History Tracking

**User Story:** As a donor, I want to view my past donation history, so that I can track my contributions and know when I am eligible to donate again.

#### Acceptance Criteria

1. THE System SHALL maintain a Donation_Record for each completed donation, storing: donation date, blood bank name, location, and volume donated.
2. WHEN a donor views their profile, THE System SHALL display all Donation_Records associated with that donor in reverse chronological order.
3. WHEN a donor's most recent Donation_Record exists, THE System SHALL calculate and display the earliest date the donor is next eligible to donate, based on gender (3 months for Male, 4 months for Female).
4. WHEN a donation is recorded, THE System SHALL update the donor's eligibility status accordingly.
5. THE System SHALL display the total number of donations made by the donor on their profile page.

---

### Requirement 4: Location-Based Blood Bank Discovery

**User Story:** As a donor, I want to find the nearest blood bank to my location, so that I can donate blood conveniently.

#### Acceptance Criteria

1. WHEN a donor requests to find nearby blood banks, THE Location_Service SHALL request access to the donor's geographic location via the browser's Geolocation API.
2. WHEN location access is granted, THE Location_Service SHALL return a list of blood banks sorted by distance from the donor's current location, showing the nearest first.
3. WHEN location access is denied, THE System SHALL allow the donor to manually enter a city or postal code to find nearby blood banks.
4. THE System SHALL display each blood bank's name, address, distance from the donor, operating hours, and contact number.
5. WHEN a donor selects a blood bank, THE System SHALL display a map view with directions to the selected blood bank.

---

### Requirement 5: Hospital and Blood Bank Interaction with Donors

**User Story:** As a hospital administrator, I want to search for and contact eligible donors near my location, so that I can quickly find blood for patients in need.

#### Acceptance Criteria

1. THE System SHALL provide a hospital-facing portal with authentication separate from the donor-facing interface.
2. WHEN a hospital searches for donors, THE System SHALL filter results by blood group, location radius, and eligibility status.
3. WHEN a hospital selects a donor from search results, THE System SHALL send a donation request notification to that donor's registered phone number and email address.
4. THE System SHALL display only donors who have opted in to being contacted by hospitals.
5. WHEN a donor receives a hospital contact request, THE System SHALL allow the donor to accept or decline the request through the web interface.
6. THE System SHALL not expose a donor's full personal details (phone number, email) to hospitals until the donor accepts the contact request.

---

### Requirement 6: Donor Willingness and Availability

**User Story:** As a donor, I want to indicate my willingness to donate, so that hospitals and blood banks know I am available.

#### Acceptance Criteria

1. THE System SHALL provide a toggle on the Donor_Profile allowing the donor to set their availability status to "Available" or "Unavailable".
2. WHEN a donor sets their status to "Unavailable", THE System SHALL exclude that donor from hospital and blood bank search results.
3. WHEN a donor sets their status to "Available", THE System SHALL include that donor in search results, subject to eligibility criteria.
4. THE System SHALL persist the donor's availability status across sessions.

---

### Requirement 7: Rewards and Goodies Display

**User Story:** As a donor, I want to see the rewards offered by blood banks, so that I am motivated to donate.

#### Acceptance Criteria

1. THE System SHALL display a list of rewards and goodies offered by each blood bank on the blood bank's detail page.
2. WHEN a blood bank updates its rewards information, THE System SHALL reflect the updated rewards within 24 hours.
3. THE System SHALL display reward details including: reward name, description, and eligibility condition (e.g., first donation, every donation).
4. WHEN a donor completes a donation at a blood bank, THE System SHALL display the rewards the donor has earned from that blood bank.

---

### Requirement 8: Nearby Donation Camps

**User Story:** As a donor, I want to see upcoming blood donation camps near me, so that I can participate in community donation events.

#### Acceptance Criteria

1. WHEN a donor views the donation camps section, THE System SHALL display a list of upcoming Donation_Camps sorted by distance from the donor's location.
2. THE System SHALL display each Donation_Camp's name, organizer, date, time, venue, address, and available goodies.
3. WHEN a Donation_Camp's date has passed, THE System SHALL remove it from the active camps listing.
4. WHEN a donor registers interest in a Donation_Camp, THE System SHALL send a confirmation notification to the donor's registered email address.
5. WHERE a blood bank has configured goodies for a Donation_Camp, THE System SHALL display the goodies information alongside the camp details.

---

### Requirement 9: Donation Reminder Notifications

**User Story:** As a donor, I want to receive reminders when I am eligible to donate again, so that I can maintain a regular donation schedule.

#### Acceptance Criteria

1. WHEN a Donation_Record is created for a male donor, THE Notification_Service SHALL schedule a reminder notification 3 months after the donation date.
2. WHEN a Donation_Record is created for a female donor, THE Notification_Service SHALL schedule a reminder notification 4 months after the donation date.
3. WHEN the scheduled reminder date is reached, THE Notification_Service SHALL send a notification to the donor's registered email address and phone number.
4. THE Notification_Service SHALL include in the reminder notification: a message encouraging donation, a link to find nearby blood banks, and the donor's current eligibility status.
5. WHEN a donor opts out of notifications, THE Notification_Service SHALL not send any further reminder notifications to that donor.
6. THE System SHALL provide a notification preferences page where donors can enable or disable email and SMS notifications independently.

---

### Requirement 10: Donor Authentication and Account Management

**User Story:** As a registered donor, I want to securely log in and manage my account, so that my personal and health data is protected.

#### Acceptance Criteria

1. THE System SHALL require donors to authenticate using email address and password before accessing their Donor_Profile.
2. WHEN a donor enters an incorrect password 5 consecutive times, THE System SHALL temporarily lock the account for 15 minutes and notify the donor via email.
3. THE System SHALL support password reset via a time-limited link sent to the donor's registered email address.
4. WHEN a donor updates their profile information, THE System SHALL require re-authentication if the email address or password is being changed.
5. THE System SHALL store donor passwords using a cryptographic hashing algorithm with salt.
6. WHEN a donor session has been inactive for 30 minutes, THE System SHALL automatically log out the donor and redirect to the login page.
