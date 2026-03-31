/**
 * Tests for Task 9: Rewards and Goodies Display
 *
 * Unit tests:
 *   9.6: GET /api/blood-banks/:id/rewards returns name, description, eligibility_condition (Requirement 7.3)
 *   9.7: POST /api/donations response includes rewards array (Requirement 7.4)
 */

import request from 'supertest';
import app from '../app';

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

beforeEach(() => mockQuery.mockReset());

// ─── Unit 9.6: GET /api/blood-banks/:id/rewards ───────────────────────────────
/**
 * Validates: Requirements 7.3
 */
describe('GET /api/blood-banks/:id/rewards - rewards display (Requirement 7.3)', () => {
  it('returns rewards with name, description, eligibility_condition fields', async () => {
    const mockRewards = [
      {
        id: 'reward-uuid-1',
        name: 'Free T-Shirt',
        description: 'Get a free t-shirt after your first donation',
        eligibility_condition: 'First donation',
      },
      {
        id: 'reward-uuid-2',
        name: 'Gift Voucher',
        description: '10% off at partner stores',
        eligibility_condition: '3+ donations',
      },
    ];

    // First query: blood bank existence check
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'bank-uuid-1' }] });
    // Second query: rewards
    mockQuery.mockResolvedValueOnce({ rows: mockRewards });

    const res = await request(app).get('/api/blood-banks/bank-uuid-1/rewards');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);

    const first = res.body[0] as { name: string; description: string; eligibility_condition: string };
    expect(first).toHaveProperty('name');
    expect(first).toHaveProperty('description');
    expect(first).toHaveProperty('eligibility_condition');
    expect(first.name).toBe('Free T-Shirt');
    expect(first.description).toBe('Get a free t-shirt after your first donation');
    expect(first.eligibility_condition).toBe('First donation');
  });

  it('returns empty array when blood bank has no rewards', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'bank-uuid-2' }] });
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/blood-banks/bank-uuid-2/rewards');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns 404 when blood bank does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/blood-banks/nonexistent-id/rewards');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

// ─── Unit 9.7: POST /api/donations includes rewards in response ───────────────
/**
 * Validates: Requirements 7.4
 */
describe('POST /api/donations - response includes rewards array (Requirement 7.4)', () => {
  it('returns rewards array with items when blood bank has rewards', async () => {
    const donationRecord = {
      id: 'rec-uuid-1',
      donor_id: 'donor-uuid-1',
      blood_bank_id: 'bank-uuid-1',
      donation_date: '2024-06-01',
      volume_donated: 450,
      location: 'Nairobi',
      created_at: new Date().toISOString(),
    };

    const mockRewards = [
      {
        id: 'reward-uuid-1',
        name: 'Free T-Shirt',
        description: 'Get a free t-shirt after your first donation',
        eligibility_condition: 'First donation',
      },
    ];

    // First query: INSERT donation
    mockQuery.mockResolvedValueOnce({ rows: [donationRecord] });
    // Second query: rewards for blood bank
    mockQuery.mockResolvedValueOnce({ rows: mockRewards });

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
    expect(res.body).toHaveProperty('rewards');
    expect(Array.isArray(res.body.rewards)).toBe(true);
    expect(res.body.rewards).toHaveLength(1);
    expect(res.body.rewards[0].name).toBe('Free T-Shirt');
  });

  it('returns empty rewards array when blood bank has no rewards', async () => {
    const donationRecord = {
      id: 'rec-uuid-2',
      donor_id: 'donor-uuid-1',
      blood_bank_id: 'bank-uuid-2',
      donation_date: '2024-06-01',
      volume_donated: 450,
      location: 'Nairobi',
      created_at: new Date().toISOString(),
    };

    mockQuery.mockResolvedValueOnce({ rows: [donationRecord] });
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/donations')
      .send({
        donor_id: 'donor-uuid-1',
        blood_bank_id: 'bank-uuid-2',
        donation_date: '2024-06-01',
        volume_donated: 450,
        location: 'Nairobi',
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('rewards');
    expect(res.body.rewards).toEqual([]);
  });
});
