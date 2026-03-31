import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import pool from '../db';
import { hashPassword, comparePassword } from '../utils/auth';
import { sendEmail } from '../utils/email';
import { requireAuth } from '../middleware/auth';

const router = Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function issueToken(id: string, email: string, role: string): string {
  const secret = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production';
  const expiresIn = (process.env.JWT_EXPIRES_IN || '30m') as string;
  return jwt.sign({ id, email, role }, secret, { expiresIn } as jwt.SignOptions);
}

// ─── 7.1 Register hospital ────────────────────────────────────────────────────

router.post('/register', async (req: Request, res: Response): Promise<void> => {
  const { name, email, password, address, location_lat, location_lng, contact_number } =
    req.body as Record<string, string>;

  const errors: string[] = [];
  if (!name || !name.trim()) errors.push('name is required');
  if (!email || !EMAIL_REGEX.test(email)) errors.push('email must be a valid address');
  if (!password || password.length < 8) errors.push('password must be at least 8 characters');
  if (!address || !address.trim()) errors.push('address is required');
  if (location_lat === undefined || location_lat === null || location_lat === '')
    errors.push('location_lat is required');
  if (location_lng === undefined || location_lng === null || location_lng === '')
    errors.push('location_lng is required');

  if (errors.length > 0) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: errors } });
    return;
  }

  try {
    const existing = await pool.query('SELECT id FROM hospitals WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      res.status(409).json({ error: { code: 'EMAIL_EXISTS', message: 'Email address is already registered' } });
      return;
    }

    const password_hash = await hashPassword(password);
    const result = await pool.query(
      `INSERT INTO hospitals (name, email, password_hash, address, location_lat, location_lng, contact_number)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, email`,
      [
        name.trim(),
        email.toLowerCase(),
        password_hash,
        address.trim(),
        parseFloat(location_lat),
        parseFloat(location_lng),
        contact_number ? contact_number.trim() : null,
      ]
    );

    res.status(201).json({ id: result.rows[0].id, email: result.rows[0].email });
  } catch (err) {
    console.error('Hospital registration error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Registration failed' } });
  }
});

// ─── 7.1 Login hospital ───────────────────────────────────────────────────────

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'email and password are required' } });
    return;
  }

  try {
    const result = await pool.query(
      'SELECT id, email, name, password_hash, failed_login_attempts, account_locked_until FROM hospitals WHERE email = $1',
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
      return;
    }

    const hospital = result.rows[0];

    if (hospital.account_locked_until && new Date(hospital.account_locked_until) > new Date()) {
      res.status(401).json({
        error: {
          code: 'ACCOUNT_LOCKED',
          message: 'Account is temporarily locked due to too many failed login attempts',
          lockedUntil: hospital.account_locked_until,
        },
      });
      return;
    }

    const valid = await comparePassword(password, hospital.password_hash);

    if (!valid) {
      const newAttempts = (hospital.failed_login_attempts || 0) + 1;

      if (newAttempts >= 5) {
        const lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
        await pool.query(
          'UPDATE hospitals SET failed_login_attempts = 0, account_locked_until = $1 WHERE id = $2',
          [lockedUntil, hospital.id]
        );
        res.status(401).json({
          error: {
            code: 'ACCOUNT_LOCKED',
            message: 'Account locked for 15 minutes after 5 failed attempts',
            lockedUntil,
          },
        });
      } else {
        await pool.query('UPDATE hospitals SET failed_login_attempts = $1 WHERE id = $2', [
          newAttempts,
          hospital.id,
        ]);
        res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
      }
      return;
    }

    // Successful login — reset counter
    await pool.query(
      'UPDATE hospitals SET failed_login_attempts = 0, account_locked_until = NULL WHERE id = $1',
      [hospital.id]
    );

    const token = issueToken(hospital.id, hospital.email, 'hospital');
    res.json({ token, hospital: { id: hospital.id, email: hospital.email, name: hospital.name } });
  } catch (err) {
    console.error('Hospital login error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Login failed' } });
  }
});

// ─── 7.2 / 7.3 / 7.4 Donor search ───────────────────────────────────────────

router.get('/donors/search', requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (req.user!.role !== 'hospital') {
    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Hospital access only' } });
    return;
  }

  const { bloodGroup, lat, lng, radius } = req.query as Record<string, string>;

  if (!bloodGroup) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'bloodGroup is required' } });
    return;
  }

  const searchLat = parseFloat(lat);
  const searchLng = parseFloat(lng);
  const radiusKm = parseFloat(radius) || 10;

  if (isNaN(searchLat) || isNaN(searchLng)) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'lat and lng must be valid numbers' } });
    return;
  }

  try {
    // Eligibility: last donation > 3 months ago (male) or > 4 months ago (female), or no donation
    const queryText = `
      SELECT
        d.id,
        d.full_name,
        d.blood_group,
        d.location_city,
        d.gender,
        ROUND(
          ST_Distance_Sphere(
            ST_MakePoint(d.location_lng, d.location_lat),
            ST_MakePoint($3, $2)
          ) / 1000.0, 2
        ) AS distance_km
      FROM donors d
      LEFT JOIN (
        SELECT donor_id, MAX(donation_date) AS last_donation
        FROM donation_records
        GROUP BY donor_id
      ) ld ON ld.donor_id = d.id
      WHERE
        d.blood_group = $1
        AND d.is_available = true
        AND d.allow_hospital_contact = true
        AND d.location_lat IS NOT NULL
        AND d.location_lng IS NOT NULL
        AND ST_Distance_Sphere(
          ST_MakePoint(d.location_lng, d.location_lat),
          ST_MakePoint($3, $2)
        ) <= $4 * 1000
        AND (
          ld.last_donation IS NULL
          OR (
            d.gender = 'Male' AND ld.last_donation < NOW() - INTERVAL '3 months'
          )
          OR (
            d.gender != 'Male' AND ld.last_donation < NOW() - INTERVAL '4 months'
          )
        )
      ORDER BY distance_km ASC
    `;

    const result = await pool.query(queryText, [bloodGroup, searchLat, searchLng, radiusKm]);

    // 7.4 Privacy masking: only return safe fields (no phone_number or email)
    const donors = result.rows.map((row) => ({
      id: row.id,
      full_name: row.full_name,
      blood_group: row.blood_group,
      location_city: row.location_city,
      distance_km: row.distance_km,
    }));

    res.json(donors);
  } catch (err) {
    console.error('Donor search error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Search failed' } });
  }
});

// ─── 7.5 Contact request ──────────────────────────────────────────────────────

router.post('/contact-requests', requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (req.user!.role !== 'hospital') {
    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Hospital access only' } });
    return;
  }

  const { donor_id, hospital_id, message } = req.body as {
    donor_id?: string;
    hospital_id?: string;
    message?: string;
  };

  if (!donor_id || !hospital_id) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'donor_id and hospital_id are required' } });
    return;
  }

  try {
    // Insert contact request
    const result = await pool.query(
      `INSERT INTO contact_requests (donor_id, hospital_id, message, status)
       VALUES ($1, $2, $3, 'pending')
       RETURNING *`,
      [donor_id, hospital_id, message || null]
    );

    const contactRequest = result.rows[0];

    // 7.7 Send notification email to donor
    const donorResult = await pool.query('SELECT email, full_name FROM donors WHERE id = $1', [donor_id]);
    const hospitalResult = await pool.query('SELECT name FROM hospitals WHERE id = $1', [hospital_id]);

    if (donorResult.rows.length > 0 && hospitalResult.rows.length > 0) {
      const donor = donorResult.rows[0];
      const hospital = hospitalResult.rows[0];

      await sendEmail(
        donor.email,
        'A hospital wants to contact you - Blood Donation System',
        `<p>Hi ${donor.full_name},</p><p>Hospital <strong>${hospital.name}</strong> has sent you a contact request. Log in to accept or decline.</p>`
      );
    }

    res.status(201).json(contactRequest);
  } catch (err) {
    console.error('Contact request error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Contact request failed' } });
  }
});

export default router;
