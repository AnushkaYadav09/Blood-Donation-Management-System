/**
 * Tests for Task 3: Donor Registration
 *
 * Property tests:
 *   P1: Registration rejects underage dates of birth
 *   P2: Registration validates required fields
 *
 * Unit tests:
 *   - Duplicate email returns 409 (Requirement 1.3)
 *   - Confirmation email sent on successful registration (Requirement 1.7)
 *
 * Feature: blood-donation-management-system, Property 1: Registration rejects underage donors
 * Feature: blood-donation-management-system, Property 2: Registration validates required fields
 */

import request from 'supertest';
import * as fc from 'fast-check';
import app from '../app';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../db', () => {
  const mockQuery = jest.fn();
  return { query: mockQuery, default: { query: mockQuery } };
});

jest.mock('../utils/email', () => ({
  sendEmail: jest.fn().mockResolvedValue(undefined),
}));

import pool from '../db';
import { sendEmail } from '../utils/email';

const mockQuery = pool.query as jest.Mock;
const mockSendEmail = sendEmail as jest.Mock;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VALID_BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const VALID_GENDERS = ['Male', 'Female', 'Other'];

function validPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    full_name: 'Jane Doe',
    email: 'jane@example.com',
    password: 'securePass1',
    phone_number: '1234567890',
    date_of_birth: '1990-06-15',
    gender: 'Female',
    blood_group: 'O+',
    location_city: 'Nairobi',
    ...overrides,
  };
}

/** Returns an ISO date string for someone who is exactly `years` years old minus 1 day (i.e. just under that age). */
function dobForAge(years: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  d.setDate(d.getDate() + 1); // one day short of the birthday
  return d.toISOString().split('T')[0];
}

/** Returns an ISO date string for someone who is exactly `years` years old. */
function dobExactAge(years: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d.toISOString().split('T')[0];
}

// ─── P1: Registration rejects underage dates of birth ────────────────────────
/**
 * Validates: Requirements 1.4
 * Feature: blood-donation-management-system, Property 1: Registration rejects underage donors
 */

describe('P1: Registration rejects underage dates of birth', () => {
  beforeEach(() => mockQuery.mockReset());

  it('always returns 400 for randomly generated underage dates of birth', async () => {
    // Generate dates that result in age < 18 (i.e. born within the last 18 years)
    const minDate = new Date();
    minDate.setFullYear(minDate.getFullYear() - 18);
    minDate.setDate(minDate.getDate() + 1); // strictly less than 18 years ago

    const maxDate = new Date(); // today (age = 0)

    await fc.assert(
      fc.asyncProperty(
        fc.date({ min: minDate, max: maxDate }),
        async (dob) => {
          const dobStr = dob.toISOString().split('T')[0];
          const res = await request(app)
            .post('/api/donors/register')
            .send(validPayload({ date_of_birth: dobStr }));
          expect(res.status).toBe(400);
        }
      ),
      { numRuns: 50 }
    );
  }, 30000);

  it('rejects a donor who is exactly 17 years and 364 days old', async () => {
    const dob = dobForAge(18); // one day short of 18
    const res = await request(app)
      .post('/api/donors/register')
      .send(validPayload({ date_of_birth: dob }));
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toContain('18');
  });
});

// ─── P2: Registration rejects invalid/incomplete payloads ─────────────────────
/**
 * Validates: Requirements 1.1, 1.2
 * Feature: blood-donation-management-system, Property 2: Registration validates required fields
 */

describe('P2: Registration validates required fields', () => {
  beforeEach(() => mockQuery.mockReset());

  it('always returns 400 when a required field is missing', async () => {
    const requiredFields = [
      'full_name',
      'email',
      'password',
      'phone_number',
      'date_of_birth',
      'gender',
      'blood_group',
      'location_city',
    ] as const;

    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...requiredFields),
        async (fieldToRemove) => {
          const payload = validPayload();
          delete payload[fieldToRemove];
          const res = await request(app)
            .post('/api/donors/register')
            .send(payload);
          expect(res.status).toBe(400);
        }
      ),
      { numRuns: 50 }
    );
  }, 30000);

  it('always returns 400 for invalid email format', async () => {
    const invalidEmails = ['notanemail', 'missing@', '@nodomain', 'spaces in@email.com', ''];

    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...invalidEmails),
        async (badEmail) => {
          const res = await request(app)
            .post('/api/donors/register')
            .send(validPayload({ email: badEmail }));
          expect(res.status).toBe(400);
        }
      ),
      { numRuns: 20 }
    );
  }, 30000);

  it('always returns 400 for invalid blood_group values', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 5 }).filter(s => !VALID_BLOOD_GROUPS.includes(s)),
        async (badBloodGroup) => {
          const res = await request(app)
            .post('/api/donors/register')
            .send(validPayload({ blood_group: badBloodGroup }));
          expect(res.status).toBe(400);
        }
      ),
      { numRuns: 50 }
    );
  }, 30000);

  it('always returns 400 for invalid gender values', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 10 }).filter(s => !VALID_GENDERS.includes(s)),
        async (badGender) => {
          const res = await request(app)
            .post('/api/donors/register')
            .send(validPayload({ gender: badGender }));
          expect(res.status).toBe(400);
        }
      ),
      { numRuns: 50 }
    );
  }, 30000);
});

// ─── Unit: Duplicate email returns 409 (Requirement 1.3) ─────────────────────

describe('POST /api/donors/register - duplicate email', () => {
  beforeEach(() => mockQuery.mockReset());

  it('returns 409 when email is already registered', async () => {
    // Mock pool.query to return an existing donor on the email check
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'existing-donor-id' }] });

    const res = await request(app)
      .post('/api/donors/register')
      .send(validPayload());

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_EXISTS');
  });
});

// ─── Unit: Confirmation email sent on success (Requirement 1.7) ──────────────

describe('POST /api/donors/register - confirmation email', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockSendEmail.mockClear();
  });

  it('calls sendEmail with the donor email on successful registration', async () => {
    const donorEmail = 'jane@example.com';

    // First query: no existing donor (email check)
    mockQuery.mockResolvedValueOnce({ rows: [] });
    // Second query: INSERT returning new donor
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'new-donor-id', email: donorEmail }] });

    const res = await request(app)
      .post('/api/donors/register')
      .send(validPayload({ email: donorEmail, date_of_birth: dobExactAge(25) }));

    expect(res.status).toBe(201);
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(mockSendEmail.mock.calls[0][0]).toBe(donorEmail);
  });
});
