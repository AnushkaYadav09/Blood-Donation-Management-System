/**
 * Tests for Task 8: Donor Availability Toggle
 *
 * Unit tests:
 *   8.4: PUT /api/donors/:id/availability persists availability (Requirement 6.4)
 *
 * Validates: Requirement 6.4
 */

import request from 'supertest';
import app from '../app';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../db', () => {
  const mockQuery = jest.fn();
  return { default: { query: mockQuery }, query: mockQuery };
});

// Auth middleware mock — injects donor-1 as the authenticated user by default.
// Individual tests override this via the module factory below.
let mockUserId = 'donor-1';

jest.mock('../middleware/auth', () => ({
  requireAuth: (req: { user?: { id: string; email: string; role: string } }, _res: unknown, next: () => void) => {
    req.user = { id: mockUserId, email: 'donor@example.com', role: 'donor' };
    next();
  },
}));

import pool from '../db';

const mockQuery = pool.query as jest.Mock;

// ─── Unit 8.4: Availability toggle ───────────────────────────────────────────

describe('PUT /api/donors/:id/availability (Requirement 6.4)', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockUserId = 'donor-1';
  });

  it('updates is_available to false and returns { id, is_available }', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'donor-1', is_available: false }],
    });

    const res = await request(app)
      .put('/api/donors/donor-1/availability')
      .send({ is_available: false });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('donor-1');
    expect(res.body.is_available).toBe(false);

    // Verify the correct SQL was called
    expect(mockQuery).toHaveBeenCalledTimes(1);
    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('UPDATE donors');
    expect(sql).toContain('is_available');
    expect(params[0]).toBe(false);
    expect(params[1]).toBe('donor-1');
  });

  it('updates is_available to true and returns { id, is_available }', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'donor-1', is_available: true }],
    });

    const res = await request(app)
      .put('/api/donors/donor-1/availability')
      .send({ is_available: true });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('donor-1');
    expect(res.body.is_available).toBe(true);
  });

  it('returns 403 when a different donor token is used', async () => {
    mockUserId = 'donor-other';

    const res = await request(app)
      .put('/api/donors/donor-1/availability')
      .send({ is_available: false });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('returns 400 when is_available is not a boolean', async () => {
    const res = await request(app)
      .put('/api/donors/donor-1/availability')
      .send({ is_available: 'yes' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(mockQuery).not.toHaveBeenCalled();
  });
});
