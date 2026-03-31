import { Router, Request, Response } from 'express';
import pool from '../db';
import { requireAuth } from '../middleware/auth';

const router = Router();

/**
 * POST /api/donations
 * Records a new donation.
 * Protected: requireAuth
 *
 * Body: { donor_id, blood_bank_id, donation_date, volume_donated, location }
 *
 * Note (Task 5.4 / Requirement 3.4): Eligibility status is implicitly updated
 * because GET /api/donors/:id/eligibility reads from donation_records at query
 * time. No separate eligibility field needs to be written here.
 */
router.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { donor_id, blood_bank_id, donation_date, volume_donated, location } = req.body as {
    donor_id?: string;
    blood_bank_id?: string;
    donation_date?: string;
    volume_donated?: number;
    location?: string;
  };

  if (!donor_id || !blood_bank_id || !donation_date || volume_donated == null || !location) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'donor_id, blood_bank_id, donation_date, volume_donated, and location are all required',
      },
    });
    return;
  }

  try {
    const result = await pool.query(
      `INSERT INTO donation_records (donor_id, blood_bank_id, donation_date, volume_donated, location)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, donor_id, blood_bank_id, donation_date, volume_donated, location, created_at`,
      [donor_id, blood_bank_id, donation_date, volume_donated, location]
    );

    const donationRecord = result.rows[0];

    // Fetch rewards for the blood bank
    const rewardsResult = await pool.query(
      `SELECT id, reward_name AS name, description, eligibility_condition
       FROM rewards
       WHERE blood_bank_id = $1
       ORDER BY reward_name ASC`,
      [blood_bank_id]
    );

    res.status(201).json({ ...donationRecord, rewards: rewardsResult.rows });
  } catch (err) {
    console.error('Record donation error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to record donation' } });
  }
});

export default router;
