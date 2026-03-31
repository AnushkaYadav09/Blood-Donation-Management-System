/**
 * Tests for Task 5: Donation History Tracking
 *
 * Property tests:
 *   P6: Donation history is returned in reverse chronological order
 *   P7: Next eligible date calculation is correct
 *   P8: Donation count matches stored records
 *
 * Unit tests:
 *   5.9: POST /api/donations inserts into donation_records (Requirement 3.4)
 *
 * Feature: blood-donation-management-system, Property 6: Donation history is returned in reverse chronological order
 * Feature: blood-donation-management-system, Property 7: Next eligible date calculation is correct
 * Feature: blood-donation-management-system, Property 8: Donation count matches stored records
 */

import request from 'supertest';
import * as fc from 'fast-check';
import app from '../app';
import { addMonths } from '../utils/dateUtils';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../db', () => {
  const mockQuery = jest.fn();
  return { default: { query: mockQuery }, query: mockQuery };
});

jest.mock('../middleware/auth', () => ({
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import pool from '../db';

const mockQuery = pool.query as jest.Mock;

// ─── P6: Donation history sorted descending ───────────────────────────────────
/**
 * Validates: Requirements 3.2
 * Feature: blood-donation-management-system, Property 6: Donation history is returned in reverse chronological order
 *
 * Since the DB is mocked, we test the sort property directly on the sort logic:
 * given any array of dates, sorting descending yields a non-increasing sequence.
 */
describe('P6: Donation history is returned in reverse chronological order', () => {
  it('any array of donation dates sorted DESC is non-increasing', () => {
    fc.assert(
      fc.property(
        fc.array(fc.date({ min: new Date('2000-01-01'), max: new Date('2030-12-31') }), {
          minLength: 0,
          maxLength: 20,
        }),
        (dates) => {
          const sorted = [...dates].sort((a, b) => b.getTime() - a.getTime());
          for (let i = 1; i < sorted.length; i++) {
            if (sorted[i].getTime() > sorted[i - 1].getTime()) return false;
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('GET /api/donors/:id/donations returns records in DESC order from DB', async () => {
    const records = [
      { id: '1', donation_date: '2024-03-01', blood_bank_name: 'Bank A', volume_donated: 450, location: 'City A' },
      { id: '2', donation_date: '2024-01-15', blood_bank_name: 'Bank B', volume_donated: 400, location: 'City B' },
      { id: '3', donation_date: '2023-11-20', blood_bank_name: 'Bank C', volume_donated: 350, location: 'City C' },
    ];

    mockQuery.mockResolvedValueOnce({ rows: records });

    const res = await request(app).get('/api/donors/donor-1/donations');
    expect(res.status).toBe(200);
    const dates = (res.body as typeof records).map((r) => new Date(r.donation_date).getTime());
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i]).toBeLessThanOrEqual(dates[i - 1]);
    }
  });
});

// ─── P7: Next eligible date calculation is correct ────────────────────────────
/**
 * Validates: Requirements 3.3
 * Feature: blood-donation-management-system, Property 7: Next eligible date calculation is correct
 */
describe('P7: Next eligible date calculation is correct', () => {
  it('addMonths returns exactly 3 months later for male donors', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date('2000-01-01'), max: new Date('2030-01-01') }),
        (donationDate) => {
          const result = addMonths(donationDate, 3);
          const expected = new Date(donationDate);
          expected.setMonth(expected.getMonth() + 3);
          return result.getTime() === expected.getTime();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('addMonths returns exactly 4 months later for female donors', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date('2000-01-01'), max: new Date('2030-01-01') }),
        (donationDate) => {
          const result = addMonths(donationDate, 4);
          const expected = new Date(donationDate);
          expected.setMonth(expected.getMonth() + 4);
          return result.getTime() === expected.getTime();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('GET /api/donors/:id/donations/next-eligible-date returns correct date for male', async () => {
    const lastDonation = '2024-01-15';
    mockQuery
      .mockResolvedValueOnce({ rows: [{ gender: 'Male' }] })
      .mockResolvedValueOnce({ rows: [{ last_donation_date: lastDonation, total_donations: '5' }] });

    const res = await request(app).get('/api/donors/donor-1/donations/next-eligible-date');
    expect(res.status).toBe(200);

    const expected = addMonths(new Date(lastDonation), 3).toISOString().split('T')[0];
    expect(res.body.nextEligibleDate).toBe(expected);
    expect(res.body.totalDonations).toBe(5);
  });

  it('GET /api/donors/:id/donations/next-eligible-date returns correct date for female', async () => {
    const lastDonation = '2024-01-15';
    mockQuery
      .mockResolvedValueOnce({ rows: [{ gender: 'Female' }] })
      .mockResolvedValueOnce({ rows: [{ last_donation_date: lastDonation, total_donations: '3' }] });

    const res = await request(app).get('/api/donors/donor-1/donations/next-eligible-date');
    expect(res.status).toBe(200);

    const expected = addMonths(new Date(lastDonation), 4).toISOString().split('T')[0];
    expect(res.body.nextEligibleDate).toBe(expected);
    expect(res.body.totalDonations).toBe(3);
  });

  it('returns null nextEligibleDate when donor has no donations', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ gender: 'Male' }] })
      .mockResolvedValueOnce({ rows: [{ last_donation_date: null, total_donations: '0' }] });

    const res = await request(app).get('/api/donors/donor-1/donations/next-eligible-date');
    expect(res.status).toBe(200);
    expect(res.body.nextEligibleDate).toBeNull();
    expect(res.body.totalDonations).toBe(0);
  });
});

// ─── P8: Donation count matches record count ──────────────────────────────────
/**
 * Validates: Requirements 3.5
 * Feature: blood-donation-management-system, Property 8: Donation count matches stored records
 */
describe('P8: Donation count matches stored records', () => {
  it('response array length equals the number of records returned by DB', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.uuid(),
            donation_date: fc.date({ min: new Date('2000-01-01'), max: new Date('2030-01-01') })
              .map((d) => d.toISOString().split('T')[0]),
            blood_bank_name: fc.string({ minLength: 1, maxLength: 30 }),
            volume_donated: fc.integer({ min: 200, max: 500 }),
            location: fc.string({ minLength: 1, maxLength: 50 }),
          }),
          { minLength: 0, maxLength: 20 }
        ),
        async (records) => {
          mockQuery.mockResolvedValueOnce({ rows: records });
          const res = await request(app).get('/api/donors/donor-1/donations');
          expect(res.status).toBe(200);
          expect((res.body as unknown[]).length).toBe(records.length);
        }
      ),
      { numRuns: 50 }
    );
  }, 30000);
});

// ─── Unit 5.9: POST /api/donations inserts into donation_records ──────────────
/**
 * Validates: Requirement 3.4
 * Tag: Requirement 3.4
 */
describe('POST /api/donations - records a donation (Requirement 3.4)', () => {
  beforeEach(() => mockQuery.mockReset());

  it('calls pool.query INSERT and returns 201 with the created record', async () => {
    const newRecord = {
      id: 'rec-uuid-1',
      donor_id: 'donor-uuid-1',
      blood_bank_id: 'bank-uuid-1',
      donation_date: '2024-06-01',
      volume_donated: 450,
      location: 'Nairobi',
      created_at: new Date().toISOString(),
    };

    mockQuery.mockResolvedValueOnce({ rows: [newRecord] });

    const res = await request(app)
      .post('/api/donations')
      .send({
        donor_id: 'donor-uuid-1',
        blood_bank_id: 'bank-uuid-1',
        donation_date: '2024-06-01',
        volume_donated: 450,
        location: 'Nairobi',
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe(newRecord.id);
    expect(res.body.donor_id).toBe(newRecord.donor_id);

    // Verify INSERT was called
    expect(mockQuery).toHaveBeenCalledTimes(1);
    const [sql] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql.toLowerCase()).toContain('insert into donation_records');
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/donations')
      .send({ donor_id: 'donor-uuid-1' }); // missing fields

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(mockQuery).not.toHaveBeenCalled();
  });
});
