import { Router, Request, Response } from 'express';
import pool from '../db';
import { requireAuth } from '../middleware/auth';
import { addMonths } from '../utils/dateUtils';

const router = Router({ mergeParams: true });

/**
 * GET /api/donors/:id/donations
 * Returns all donation_records for the donor, joined with blood_banks.name,
 * sorted by donation_date DESC.
 * Protected: requireAuth
 */
router.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT dr.id, dr.donor_id, dr.blood_bank_id, dr.donation_date,
              dr.volume_donated, dr.location, dr.created_at,
              bb.name AS blood_bank_name
       FROM donation_records dr
       LEFT JOIN blood_banks bb ON bb.id = dr.blood_bank_id
       WHERE dr.donor_id = $1
       ORDER BY dr.donation_date DESC`,
      [id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Donation history error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch donation history' } });
  }
});

/**
 * GET /api/donors/:id/next-eligible-date
 * Returns the next eligible donation date based on gender and most recent donation.
 * Protected: requireAuth
 *
 * Response: { nextEligibleDate: string | null, totalDonations: number }
 */
router.get('/next-eligible-date', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    // Fetch donor gender
    const donorResult = await pool.query(
      'SELECT gender FROM donors WHERE id = $1',
      [id]
    );

    if (donorResult.rows.length === 0) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Donor not found' } });
      return;
    }

    const { gender } = donorResult.rows[0];

    // Fetch most recent donation date and total count
    const donationResult = await pool.query(
      `SELECT MAX(donation_date) AS last_donation_date, COUNT(*) AS total_donations
       FROM donation_records
       WHERE donor_id = $1`,
      [id]
    );

    const { last_donation_date, total_donations } = donationResult.rows[0];
    const totalDonations = parseInt(total_donations, 10);

    if (!last_donation_date) {
      res.json({ nextEligibleDate: null, totalDonations });
      return;
    }

    const intervalMonths = gender === 'Female' ? 4 : 3;
    const nextEligibleDate = addMonths(new Date(last_donation_date), intervalMonths);

    res.json({
      nextEligibleDate: nextEligibleDate.toISOString().split('T')[0],
      totalDonations,
    });
  } catch (err) {
    console.error('Next eligible date error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to calculate next eligible date' } });
  }
});

/**
 * GET /api/donors/:id/earned-rewards
 * Returns rewards earned by the donor based on their donation history.
 * Protected: requireAuth, donor must own the id.
 */
router.get('/earned-rewards', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT
         r.id AS reward_id,
         r.reward_name AS reward_name,
         r.description,
         bb.name AS blood_bank_name,
         dr.donation_date AS earned_on
       FROM donation_records dr
       JOIN rewards r ON r.blood_bank_id = dr.blood_bank_id
       JOIN blood_banks bb ON bb.id = dr.blood_bank_id
       WHERE dr.donor_id = $1
       ORDER BY dr.donation_date DESC`,
      [id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Earned rewards error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch earned rewards' } });
  }
});

export default router;
