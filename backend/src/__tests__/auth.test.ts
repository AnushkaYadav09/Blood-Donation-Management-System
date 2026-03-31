/**
 * Tests for Task 2: Donor Authentication and Account Management
 *
 * Unit tests cover: login flows, account lockout, password reset token generation,
 * bcrypt hash/compare.
 *
 * Property test (P14): Unauthenticated requests to protected endpoints are rejected.
 * Feature: blood-donation-management-system, Property 14: Unauthenticated requests to protected endpoints are rejected
 */

import request from 'supertest';
import * as fc from 'fast-check';
import jwt from 'jsonwebtoken';
import app from '../app';
import { hashPassword, comparePassword } from '../utils/auth';

// ─── Mock the database pool ───────────────────────────────────────────────────

jest.mock('../db', () => {
  const mockQuery = jest.fn();
  return { query: mockQuery, default: { query: mockQuery } };
});

// ─── Mock email utility ───────────────────────────────────────────────────────

jest.mock('../utils/email', () => ({
  sendEmail: jest.fn().mockResolvedValue(undefined),
}));

import pool from '../db';
const mockQuery = pool.query as jest.Mock;

// ─── Helper: build a donor row ────────────────────────────────────────────────

async function makeDonorRow(overrides: Partial<{
  id: string;
  email: string;
  full_name: string;
  password_hash: string;
  failed_login_attempts: number;
  account_locked_until: Date | null;
}> = {}) {
  return {
    id: 'donor-uuid-1',
    email: 'test@example.com',
    full_name: 'Test Donor',
    password_hash: await hashPassword('correct-password'),
    failed_login_attempts: 0,
    account_locked_until: null,
    ...overrides,
  };
}

// ─── bcrypt hash/compare ──────────────────────────────────────────────────────

describe('hashPassword / comparePassword', () => {
  it('hashes a password and verifies it correctly', async () => {
    const hash = await hashPassword('my-secret-123');
    expect(hash).not.toBe('my-secret-123');
    await expect(comparePassword('my-secret-123', hash)).resolves.toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await hashPassword('correct');
    await expect(comparePassword('wrong', hash)).resolves.toBe(false);
  });

  it('produces different hashes for the same input (salted)', async () => {
    const h1 = await hashPassword('same');
    const h2 = await hashPassword('same');
    expect(h1).not.toBe(h2);
  });
});

// ─── Login: successful login returns JWT ─────────────────────────────────────

describe('POST /api/donors/login', () => {
  beforeEach(() => mockQuery.mockReset());

  it('returns a JWT and donor info on successful login', async () => {
    const donor = await makeDonorRow();
    mockQuery
      .mockResolvedValueOnce({ rows: [donor] })   // SELECT donor
      .mockResolvedValueOnce({ rows: [] });         // UPDATE last_login

    const res = await request(app)
      .post('/api/donors/login')
      .send({ email: 'test@example.com', password: 'correct-password' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.donor.email).toBe('test@example.com');

    // Verify the JWT payload
    const secret = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production';
    const decoded = jwt.verify(res.body.token, secret) as { id: string; email: string; role: string };
    expect(decoded.role).toBe('donor');
    expect(decoded.email).toBe('test@example.com');
  });

  it('returns 400 when email or password is missing', async () => {
    const res = await request(app).post('/api/donors/login').send({ email: 'x@x.com' });
    expect(res.status).toBe(400);
  });

  it('returns 401 for unknown email', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .post('/api/donors/login')
      .send({ email: 'nobody@example.com', password: 'pass' });
    expect(res.status).toBe(401);
  });

  // ─── Wrong password increments counter ──────────────────────────────────────

  it('increments failed_login_attempts on wrong password', async () => {
    const donor = await makeDonorRow({ failed_login_attempts: 1 });
    mockQuery
      .mockResolvedValueOnce({ rows: [donor] })   // SELECT
      .mockResolvedValueOnce({ rows: [] });         // UPDATE attempts

    const res = await request(app)
      .post('/api/donors/login')
      .send({ email: 'test@example.com', password: 'wrong-password' });

    expect(res.status).toBe(401);
    // Verify the UPDATE was called with attempts = 2
    const updateCall = mockQuery.mock.calls[1];
    expect(updateCall[1][0]).toBe(2);
  });

  // ─── 5th wrong password locks account ───────────────────────────────────────

  it('locks account after 5th failed attempt', async () => {
    const donor = await makeDonorRow({ failed_login_attempts: 4 });
    mockQuery
      .mockResolvedValueOnce({ rows: [donor] })   // SELECT
      .mockResolvedValueOnce({ rows: [] });         // UPDATE lock

    const res = await request(app)
      .post('/api/donors/login')
      .send({ email: 'test@example.com', password: 'wrong-password' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('ACCOUNT_LOCKED');
    expect(res.body.error.lockedUntil).toBeDefined();

    // Verify the UPDATE set failed_login_attempts = 0 and account_locked_until
    const updateCall = mockQuery.mock.calls[1];
    expect(updateCall[0]).toContain('account_locked_until');
    expect(updateCall[1][0]).toBe(0); // reset counter
  });

  // ─── Locked account returns 401 ─────────────────────────────────────────────

  it('returns 401 with lock expiry when account is locked', async () => {
    const lockedUntil = new Date(Date.now() + 10 * 60 * 1000); // 10 min from now
    const donor = await makeDonorRow({ account_locked_until: lockedUntil });
    mockQuery.mockResolvedValueOnce({ rows: [donor] });

    const res = await request(app)
      .post('/api/donors/login')
      .send({ email: 'test@example.com', password: 'any-password' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('ACCOUNT_LOCKED');
    expect(res.body.error.lockedUntil).toBeDefined();
  });
});

// ─── Password reset token generation ─────────────────────────────────────────

describe('POST /api/donors/forgot-password', () => {
  beforeEach(() => mockQuery.mockReset());

  it('returns 200 even when email is not found (no enumeration)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .post('/api/donors/forgot-password')
      .send({ email: 'nobody@example.com' });
    expect(res.status).toBe(200);
    expect(res.body.message).toContain('reset link');
  });

  it('inserts a reset token when email exists', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'donor-1', full_name: 'Alice' }] }) // SELECT donor
      .mockResolvedValueOnce({ rows: [] }); // INSERT token

    const res = await request(app)
      .post('/api/donors/forgot-password')
      .send({ email: 'alice@example.com' });

    expect(res.status).toBe(200);
    // Verify INSERT was called with a token_hash and expires_at
    const insertCall = mockQuery.mock.calls[1];
    expect(insertCall[0]).toContain('INSERT INTO password_reset_tokens');
    expect(insertCall[1][1]).toBeDefined(); // token_hash
    expect(insertCall[1][2]).toBeInstanceOf(Date); // expires_at
  });
});

// ─── JWT middleware ───────────────────────────────────────────────────────────

describe('requireAuth middleware (via /api/donors/refresh)', () => {
  it('returns 401 when no Authorization header is provided', async () => {
    const res = await request(app).post('/api/donors/refresh');
    expect(res.status).toBe(401);
  });

  it('returns 401 for a malformed token', async () => {
    const res = await request(app)
      .post('/api/donors/refresh')
      .set('Authorization', 'Bearer not-a-valid-jwt');
    expect(res.status).toBe(401);
  });

  it('returns 200 with a new token for a valid JWT', async () => {
    const secret = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production';
    const token = jwt.sign({ id: 'u1', email: 'a@b.com', role: 'donor' }, secret, { expiresIn: '30m' });

    const res = await request(app)
      .post('/api/donors/refresh')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });
});

// ─── P14: Property test — unauthenticated requests are always rejected ────────
/**
 * Validates: Requirements 10.1
 * Feature: blood-donation-management-system, Property 14: Unauthenticated requests to protected endpoints are rejected
 */

describe('P14: Unauthenticated requests to protected endpoints are rejected', () => {
  // Protected endpoints to test against
  const protectedEndpoints = [
    { method: 'post' as const, path: '/api/donors/refresh' },
    { method: 'put' as const, path: '/api/donors/some-id/profile' },
  ];

  it('always returns 401 for random/garbage tokens on protected endpoints', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random strings including empty string and garbage
        fc.oneof(
          fc.constant(''),
          fc.string({ minLength: 1, maxLength: 200 }),
          fc.base64String({ minLength: 0, maxLength: 200 }),
        ),
        async (randomToken) => {
          for (const endpoint of protectedEndpoints) {
            const req = request(app)[endpoint.method](endpoint.path);

            // Attach token if non-empty (empty = no header)
            if (randomToken.length > 0) {
              req.set('Authorization', `Bearer ${randomToken}`);
            }

            const res = await req.send({});
            expect(res.status).toBe(401);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
