/**
 * Tests for Task 6: Location-Based Blood Bank Discovery
 *
 * Property tests:
 *   P9: Blood bank search results are sorted by distance
 *
 * Unit tests:
 *   6.8: GET /api/blood-banks/:id returns all required fields (Requirement 4.4)
 *
 * Feature: blood-donation-management-system, Property 9: Blood bank search results are sorted by distance
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

import pool from '../db';

const mockQuery = pool.query as jest.Mock;

beforeEach(() => mockQuery.mockReset());

// ─── P9: Blood bank results sorted by distance ────────────────────────────────
/**
 * Validates: Requirements 4.2
 * Feature: blood-donation-management-system, Property 9: Blood bank search results are sorted by distance
 */
describe('P9: Blood bank search results are sorted by distance', () => {
  /**
   * Pure property: given any array of blood banks with lat/lng, computing
   * distances from a fixed donor location and sorting ASC yields a
   * non-decreasing sequence.
   */
  it('sorting blood banks by computed distance yields non-decreasing order', () => {
    // Haversine-like approximation (flat-earth for property purposes)
    function distanceMeters(
      donorLat: number,
      donorLng: number,
      bankLat: number,
      bankLng: number
    ): number {
      const R = 6371000;
      const dLat = ((bankLat - donorLat) * Math.PI) / 180;
      const dLng = ((bankLng - donorLng) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((donorLat * Math.PI) / 180) *
          Math.cos((bankLat * Math.PI) / 180) *
          Math.sin(dLng / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    fc.assert(
      fc.property(
        // Fixed donor location
        fc.float({ min: -90, max: 90, noNaN: true }),
        fc.float({ min: -180, max: 180, noNaN: true }),
        // Array of blood banks
        fc.array(
          fc.record({
            id: fc.uuid(),
            location_lat: fc.float({ min: -90, max: 90, noNaN: true }),
            location_lng: fc.float({ min: -180, max: 180, noNaN: true }),
          }),
          { minLength: 0, maxLength: 20 }
        ),
        (donorLat, donorLng, banks) => {
          const withDist = banks.map((b) => ({
            ...b,
            distance_meters: distanceMeters(donorLat, donorLng, b.location_lat, b.location_lng),
          }));
          const sorted = [...withDist].sort((a, b) => a.distance_meters - b.distance_meters);
          for (let i = 1; i < sorted.length; i++) {
            if (sorted[i].distance_meters < sorted[i - 1].distance_meters) return false;
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * API test: mock pool.query returns records with distance_meters in random
   * order; assert the response is sorted ASC by distance_km.
   */
  it('GET /api/blood-banks/nearby returns results sorted ASC by distance_km', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.uuid(),
            name: fc.string({ minLength: 1, maxLength: 30 }),
            address: fc.string({ minLength: 1, maxLength: 60 }),
            city: fc.string({ minLength: 1, maxLength: 30 }),
            contact_number: fc.option(fc.string({ minLength: 5, maxLength: 15 }), { nil: null }),
            operating_hours: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: null }),
            // distance_km as returned by the DB query (already rounded)
            distance_km: fc.float({ min: 0, max: 10, noNaN: true }).map((v) =>
              Math.round(v * 100) / 100
            ),
          }),
          { minLength: 0, maxLength: 15 }
        ),
        async (records) => {
          // Shuffle the records before returning from mock to simulate unsorted DB
          const shuffled = [...records].sort(() => Math.random() - 0.5);
          mockQuery.mockResolvedValueOnce({ rows: shuffled });

          const res = await request(app).get(
            '/api/blood-banks/nearby?lat=1.2921&lng=36.8219&radius=10'
          );
          expect(res.status).toBe(200);

          const body = res.body as Array<{ distance_km: number }>;
          for (let i = 1; i < body.length; i++) {
            expect(body[i].distance_km).toBeGreaterThanOrEqual(body[i - 1].distance_km);
          }
        }
      ),
      { numRuns: 50 }
    );
  }, 30000);
});

// ─── Unit 6.8: GET /api/blood-banks/:id returns all required fields ───────────
/**
 * Validates: Requirement 4.4
 * Tag: Requirement 4.4
 */
describe('GET /api/blood-banks/:id - blood bank detail contains all required fields (Requirement 4.4)', () => {
  it('returns id, name, address, city, contact_number, operating_hours, location_lat, location_lng', async () => {
    const mockBank = {
      id: 'bb-uuid-1',
      name: 'City Blood Bank',
      address: '123 Main Street',
      city: 'Nairobi',
      contact_number: '+254700000001',
      operating_hours: 'Mon-Fri 8am-5pm',
      location_lat: -1.2921,
      location_lng: 36.8219,
    };

    mockQuery.mockResolvedValueOnce({ rows: [mockBank] });

    const res = await request(app).get('/api/blood-banks/bb-uuid-1');

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(mockBank.id);
    expect(res.body.name).toBe(mockBank.name);
    expect(res.body.address).toBe(mockBank.address);
    expect(res.body.city).toBe(mockBank.city);
    expect(res.body.contact_number).toBe(mockBank.contact_number);
    expect(res.body.operating_hours).toBe(mockBank.operating_hours);
    expect(res.body.location_lat).toBe(mockBank.location_lat);
    expect(res.body.location_lng).toBe(mockBank.location_lng);
  });

  it('returns 404 when blood bank is not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/blood-banks/nonexistent-id');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
