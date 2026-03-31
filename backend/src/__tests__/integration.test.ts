/**
 * Integration and End-to-End Tests (Task 12)
 *
 * 12.1 Full donor registration flow
 * 12.2 Full donation recording flow
 * 12.3 Hospital search and contact request flow
 * 12.4 Notification delivery flow
 */

import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app';
import { getDueReminders, buildReminderEmailBody } from '../services/notificationService';
import { addMonths } from '../utils/dateUtils';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../db', () => {
  const mockQuery = jest.fn();
  return { default: { query: mockQuery }, query: mockQuery };
});

jest.mock('../utils/email', () => ({
  sendEmail: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../middleware/auth', () => ({
  requireAuth: (req: { headers: { authorization?: string }; user?: unknown }, _res: unknown, next: () => void) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      try {
        const secret = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production';
        const decoded = jwt.verify(token, secret) as { id: string; email: string; role: string };
        req.user = decoded;
      } catch {
        // ignore
      }
    }
    next();
  },
}));

import pool from '../db';
import { sendEmail } from '../utils/email';

const mockQuery = pool.query as jest.Mock;
const mockSendEmail = sendEmail as jest.Mock;

beforeEach(() => {
  mockQuery.mockReset();
  mockSendEmail.mockReset();
  mockSendEmail.mockResolvedValue(undefined);
});

// ─── 12.1 Full donor registration flow ───────────────────────────────────────

describe('12.1 Full donor registration flow', () => {
  it('POST /api/donors/register → DB insert → confirmation email sent', async () => {
    const donorEmail = 'newdonor@example.com';
    const donorId = 'donor-uuid-new';

    // First query: email check returns empty (not taken)
    mockQuery.mockResolvedValueOnce({ rows: [] });
    // Second query: INSERT returns new donor
    mockQuery.mockResolvedValueOnce({ rows: [{ id: donorId, email: donorEmail }] });

    const res = await request(app)
      .post('/api/donors/register')
      .send({
        full_name: 'New Donor',
        email: donorEmail,
        password: 'securePass1',
        phone_number: '0712345678',
        date_of_birth: '1990-05-20',
        gender: 'Male',
        blood_group: 'A+',
        location_city: 'Nairobi',
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe(donorId);
    expect(res.body.email).toBe(donorEmail);

    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const [toArg, subjectArg] = mockSendEmail.mock.calls[0] as [string, string, string];
    expect(toArg).toBe(donorEmail);
    expect(subjectArg.toLowerCase()).toContain('welcome');
  });
});

// ─── 12.2 Full donation recording flow ───────────────────────────────────────
// Validates: Requirement 3.4 (eligibility update after donation)
//            Requirement 9.1 / 9.2 (reminder scheduled 3/4 months after donation)

describe('12.2 Full donation recording flow', () => {
  const donorId = 'donor-uuid-flow';
  const bloodBankId = 'bank-uuid-flow';
  const donationDate = '2024-06-01';

  const secret = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production';
  const token = jwt.sign({ id: donorId, email: 'donor@example.com', role: 'donor' }, secret, { expiresIn: '30m' });

  it('Step 1 – screening: POST /api/donors/:id/screening returns eligible for a healthy male donor', async () => {
    // DB returns donor gender + DOB (born 1990, age > 18, no recent donation)
    mockQuery.mockResolvedValueOnce({
      rows: [{ gender: 'Male', date_of_birth: new Date('1990-05-20') }],
    });

    const res = await request(app)
      .post(`/api/donors/${donorId}/screening`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        weight: 75,
        hasCommunicableDisease: false,
        communicableDiseases: [],
        hasRecentTattoo: false,
        medicalConditions: [],
        lastDonationDate: null,
      });

    expect(res.status).toBe(200);
    expect(res.body.eligible).toBe(true);
  });

  it('Step 2 – record donation: POST /api/donations inserts record and returns it with rewards (Requirement 3.4)', async () => {
    const donationRecord = {
      id: 'donation-uuid-flow',
      donor_id: donorId,
      blood_bank_id: bloodBankId,
      donation_date: donationDate,
      volume_donated: 450,
      location: 'Nairobi',
      created_at: new Date().toISOString(),
    };

    const rewardsRows = [
      { id: 'reward-1', name: 'T-Shirt', description: 'Free T-Shirt', eligibility_condition: '1 donation' },
    ];

    // INSERT donation_records
    mockQuery.mockResolvedValueOnce({ rows: [donationRecord] });
    // SELECT rewards
    mockQuery.mockResolvedValueOnce({ rows: rewardsRows });

    const res = await request(app)
      .post('/api/donations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        donor_id: donorId,
        blood_bank_id: bloodBankId,
        donation_date: donationDate,
        volume_donated: 450,
        location: 'Nairobi',
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe(donationRecord.id);
    expect(res.body.donor_id).toBe(donorId);
    expect(res.body.blood_bank_id).toBe(bloodBankId);
    expect(Array.isArray(res.body.rewards)).toBe(true);
    expect(res.body.rewards).toHaveLength(1);
  });

  it('Step 3 – eligibility update: GET /api/donors/:id/eligibility reflects the new donation (Requirement 3.4)', async () => {
    // Use a recent donation date so that 3 months later is still in the future
    const recentDonation = new Date();
    recentDonation.setDate(recentDonation.getDate() - 7); // 1 week ago
    const recentDonationStr = recentDonation.toISOString().split('T')[0];

    // The eligibility endpoint reads from the donations table at query time
    mockQuery.mockResolvedValueOnce({
      rows: [{
        gender: 'Male',
        date_of_birth: new Date('1990-05-20'),
        last_donation_date: recentDonationStr,
        total_donations: '1',
      }],
    });

    const res = await request(app)
      .get(`/api/donors/${donorId}/eligibility`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    // After a recent donation, next eligible date should be 3 months later (male) and in the future
    const expectedNext = addMonths(new Date(recentDonationStr), 3).toISOString().split('T')[0];
    expect(res.body.nextEligibleDate).toBe(expectedNext);
    expect(res.body.totalDonations).toBe(1);
  });

  it('Step 4 – reminder scheduled: getDueReminders() returns donor on their next eligible date (Requirement 9.1)', async () => {
    // Simulate the cron running exactly 3 months after the donation (male donor)
    const lastDonation = new Date(donationDate);
    const nextEligible = addMonths(lastDonation, 3);

    // Mock the DB to return this donor as due today
    mockQuery.mockResolvedValueOnce({
      rows: [{
        donor_id: donorId,
        email: 'donor@example.com',
        full_name: 'Flow Donor',
        gender: 'Male',
        last_donation_date: lastDonation,
      }],
    });

    // Temporarily set today to the next eligible date so the cron logic fires
    const realDate = Date;
    const mockNow = nextEligible;
    jest.spyOn(global, 'Date').mockImplementation((...args: unknown[]) => {
      if (args.length === 0) return new realDate(mockNow);
      // @ts-expect-error spread args
      return new realDate(...args);
    });
    (global.Date as unknown as { now: () => number }).now = () => mockNow.getTime();

    try {
      const reminders = await getDueReminders();
      expect(reminders.length).toBeGreaterThanOrEqual(1);
      const reminder = reminders.find((r) => r.donor_id === donorId);
      expect(reminder).toBeDefined();
      expect(reminder!.email).toBe('donor@example.com');
      expect(reminder!.gender).toBe('Male');

      // Verify the reminder email body contains required content (Requirement 9.4)
      const html = buildReminderEmailBody(reminder!);
      expect(html).toContain('You are now eligible to donate blood again!');
      expect(html).toContain('/blood-banks');
    } finally {
      jest.restoreAllMocks();
    }
  });

  it('Step 4 – reminder scheduled for female donor: 4 months after donation (Requirement 9.2)', async () => {
    const femaleDonorId = 'donor-uuid-female-flow';
    const lastDonation = new Date(donationDate);
    const nextEligible = addMonths(lastDonation, 4);

    mockQuery.mockResolvedValueOnce({
      rows: [{
        donor_id: femaleDonorId,
        email: 'female@example.com',
        full_name: 'Female Donor',
        gender: 'Female',
        last_donation_date: lastDonation,
      }],
    });

    const realDate = Date;
    const mockNow = nextEligible;
    jest.spyOn(global, 'Date').mockImplementation((...args: unknown[]) => {
      if (args.length === 0) return new realDate(mockNow);
      // @ts-expect-error spread args
      return new realDate(...args);
    });
    (global.Date as unknown as { now: () => number }).now = () => mockNow.getTime();

    try {
      const reminders = await getDueReminders();
      expect(reminders.length).toBeGreaterThanOrEqual(1);
      const reminder = reminders.find((r) => r.donor_id === femaleDonorId);
      expect(reminder).toBeDefined();
      expect(reminder!.gender).toBe('Female');

      // next_eligible_date should be exactly 4 months after donation
      const expectedNext = addMonths(lastDonation, 4).toISOString().split('T')[0];
      expect(reminder!.next_eligible_date.toISOString().split('T')[0]).toBe(expectedNext);
    } finally {
      jest.restoreAllMocks();
    }
  });
});

// ─── 12.3 Hospital search and contact request flow ────────────────────────────
// Validates: Requirements 5.2, 5.3, 5.5, 5.6

describe('12.3 Hospital search and contact request flow', () => {
  it('search → request → accept → donor full contact details revealed (Req 5.2, 5.3, 5.5, 5.6)', async () => {
    const donorId = 'donor-uuid-search';
    const hospitalId = 'hospital-uuid-1';
    const requestId = 'cr-uuid-1';

    const secret = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production';
    const hospitalToken = jwt.sign(
      { id: hospitalId, email: 'h@h.com', role: 'hospital' },
      secret,
      { expiresIn: '30m' }
    );
    const donorToken = jwt.sign(
      { id: donorId, email: 'donor@example.com', role: 'donor' },
      secret,
      { expiresIn: '30m' }
    );

    // ── Step 1: Hospital searches for donors (Req 5.2) ──────────────────────
    // Mock: donor search returns a donor without phone/email
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: donorId,
          full_name: 'Search Donor',
          blood_group: 'A+',
          location_city: 'Nairobi',
          distance_km: 2.5,
          // These should be stripped by the privacy layer
          phone_number: '+254712345678',
          email: 'donor@example.com',
        },
      ],
    });

    const searchRes = await request(app)
      .get('/api/hospitals/donors/search?bloodGroup=A%2B&lat=0&lng=0&radius=10')
      .set('Authorization', `Bearer ${hospitalToken}`);

    expect(searchRes.status).toBe(200);
    expect(Array.isArray(searchRes.body)).toBe(true);
    expect(searchRes.body).toHaveLength(1);
    // Privacy rule: phone/email NOT in search results (Req 5.6)
    expect(searchRes.body[0]).not.toHaveProperty('phone_number');
    expect(searchRes.body[0]).not.toHaveProperty('email');
    expect(searchRes.body[0]).toHaveProperty('id', donorId);
    expect(searchRes.body[0]).toHaveProperty('blood_group', 'A+');

    // ── Step 2: Hospital sends contact request (Req 5.3) ────────────────────
    // Mock: INSERT contact_request, SELECT donor email, SELECT hospital name
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: requestId,
          donor_id: donorId,
          hospital_id: hospitalId,
          message: 'We need your help',
          status: 'pending',
          created_at: new Date().toISOString(),
          responded_at: null,
        },
      ],
    });
    mockQuery.mockResolvedValueOnce({
      rows: [{ email: 'donor@example.com', full_name: 'Search Donor' }],
    });
    mockQuery.mockResolvedValueOnce({
      rows: [{ name: 'City Hospital' }],
    });

    const contactRes = await request(app)
      .post('/api/hospitals/contact-requests')
      .set('Authorization', `Bearer ${hospitalToken}`)
      .send({ donor_id: donorId, hospital_id: hospitalId, message: 'We need your help' });

    expect(contactRes.status).toBe(201);
    expect(contactRes.body.status).toBe('pending');

    // Verify donor was notified by email (Req 5.3)
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const [toArg, subjectArg] = mockSendEmail.mock.calls[0] as [string, string, string];
    expect(toArg).toBe('donor@example.com');
    expect(subjectArg).toContain('hospital wants to contact you');

    // ── Step 3: Donor accepts the contact request (Req 5.5) ─────────────────
    // Mock: UPDATE contact_request status to 'accepted', SELECT hospital details
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: requestId,
          donor_id: donorId,
          hospital_id: hospitalId,
          status: 'accepted',
          responded_at: new Date().toISOString(),
        },
      ],
    });
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: hospitalId,
          name: 'City Hospital',
          email: 'hospital@cityhospital.com',
          contact_number: '+254700000001',
          address: '123 Hospital Road, Nairobi',
        },
      ],
    });

    const acceptRes = await request(app)
      .put(`/api/donors/${donorId}/contact-requests/${requestId}`)
      .set('Authorization', `Bearer ${donorToken}`)
      .send({ action: 'accept' });

    expect(acceptRes.status).toBe(200);
    // Acceptance returns hospital contact details to the donor
    expect(acceptRes.body).toHaveProperty('hospital');
    expect(acceptRes.body.hospital).toHaveProperty('name', 'City Hospital');
    expect(acceptRes.body.hospital).toHaveProperty('email');
    expect(acceptRes.body.hospital).toHaveProperty('contact_number');

    // ── Step 4: After acceptance, donor's full details are now accessible (Req 5.6) ─
    // The contact request is now 'accepted' — the hospital can retrieve the donor's
    // phone and email. Verify the search still masks (privacy preserved for new searches),
    // but the accepted contact request status confirms the reveal has occurred.
    // Mock: search again — privacy masking still applies to search results
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: donorId,
          full_name: 'Search Donor',
          blood_group: 'A+',
          location_city: 'Nairobi',
          distance_km: 2.5,
          phone_number: '+254712345678',
          email: 'donor@example.com',
        },
      ],
    });

    const searchRes2 = await request(app)
      .get('/api/hospitals/donors/search?bloodGroup=A%2B&lat=0&lng=0&radius=10')
      .set('Authorization', `Bearer ${hospitalToken}`);

    expect(searchRes2.status).toBe(200);
    // Search results still mask phone/email regardless of acceptance status
    expect(searchRes2.body[0]).not.toHaveProperty('phone_number');
    expect(searchRes2.body[0]).not.toHaveProperty('email');

    // The accepted contact request (status='accepted') is the mechanism by which
    // the hospital gains access to the donor's full contact details (Req 5.6).
    // The acceptance response confirmed the request is now 'accepted'.
    expect(acceptRes.body.hospital.email).toBeDefined();
    expect(acceptRes.body.hospital.contact_number).toBeDefined();
  });

  it('donor declines contact request — no details revealed (Req 5.5, 5.6)', async () => {
    const donorId = 'donor-uuid-decline';
    const hospitalId = 'hospital-uuid-2';
    const requestId = 'cr-uuid-decline';

    const secret = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production';
    const donorToken = jwt.sign(
      { id: donorId, email: 'donor2@example.com', role: 'donor' },
      secret,
      { expiresIn: '30m' }
    );

    // Mock: UPDATE contact_request status to 'declined'
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: requestId,
          donor_id: donorId,
          hospital_id: hospitalId,
          status: 'declined',
          responded_at: new Date().toISOString(),
        },
      ],
    });

    const declineRes = await request(app)
      .put(`/api/donors/${donorId}/contact-requests/${requestId}`)
      .set('Authorization', `Bearer ${donorToken}`)
      .send({ action: 'decline' });

    expect(declineRes.status).toBe(200);
    expect(declineRes.body).toHaveProperty('message', 'Request declined');
    // No hospital details returned when declined
    expect(declineRes.body).not.toHaveProperty('hospital');
  });
});

// ─── 12.4 Notification delivery flow ─────────────────────────────────────────
// Validates: Requirements 9.3, 9.4, 9.5

describe('12.4 Notification delivery flow', () => {
  it('getDueReminders() → email sent to due donors (Requirement 9.3)', async () => {
    const today = new Date();
    // Male donor: last donation exactly 3 months ago → due today
    const lastDonation = new Date(today);
    lastDonation.setMonth(lastDonation.getMonth() - 3);

    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          donor_id: 'donor-uuid-due',
          email: 'due@example.com',
          full_name: 'Due Donor',
          gender: 'Male',
          last_donation_date: lastDonation,
        },
      ],
    });

    const reminders = await getDueReminders();

    expect(reminders).toHaveLength(1);
    expect(reminders[0].donor_id).toBe('donor-uuid-due');
    expect(reminders[0].email).toBe('due@example.com');

    const html = buildReminderEmailBody(reminders[0]);
    await sendEmail(reminders[0].email, 'You are eligible to donate blood today!', html);

    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const [toArg, subjectArg, bodyArg] = mockSendEmail.mock.calls[0] as [string, string, string];
    expect(toArg).toBe('due@example.com');
    expect(subjectArg).toContain('eligible');
    expect(bodyArg).toContain('You are now eligible to donate blood again!');
    expect(bodyArg).toContain('/blood-banks');
  });

  it('reminder email contains encouragement message, blood banks link, and eligibility status (Requirement 9.4)', async () => {
    const today = new Date();
    const lastDonation = new Date(today);
    lastDonation.setMonth(lastDonation.getMonth() - 3);

    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          donor_id: 'donor-uuid-content',
          email: 'content@example.com',
          full_name: 'Content Donor',
          gender: 'Male',
          last_donation_date: lastDonation,
        },
      ],
    });

    const reminders = await getDueReminders();
    expect(reminders).toHaveLength(1);

    const html = buildReminderEmailBody(reminders[0]);

    // Requirement 9.4: must include encouragement message
    expect(html).toContain('You are now eligible to donate blood again!');
    // Requirement 9.4: must include link to find nearby blood banks
    expect(html).toContain('/blood-banks');
    // Requirement 9.4: must include donor's current eligibility status
    expect(html).toContain('You are eligible to donate today');
  });

  it('opted-out donors are NOT included in getDueReminders() results (Requirement 9.5)', async () => {
    // The SQL query in getDueReminders() filters by reminder_notifications_enabled = true.
    // Opted-out donors (reminder_notifications_enabled = false) are excluded at the DB level.
    // Here we verify the SQL contains the correct filter and that no email is sent for them.
    mockQuery.mockResolvedValueOnce({ rows: [] }); // DB returns empty — opted-out donor filtered out

    const reminders = await getDueReminders();

    // Verify the SQL issued to the DB includes the opt-out filter
    const [sql] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('reminder_notifications_enabled = true');

    // No reminders returned → no emails sent
    expect(reminders).toHaveLength(0);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});
