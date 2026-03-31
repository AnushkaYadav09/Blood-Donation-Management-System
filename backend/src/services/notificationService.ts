import pool from '../db';
import { sendEmail } from '../utils/email';
import { addMonths } from '../utils/dateUtils';

// node-cron may not have types installed; use require with explicit any
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const cron = require('node-cron') as { schedule: (expr: string, fn: () => void | Promise<void>) => void };

export interface DueReminder {
  donor_id: string;
  email: string;
  full_name: string;
  gender: string;
  last_donation_date: Date;
  next_eligible_date: Date;
}

/**
 * Returns donors whose next eligible donation date is today and who have
 * reminder_notifications_enabled = true.
 */
export async function getDueReminders(): Promise<DueReminder[]> {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const result = await pool.query<{
    donor_id: string;
    email: string;
    full_name: string;
    gender: string;
    last_donation_date: Date;
  }>(
    `SELECT
       d.id AS donor_id,
       d.email,
       d.full_name,
       d.gender,
       MAX(dr.donation_date) AS last_donation_date
     FROM donors d
     JOIN donation_records dr ON dr.donor_id = d.id
     WHERE d.reminder_notifications_enabled = true
     GROUP BY d.id, d.email, d.full_name, d.gender`,
    []
  );

  const due: DueReminder[] = [];

  for (const row of result.rows) {
    const months = row.gender === 'Female' ? 4 : 3;
    const nextEligible = addMonths(new Date(row.last_donation_date), months);
    const nextEligibleStr = nextEligible.toISOString().split('T')[0];

    if (nextEligibleStr === todayStr) {
      due.push({
        donor_id: row.donor_id,
        email: row.email,
        full_name: row.full_name,
        gender: row.gender,
        last_donation_date: new Date(row.last_donation_date),
        next_eligible_date: nextEligible,
      });
    }
  }

  return due;
}

/**
 * Builds the reminder email HTML body for a donor.
 */
export function buildReminderEmailBody(donor: { full_name: string }): string {
  const bloodBanksUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/blood-banks`;
  return `
    <p>Hi ${donor.full_name},</p>
    <p>You are now eligible to donate blood again!</p>
    <p>You are eligible to donate today.</p>
    <p>Find a nearby blood bank here: <a href="${bloodBanksUrl}">${bloodBanksUrl}</a></p>
    <p>Thank you for being a life-saver!</p>
  `;
}

/**
 * Starts a daily cron job at 08:00 AM that sends reminder emails to due donors.
 */
export function startReminderCron(): void {
  cron.schedule('0 8 * * *', async () => {
    console.log('[ReminderCron] Running daily reminder job...');
    let sent = 0;
    let skipped = 0;

    try {
      const reminders = await getDueReminders();

      for (const donor of reminders) {
        if (!donor.email) {
          skipped++;
          continue;
        }

        const html = buildReminderEmailBody(donor);
        await sendEmail(
          donor.email,
          'You are eligible to donate blood today!',
          html
        );
        sent++;
      }
    } catch (err) {
      console.error('[ReminderCron] Error during reminder job:', err);
    }

    console.log(`[ReminderCron] Done. Sent: ${sent}, Skipped: ${skipped}`);
  });

  console.log('[ReminderCron] Daily reminder cron scheduled at 08:00 AM');
}
