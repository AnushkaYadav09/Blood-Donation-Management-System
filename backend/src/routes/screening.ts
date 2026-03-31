import { Router, Request, Response } from 'express';
import pool from '../db';
import { requireAuth } from '../middleware/auth';

const router = Router({ mergeParams: true });

interface ScreeningData {
  weight: number;
  hasCommunicableDisease: boolean;
  communicableDiseases: string[];
  hasRecentTattoo: boolean;
  medicalConditions: string[];
  isPregnant?: boolean;
  isBreastfeeding?: boolean;
  lastDonationDate?: string;
}

function calculateAge(dateOfBirth: Date): number {
  const now = new Date();
  let age = now.getFullYear() - dateOfBirth.getFullYear();
  const m = now.getMonth() - dateOfBirth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dateOfBirth.getDate())) {
    age--;
  }
  return age;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function runEligibilityChecks(
  data: ScreeningData,
  gender: string,
  dateOfBirth: Date
): { eligible: boolean; reason?: string } {
  // 4.2 Weight check
  if (data.weight < 50) {
    return { eligible: false, reason: 'We appreciate your willingness to donate! Unfortunately, donors must weigh at least 50 kg to ensure your safety during the donation process. Please consult your doctor if you have questions.' };
  }

  // 4.3 Age check
  const age = calculateAge(dateOfBirth);
  if (age < 18) {
    return { eligible: false, reason: 'Thank you for your interest in donating! Blood donation is open to donors aged 18 and above. We hope to see you when you are eligible!' };
  }

  // 4.4 Communicable disease check
  if (data.hasCommunicableDisease) {
    return { eligible: false, reason: 'Thank you for being honest about your health. For the safety of recipients, donors with active communicable diseases are currently not eligible. Please speak with your doctor and check back when you have recovered.' };
  }

  // 4.5 Pregnancy / breastfeeding (female only)
  if (gender === 'Female') {
    if (data.isPregnant) {
      return { eligible: false, reason: 'Thank you for your kind intention! For your health and the health of your baby, blood donation is not recommended during pregnancy. You are welcome to donate after your pregnancy and recovery period.' };
    }
    if (data.isBreastfeeding) {
      return { eligible: false, reason: 'Thank you for your interest! For your wellbeing and your baby\'s nutrition, we recommend waiting until you have finished breastfeeding before donating blood.' };
    }
  }

  // 4.6 Donation interval check
  if (data.lastDonationDate) {
    const lastDonation = new Date(data.lastDonationDate);
    // Males: 3 months, Females: 6 months (standard WHO guideline)
    const intervalMonths = gender === 'Female' ? 6 : 3;
    const nextEligible = addMonths(lastDonation, intervalMonths);
    if (new Date() < nextEligible) {
      const nextDateStr = nextEligible.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
      const intervalLabel = gender === 'Female' ? '6 months' : '3 months';
      return {
        eligible: false,
        reason: `Thank you for your previous donation! For your health and safety, ${gender === 'Female' ? 'female' : 'male'} donors must wait ${intervalLabel} between donations. You will be eligible to donate again on ${nextDateStr}. We look forward to seeing you then! 💙`,
      };
    }
  }

  return { eligible: true };
}

// POST /api/donors/guest/screening — unauthenticated eligibility check
router.post('/guest/screening', async (req: Request, res: Response): Promise<void> => {
  const data = req.body as ScreeningData & { gender?: string; date_of_birth?: string };

  if (
    typeof data.weight !== 'number' ||
    typeof data.hasCommunicableDisease !== 'boolean' ||
    !Array.isArray(data.communicableDiseases) ||
    typeof data.hasRecentTattoo !== 'boolean' ||
    !Array.isArray(data.medicalConditions)
  ) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Missing or invalid screening fields' } });
    return;
  }

  const gender = data.gender || 'Other';
  const dateOfBirth = data.date_of_birth ? new Date(data.date_of_birth) : new Date('2000-01-01');
  const eligibility = runEligibilityChecks(data, gender, dateOfBirth);
  res.json(eligibility);
});

// POST /api/donors/:id/screening
router.post('/:id/screening', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  const data = req.body as ScreeningData;

  if (
    typeof data.weight !== 'number' ||
    typeof data.hasCommunicableDisease !== 'boolean' ||
    !Array.isArray(data.communicableDiseases) ||
    typeof data.hasRecentTattoo !== 'boolean' ||
    !Array.isArray(data.medicalConditions)
  ) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Missing or invalid screening fields' } });
    return;
  }

  try {
    const result = await pool.query(
      'SELECT gender, date_of_birth FROM donors WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Donor not found' } });
      return;
    }

    const { gender, date_of_birth } = result.rows[0];
    const dateOfBirth = new Date(date_of_birth);

    const eligibility = runEligibilityChecks(data, gender, dateOfBirth);
    res.json(eligibility);
  } catch (err) {
    console.error('Screening error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Screening check failed' } });
  }
});

// GET /api/donors/:id/eligibility
router.get('/:id/eligibility', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT gender, date_of_birth,
              (SELECT MAX(donation_date) FROM donations WHERE donor_id = $1) AS last_donation_date,
              (SELECT COUNT(*) FROM donations WHERE donor_id = $1) AS total_donations
       FROM donors WHERE id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Donor not found' } });
      return;
    }
    const { gender, last_donation_date, total_donations } = result.rows[0];
    const intervalMonths = gender === 'Female' ? 6 : 3;
    let nextEligibleDate: string | null = null;
    if (last_donation_date) {
      const next = addMonths(new Date(last_donation_date), intervalMonths);
      if (next > new Date()) nextEligibleDate = next.toISOString().split('T')[0];
    }
    res.json({ nextEligibleDate, totalDonations: parseInt(total_donations, 10) });
  } catch (err) {
    console.error('Eligibility check error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Eligibility check failed' } });
  }
});

export default router;