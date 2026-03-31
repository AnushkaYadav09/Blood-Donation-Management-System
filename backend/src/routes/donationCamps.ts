import { Router, Request, Response } from 'express';
import pool from '../db';
import { requireAuth } from '../middleware/auth';
import { sendEmail } from '../utils/email';

const router = Router();

/**
 * GET /api/donation-camps
 * Public endpoint. Returns all upcoming camps.
 */
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT id, name, organizer, camp_date, camp_time, venue, address, goodies
       FROM donation_camps
       WHERE camp_date >= CURRENT_DATE
       ORDER BY camp_date ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('List donation camps error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch donation camps' } });
  }
});

/**
 * GET /api/donation-camps/nearby?lat={lat}&lng={lng}&radius={radius}
 * Public endpoint. Returns future camps sorted by distance ASC.
 * Default radius: 50 km.
 */
router.get('/nearby', async (req: Request, res: Response): Promise<void> => {
  const lat = parseFloat(req.query['lat'] as string);
  const lng = parseFloat(req.query['lng'] as string);
  const radius = parseFloat((req.query['radius'] as string) ?? '50') || 50;

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
         organizer,
         camp_date,
         camp_time,
         venue,
         address,
         goodies,
         ROUND(
           (ST_Distance_Sphere(ST_MakePoint(location_lng, location_lat), ST_MakePoint($2, $1)) / 1000.0)::numeric,
           2
         ) AS distance_km
       FROM donation_camps
       WHERE camp_date >= CURRENT_DATE
         AND ST_Distance_Sphere(ST_MakePoint(location_lng, location_lat), ST_MakePoint($2, $1)) <= $3
       ORDER BY distance_km ASC`,
      [lat, lng, radius * 1000]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Nearby donation camps error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch nearby donation camps' } });
  }
});

/**
 * GET /api/donation-camps/:id
 * Returns single camp detail. Public endpoint.
 */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT id, name, organizer, camp_date, camp_time, venue, address, location_lat, location_lng, goodies
       FROM donation_camps
       WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Donation camp not found' } });
      return;
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Donation camp detail error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch donation camp' } });
  }
});

/**
 * POST /api/donation-camps/:id/register
 * Protected: requireAuth. Registers donor interest in a camp.
 */
router.post('/:id/register', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const camp_id = req.params['id'];
  const donor_id = req.user?.id;

  if (!donor_id) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    return;
  }

  try {
    // Insert registration
    await pool.query(
      `INSERT INTO camp_registrations (camp_id, donor_id) VALUES ($1, $2)`,
      [camp_id, donor_id]
    );

    // Fetch donor email for notification
    const donorResult = await pool.query(
      `SELECT email FROM donors WHERE id = $1`,
      [donor_id]
    );

    // Fetch camp details for notification
    const campResult = await pool.query(
      `SELECT name, camp_date, venue FROM donation_camps WHERE id = $1`,
      [camp_id]
    );

    if (donorResult.rows.length > 0 && campResult.rows.length > 0) {
      const donor = donorResult.rows[0] as { email: string };
      const camp = campResult.rows[0] as { name: string; camp_date: string; venue: string };

      await sendEmail(
        donor.email,
        'Donation Camp Registration Confirmed',
        `<p>You have successfully registered for the donation camp:</p>
         <ul>
           <li><strong>Camp:</strong> ${camp.name}</li>
           <li><strong>Date:</strong> ${camp.camp_date}</li>
           <li><strong>Venue:</strong> ${camp.venue}</li>
         </ul>
         <p>Thank you for your commitment to saving lives!</p>`
      );
    }

    res.status(201).json({ message: 'Registration successful', camp_id, donor_id });
  } catch (err) {
    console.error('Camp registration error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to register for camp' } });
  }
});

export default router;
