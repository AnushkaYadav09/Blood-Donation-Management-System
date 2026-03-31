import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import donorsRouter from './routes/donors';
import donationsRouter from './routes/donations';
import donorDonationsRouter from './routes/donorDonations';
import bloodBanksRouter from './routes/bloodBanks';
import hospitalsRouter from './routes/hospitals';
import donationCampsRouter from './routes/donationCamps';
import screeningRouter from './routes/screening';
import pool from './db';
import jwt from 'jsonwebtoken';

const app = express();

// Security middleware
app.use(helmet());

// CORS middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Visit tracking middleware ────────────────────────────────────────────────
// Tracks every request to /api/* (excluding health + visits endpoints themselves)
app.use('/api', (req, _res, next) => {
  const skip = ['/health', '/visits', '/stats'];
  if (skip.some(s => req.path.startsWith(s))) { next(); return; }

  // Optionally extract donor_id from JWT if present
  let donorId: string | null = null;
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) {
    try {
      const secret = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production';
      const payload = jwt.verify(auth.slice(7), secret) as { id?: string };
      donorId = payload.id ?? null;
    } catch { /* ignore invalid tokens */ }
  }

  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || null;
  const userAgent = req.headers['user-agent'] || null;
  const path = req.path;

  pool.query(
    'INSERT INTO page_visits (path, ip_address, user_agent, donor_id) VALUES ($1, $2, $3, $4)',
    [path, ip, userAgent, donorId]
  ).catch(err => console.error('Visit tracking error:', err));

  next();
});

// ─── Visit stats endpoint ─────────────────────────────────────────────────────
app.get('/api/visits', async (_req, res) => {
  try {
    const [total, today, byPath, daily] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM page_visits'),
      pool.query("SELECT COUNT(*) FROM page_visits WHERE visited_at >= CURRENT_DATE"),
      pool.query(`
        SELECT path, COUNT(*) AS visits
        FROM page_visits
        GROUP BY path ORDER BY visits DESC LIMIT 10
      `),
      pool.query(`
        SELECT DATE(visited_at) AS date, COUNT(*) AS visits
        FROM page_visits
        WHERE visited_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(visited_at) ORDER BY date ASC
      `),
    ]);
    res.json({
      totalVisits: parseInt(total.rows[0].count, 10),
      todayVisits: parseInt(today.rows[0].count, 10),
      topPaths: byPath.rows,
      dailyVisits: daily.rows,
    });
  } catch (err) {
    console.error('Visit stats error:', err);
    res.status(500).json({ error: 'Failed to fetch visit stats' });
  }
});

// Donor routes
app.use('/api/donors', donorsRouter);

// Donation routes
app.use('/api/donations', donationsRouter);

// Donor donation history & next-eligible-date routes
// mergeParams: true is set on the donorDonationsRouter itself so :id is accessible
app.use('/api/donors/:id/donations', donorDonationsRouter);

// Blood bank routes
app.use('/api/blood-banks', bloodBanksRouter);

// Hospital routes
app.use('/api/hospitals', hospitalsRouter);

// Donation camps routes
app.use('/api/donation-camps', donationCampsRouter);

// Screening routes (authenticated: /api/donors/:id/screening, /api/donors/:id/eligibility)
app.use('/api/donors', screeningRouter);

// Stats endpoint for home page
app.get('/api/stats', async (_req, res) => {
  try {
    const [donors, donations, banks, camps] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM donors'),
      pool.query('SELECT COUNT(*) FROM donation_records'),
      pool.query('SELECT COUNT(*) FROM blood_banks'),
      pool.query("SELECT COUNT(*) FROM donation_camps WHERE camp_date >= CURRENT_DATE"),
    ]);
    res.json({
      totalDonors: parseInt(donors.rows[0].count, 10),
      totalDonations: parseInt(donations.rows[0].count, 10),
      totalBloodBanks: parseInt(banks.rows[0].count, 10),
      totalCamps: parseInt(camps.rows[0].count, 10),
    });
  } catch {
    res.json({ totalDonors: 0, totalDonations: 0, totalBloodBanks: 0, totalCamps: 0 });
  }
});

export default app;
