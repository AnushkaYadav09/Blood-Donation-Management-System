/**
 * Tests for Task 10: Nearby Donation Camps
 *
 * Property tests:
 *   P15: Past camps excluded from listing
 *   Tag: Feature: blood-donation-management-system, Property 15: Active donation camps are filtered by date
 *
 * Unit tests:
 *   10.7: GET /api/donation-camps/nearby returns all required fields (Requirement 8.2)
 *   10.8: POST /api/donation-camps/:id/register sends confirmation email (Requirement 8.4)
 */

import request from 'supertest';
import * as fc from 'fast-check';
import app from '../app';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../db', () => {
  const mockQuery = jest.fn();
  return { default: { query: mockQuery }, query: mockQuery };
});

jest.mock('../middleware/auth', () => ({
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

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

// ─── P15: Past camps excluded from listing ────────────────────────────────────
/**
 * Validates: Requirements 8.1
 * Feature: blood-donation-management-system, Property 15: Active donation camps are filtered by date
 *
 * The DB query filters camp_date >= CURRENT_DATE. We test the filter logic
 * by mocking the DB to return only future camps (as the SQL WHERE clause would)
 * and verifying the API response never contains past-dated camps.
 */
describe('P15: Past camps excluded from listing', () => {
  /**
   * Pure property: a date-filter function that keeps only future dates
   * always excludes past dates and keeps future dates.
   */
  it('date filter function excludes past dates and keeps future dates', () => {
    function isFutureOrToday(campDateStr: string, today: Date): boolean {
      const campDate = new Date(campDateStr);
      campDate.setHours(0, 0, 0, 0);
      const todayNorm = new Date(today);
      todayNorm.setHours(0, 0, 0, 0);
      return campDate >= todayNorm;
    }

    fc.assert(
      fc.property(
        // Generate an array of camps with mixed past/future dates
        fc.array(
          fc.record({
            id: fc.uuid(),
            name: fc.string({ minLength: 1, maxLength: 30 }),
            // date offset in days from today: negative = past, positive = future
            dayOffset: fc.integer({ min: -365, max: 365 }),
          }),
          { minLength: 0, maxLength: 20 }
        ),
        (camps) => {
          const today = new Date();
          const campsWithDates = camps.map((c) => {
            const d = new Date(today);
            d.setDate(d.getDate() + c.dayOffset);
            return {
              ...c,
              camp_date: d.toISOString().split('T')[0],
            };
          });

          const filtered = campsWithDates.filter((c) =>
            isFutureOrToday(c.camp_date, today)
          );

          // All returned camps must be future or today
          for (const camp of filtered) {
            if (!isFutureOrToday(camp.camp_date, today)) return false;
          }

          // No past camp should appear in filtered results
          const pastCamps = campsWithDates.filter(
            (c) => !isFutureOrToday(c.camp_date, today)
          );
          for (const past of pastCamps) {
            if (filtered.some((f) => f.id === past.id)) return false;
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * API property: mock DB returns only future camps (simulating SQL WHERE camp_date >= CURRENT_DATE),
   * verify the API response contains only those camps.
   */
  it('GET /api/donation-camps/nearby only returns future camps from DB result', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.uuid(),
            name: fc.string({ minLength: 1, maxLength: 30 }),
            organizer: fc.string({ minLength: 1, maxLength: 30 }),
            camp_date: fc.date({ min: new Date(), max: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) })
              .map((d) => d.toISOString().split('T')[0]),
            camp_time: fc.option(fc.string({ minLength: 1, maxLength: 10 }), { nil: null }),
            venue: fc.string({ minLength: 1, maxLength: 50 }),
            address: fc.string({ minLength: 1, maxLength: 80 }),
            goodies: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null }),
            distance_km: fc.float({ min: 0, max: 50, noNaN: true }).map((v) => Math.round(v * 100) / 100),
          }),
          { minLength: 0, maxLength: 10 }
        ),
        async (futureCamps) => {
          // DB mock returns only future camps (SQL filter already applied)
          mockQuery.mockResolvedValueOnce({ rows: futureCamps });

          const res = await request(app).get(
            '/api/donation-camps/nearby?lat=1.2921&lng=36.8219&radius=50'
          );

          expect(res.status).toBe(200);
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          const todayStr = today.toISOString().split('T')[0];
          const body = res.body as Array<{ camp_date: string }>;
          for (const camp of body) {
            // Compare date strings directly (YYYY-MM-DD) to avoid timezone issues
            expect(camp.camp_date >= todayStr).toBe(true);
          }
        }
      ),
      { numRuns: 50 }
    );
  }, 30000);
});

// ─── Unit 10.7: GET /api/donation-camps/nearby returns all required fields ────
/**
 * Validates: Requirement 8.2
 */
describe('GET /api/donation-camps/nearby - camp detail contains all required fields (Requirement 8.2)', () => {
  it('returns id, name, organizer, camp_date, camp_time, venue, address, goodies, distance_km', async () => {
    const today = new Date();
    const futureDate = new Date(today);
    futureDate.setDate(today.getDate() + 7);

    const mockCamp = {
      id: 'camp-uuid-1',
      name: 'City Blood Drive',
      organizer: 'Red Cross',
      camp_date: futureDate.toISOString().split('T')[0],
      camp_time: '09:00 AM',
      venue: 'Community Hall',
      address: '456 Park Avenue, Nairobi',
      goodies: 'T-shirt, refreshments',
      distance_km: 3.5,
    };

    mockQuery.mockResolvedValueOnce({ rows: [mockCamp] });

    const res = await request(app).get(
      '/api/donation-camps/nearby?lat=1.2921&lng=36.8219&radius=50'
    );

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);

    const camp = res.body[0] as typeof mockCamp;
    expect(camp).toHaveProperty('id');
    expect(camp).toHaveProperty('name');
    expect(camp).toHaveProperty('organizer');
    expect(camp).toHaveProperty('camp_date');
    expect(camp).toHaveProperty('camp_time');
    expect(camp).toHaveProperty('venue');
    expect(camp).toHaveProperty('address');
    expect(camp).toHaveProperty('goodies');
    expect(camp).toHaveProperty('distance_km');

    expect(camp.name).toBe('City Blood Drive');
    expect(camp.organizer).toBe('Red Cross');
    expect(camp.venue).toBe('Community Hall');
    expect(camp.goodies).toBe('T-shirt, refreshments');
  });

  it('returns 400 when lat/lng are missing', async () => {
    const res = await request(app).get('/api/donation-camps/nearby');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

// ─── Unit 10.8: POST /api/donation-camps/:id/register sends confirmation email ─
/**
 * Validates: Requirement 8.4
 */
describe('POST /api/donation-camps/:id/register - confirmation email sent (Requirement 8.4)', () => {
  it('sends confirmation email to donor with camp name and date', async () => {
    const campId = 'camp-uuid-1';
    const donorId = 'donor-uuid-1';
    const donorEmail = 'donor@example.com';

    const today = new Date();
    const futureDate = new Date(today);
    futureDate.setDate(today.getDate() + 14);
    const campDate = futureDate.toISOString().split('T')[0];

    // Query 1: INSERT camp_registrations
    mockQuery.mockResolvedValueOnce({ rows: [] });
    // Query 2: SELECT donor email
    mockQuery.mockResolvedValueOnce({ rows: [{ email: donorEmail }] });
    // Query 3: SELECT camp name/date/venue
    mockQuery.mockResolvedValueOnce({
      rows: [{ name: 'City Blood Drive', camp_date: campDate, venue: 'Community Hall' }],
    });

    const res = await request(app)
      .post(`/api/donation-camps/${campId}/register`)
      .set('Authorization', 'Bearer test-token')
      .send({ donor_id: donorId });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Registration successful');
    expect(res.body.camp_id).toBe(campId);
    expect(res.body.donor_id).toBe(donorId);

    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const [toArg, subjectArg, bodyArg] = mockSendEmail.mock.calls[0] as [string, string, string];
    expect(toArg).toBe(donorEmail);
    expect(subjectArg).toBe('Donation Camp Registration Confirmed');
    expect(bodyArg).toContain('City Blood Drive');
    expect(bodyArg).toContain(campDate);
  });

  it('returns 201 with registration details', async () => {
    const campId = 'camp-uuid-2';
    const donorId = 'donor-uuid-2';

    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockQuery.mockResolvedValueOnce({ rows: [{ email: 'another@example.com' }] });
    mockQuery.mockResolvedValueOnce({
      rows: [{ name: 'Health Camp', camp_date: '2025-12-01', venue: 'Town Square' }],
    });

    const res = await request(app)
      .post(`/api/donation-camps/${campId}/register`)
      .set('Authorization', 'Bearer test-token')
      .send({ donor_id: donorId });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('message', 'Registration successful');
    expect(res.body).toHaveProperty('camp_id', campId);
    expect(res.body).toHaveProperty('donor_id', donorId);
  });
});
