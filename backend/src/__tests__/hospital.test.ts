/**
 * Tests for Task 7: Hospital Portal and Donor Interaction
 *
 * Property test P10: Donor search respects all filters and privacy rules
 * Tag: Feature: blood-donation-management-system, Property 10: Donor search respects all filters and privacy rules
 *
 * Unit test 7.10: Contact request notification sent to donor (Requirement 5.3)
 */

import request from 'supertest';
import * as fc from 'fast-check';
import jwt from 'jsonwebtoken';
import app from '../app';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../db', () => {
  const mockQuery = jest.fn();
  return { default: { query: mockQuery }, query: mockQuery };
});

jest.mock('../utils/email', () => ({
  sendEmail: jest.fn().mockResolvedValue(undefined),
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

// ─── Helper: issue a hospital JWT ─────────────────────────────────────────────

function hospitalToken(id = 'hospital-uuid-1', email = 'hospital@example.com'): string {
  const secret = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production';
  return jwt.sign({ id, email, role: 'hospital' }, secret, { expiresIn: '30m' });
}

// ─── P10: Property test — donor search respects all filters and privacy rules ──
/**
 * Validates: Requirements 5.1, 5.2
 * Feature: blood-donation-management-system, Property 10: Donor search respects all filters and privacy rules
 */
describe('P10: Donor search respects all filters and privacy rules', () => {
  /**
   * Property 1: Search results never contain phone_number or email fields.
   * For any set of donors returned by the mock DB, the API response must
   * strip phone_number and email from every record.
   */
  it('search results never contain phone_number or email fields', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.uuid(),
            full_name: fc.string({ minLength: 1, maxLength: 40 }),
            blood_group: fc.constantFrom('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'),
            location_city: fc.string({ minLength: 1, maxLength: 30 }),
            distance_km: fc.float({ min: 0, max: 10, noNaN: true }).map((v) => Math.round(v * 100) / 100),
            // These fields should be stripped by the API
            phone_number: fc.string({ minLength: 7, maxLength: 15 }),
            email: fc.emailAddress(),
          }),
          { minLength: 0, maxLength: 10 }
        ),
        async (donors) => {
          mockQuery.mockResolvedValueOnce({ rows: donors });

          const token = hospitalToken();
          const res = await request(app)
            .get('/api/hospitals/donors/search?bloodGroup=A%2B&lat=0&lng=0&radius=10')
            .set('Authorization', `Bearer ${token}`);

          expect(res.status).toBe(200);
          const results = res.body as Array<Record<string, unknown>>;

          for (const donor of results) {
            expect(donor).not.toHaveProperty('phone_number');
            expect(donor).not.toHaveProperty('email');
            // Must have the allowed fields
            expect(donor).toHaveProperty('id');
            expect(donor).toHaveProperty('full_name');
            expect(donor).toHaveProperty('blood_group');
            expect(donor).toHaveProperty('location_city');
            expect(donor).toHaveProperty('distance_km');
          }
        }
      ),
      { numRuns: 50 }
    );
  }, 30000);

  /**
   * Property 2: Endpoint requires hospital role — donor tokens are rejected.
   * For any arbitrary blood group string, a donor JWT must receive 403.
   */
  it('rejects non-hospital tokens with 403', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'XX', '', 'random'),
        async (bloodGroup) => {
          const secret = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production';
          const donorToken = jwt.sign({ id: 'donor-1', email: 'd@d.com', role: 'donor' }, secret, {
            expiresIn: '30m',
          });

          const res = await request(app)
            .get(`/api/hospitals/donors/search?bloodGroup=${encodeURIComponent(bloodGroup)}&lat=0&lng=0`)
            .set('Authorization', `Bearer ${donorToken}`);

          expect(res.status).toBe(403);
        }
      ),
      { numRuns: 20 }
    );
  }, 15000);
});

// ─── Unit 7.10: Contact request notification sent to donor ────────────────────
/**
 * Validates: Requirement 5.3
 */
describe('POST /api/hospitals/contact-requests — notification email sent to donor', () => {
  it('sends an email to the donor when a contact request is created', async () => {
    const donorId = 'donor-uuid-1';
    const hospitalId = 'hospital-uuid-1';

    // Mock: INSERT contact_request
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'cr-uuid-1',
          donor_id: donorId,
          hospital_id: hospitalId,
          message: 'We need your help',
          status: 'pending',
          created_at: new Date().toISOString(),
          responded_at: null,
        },
      ],
    });

    // Mock: SELECT donor email
    mockQuery.mockResolvedValueOnce({
      rows: [{ email: 'donor@example.com', full_name: 'John Doe' }],
    });

    // Mock: SELECT hospital name
    mockQuery.mockResolvedValueOnce({
      rows: [{ name: 'City General Hospital' }],
    });

    const token = hospitalToken(hospitalId);

    const res = await request(app)
      .post('/api/hospitals/contact-requests')
      .set('Authorization', `Bearer ${token}`)
      .send({ donor_id: donorId, hospital_id: hospitalId, message: 'We need your help' });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('pending');

    // Verify sendEmail was called with the donor's email
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const [toArg, subjectArg, bodyArg] = mockSendEmail.mock.calls[0];
    expect(toArg).toBe('donor@example.com');
    expect(subjectArg).toContain('hospital wants to contact you');
    expect(bodyArg).toContain('City General Hospital');
  });

  it('returns 400 when donor_id or hospital_id is missing', async () => {
    const token = hospitalToken();
    const res = await request(app)
      .post('/api/hospitals/contact-requests')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'hello' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 403 when called with a donor token', async () => {
    const secret = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production';
    const donorToken = jwt.sign({ id: 'donor-1', email: 'd@d.com', role: 'donor' }, secret, {
      expiresIn: '30m',
    });

    const res = await request(app)
      .post('/api/hospitals/contact-requests')
      .set('Authorization', `Bearer ${donorToken}`)
      .send({ donor_id: 'donor-1', hospital_id: 'hospital-1' });

    expect(res.status).toBe(403);
  });
});
