import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import pool from '../db';
import { comparePassword, hashPassword } from '../utils/auth';
import { requireAuth } from '../middleware/auth';

const router = Router();

function issueToken(id: string, email: string): string {
  const secret = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production';
  return jwt.sign({ id, email, role: 'admin' }, secret, { expiresIn: '2h' } as jwt.SignOptions);
}

function requireAdmin(req: Request, res: Response, next: () => void): void {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Admin access only' } });
    return;
  }
  next();
}

// POST /api/admin/login
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'email and password required' } });
    return;
  }
  try {
    const result = await pool.query('SELECT id, email, full_name, password_hash FROM admins WHERE email = $1', [email.toLowerCase()]);
    if (result.rows.length === 0) {
      res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' } });
      return;
    }
    const admin = result.rows[0] as { id: string; email: string; full_name: string; password_hash: string };
    const valid = await comparePassword(password, admin.password_hash);
    if (!valid) {
      res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' } });
      return;
    }
    await pool.query('UPDATE admins SET last_login = NOW() WHERE id = $1', [admin.id]);
    const token = issueToken(admin.id, admin.email);
    res.json({ token, admin: { id: admin.id, email: admin.email, full_name: admin.full_name } });
  } catch (err) {
    console.error('Admin login error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Login failed' } });
  }
});

// GET /api/admin/stats — overview numbers
router.get('/stats', requireAuth, (req: Request, res: Response, next: () => void) => { requireAdmin(req, res, next); }, async (_req: Request, res: Response): Promise<void> => {
  try {
    const [donors, donations, screenings, visits, todayLogins] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM donors'),
      pool.query('SELECT COUNT(*) FROM donation_records'),
      pool.query('SELECT COUNT(*) FROM screening_history'),
      pool.query('SELECT COUNT(*) FROM page_visits'),
      pool.query("SELECT COUNT(*) FROM donors WHERE last_login >= CURRENT_DATE"),
    ]);
    res.json({
      totalDonors: parseInt(donors.rows[0].count),
      totalDonations: parseInt(donations.rows[0].count),
      totalScreenings: parseInt(screenings.rows[0].count),
      totalPageVisits: parseInt(visits.rows[0].count),
      todayLogins: parseInt(todayLogins.rows[0].count),
    });
  } catch (err) {
    console.error('Admin stats error:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// GET /api/admin/donors — all donors with activity
router.get('/donors', requireAuth, (req: Request, res: Response, next: () => void) => { requireAdmin(req, res, next); }, async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(`
      SELECT d.id, d.full_name, d.email, d.blood_group, d.gender, d.location_city,
             d.is_available, d.created_at, d.last_login,
             COUNT(DISTINCT dr.id) AS donation_count,
             COUNT(DISTINCT sh.id) AS screening_count,
             MAX(sh.screened_at) AS last_screened
      FROM donors d
      LEFT JOIN donation_records dr ON dr.donor_id = d.id
      LEFT JOIN screening_history sh ON sh.donor_id = d.id
      GROUP BY d.id
      ORDER BY d.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Admin donors error:', err);
    res.status(500).json({ error: 'Failed to fetch donors' });
  }
});

// GET /api/admin/activity — recent page visits
router.get('/activity', requireAuth, (req: Request, res: Response, next: () => void) => { requireAdmin(req, res, next); }, async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(`
      SELECT pv.path, pv.ip_address, pv.visited_at,
             d.full_name AS donor_name, d.email AS donor_email
      FROM page_visits pv
      LEFT JOIN donors d ON d.id = pv.donor_id
      ORDER BY pv.visited_at DESC
      LIMIT 100
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Admin activity error:', err);
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

// POST /api/admin/change-password
router.post('/change-password', requireAuth, (req: Request, res: Response, next: () => void) => { requireAdmin(req, res, next); }, async (req: Request, res: Response): Promise<void> => {
  const { new_password } = req.body as { new_password?: string };
  if (!new_password || new_password.length < 8) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Password must be at least 8 characters' } });
    return;
  }
  try {
    const hash = await hashPassword(new_password);
    await pool.query('UPDATE admins SET password_hash = $1 WHERE id = $2', [hash, req.user!.id]);
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('Admin change password error:', err);
    res.status(500).json({ error: 'Failed to update password' });
  }
});

export default router;
