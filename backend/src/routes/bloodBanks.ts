import { Router, Request, Response } from 'express';
import pool from '../db';

const router = Router();

/**
 * GET /api/blood-banks
 * Returns all blood banks. Public endpoint.
 */
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT id, name, address, city, contact_number, operating_hours
       FROM blood_banks
       ORDER BY name ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('List blood banks error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch blood banks' } });
  }
});

/**
 * GET /api/blood-banks/nearby?lat={lat}&lng={lng}&radius={radius}
 * Returns blood banks sorted by distance ASC using PostGIS ST_Distance_Sphere.
 * radius defaults to 10 km.
 */
router.get('/nearby', async (req: Request, res: Response): Promise<void> => {
  const lat = parseFloat(req.query['lat'] as string);
  const lng = parseFloat(req.query['lng'] as string);
  const radius = parseFloat((req.query['radius'] as string) ?? '10') || 10;

  if (isNaN(lat) || isNaN(lng)) {
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'lat and lng query parameters are required and must be numbers' },
    });
    return;
  }

  try {
    const result = await pool.query(
      `SELECT
         id,
         name,
         address,
         city,
         contact_number,
         operating_hours,
         ROUND(
           (ST_Distance_Sphere(ST_MakePoint(location_lng, location_lat), ST_MakePoint($2, $1)) / 1000.0)::numeric,
           2
         ) AS distance_km
       FROM blood_banks
       WHERE ST_Distance_Sphere(ST_MakePoint(location_lng, location_lat), ST_MakePoint($2, $1)) <= $3
       ORDER BY distance_km ASC`,
      [lat, lng, radius * 1000]
    );

    // Sort in application layer as well to guarantee ordering regardless of DB behaviour
    const sorted = (result.rows as Array<{ distance_km: number }>).sort(
      (a, b) => a.distance_km - b.distance_km
    );
    res.json(sorted);
  } catch (err) {
    console.error('Nearby blood banks error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch nearby blood banks' } });
  }
});

/**
 * GET /api/blood-banks/search?location={city}
 * Case-insensitive city search.
 */
router.get('/search', async (req: Request, res: Response): Promise<void> => {
  const location = (req.query['location'] as string) ?? '';

  if (!location.trim()) {
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'location query parameter is required' },
    });
    return;
  }

  try {
    const result = await pool.query(
      `SELECT id, name, address, city, contact_number, operating_hours
       FROM blood_banks
       WHERE city ILIKE $1
       ORDER BY name ASC`,
      [`%${location}%`]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Blood bank search error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to search blood banks' } });
  }
});

/**
 * GET /api/blood-banks/:id/rewards
 * Returns rewards offered by a blood bank.
 * Public endpoint.
 */
router.get('/:id/rewards', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    // Verify blood bank exists
    const bankResult = await pool.query(
      'SELECT id FROM blood_banks WHERE id = $1',
      [id]
    );

    if (bankResult.rows.length === 0) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Blood bank not found' } });
      return;
    }

    const result = await pool.query(
      `SELECT id, reward_name AS name, description, eligibility_condition
       FROM rewards
       WHERE blood_bank_id = $1
       ORDER BY reward_name ASC`,
      [id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Blood bank rewards error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch rewards' } });
  }
});

/**
 * GET /api/blood-banks/:id
 * Returns a single blood bank by id including coordinates.
 */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT id, name, address, city, contact_number, operating_hours, location_lat, location_lng
       FROM blood_banks
       WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Blood bank not found' } });
      return;
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Blood bank detail error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch blood bank' } });
  }
});

export default router;
