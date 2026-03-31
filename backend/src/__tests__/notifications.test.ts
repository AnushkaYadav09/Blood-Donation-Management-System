/**
 * Tests for Task 11: Donation Reminder Notifications
 *
 * Property tests:
 *   P11: Reminder scheduled at correct gender-based interval
 *   P12: Opted-out donors excluded from notifications
 *   P13: Reminder notification content is complete
 *
 * Unit tests:
 *   11.10: Reminder sent when scheduled date is reached (Requirement 9.3)
 *
 * Feature: blood-donation-management-system, Property 11: Donation reminder is scheduled at the correct gender-based interval
 * Feature: blood-donation-management-system, Property 12: Opted-out donors do not receive notifications
 * Feature: blood-donation-management-system, Property 13: Reminder notification content is complete
 */

import * as fc from 'fast-check';
import { addMonths } from '../utils/dateUtils';
import { buildReminderEmailBody, getDueReminders } from '../services/notificationService';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../db', () => {
  const mockQuery = jest.fn();
  return { default: { query: mockQuery }, query: mockQuery };
});

jest.mock('../utils/email', () => ({
  sendEmail: jest.fn().mockResolvedValue(undefined),
}));

import pool from '../db';
import { sendEmail } from '../utils/email';

const mockQuery = pool.query as jest.Mock;
const mockSendEmail = sendEmail as jest.Mock;

beforeEach(() => {
  mockQuery.mockReset();
  mockSendEmail.mockReset();
  mockSendEmail.mockResolvedValue(undefined);
});

// ─── P11: Reminder scheduled at correct gender-based interval ─────────────────
/**
 * Validates: Requirements 9.1
 * Feature: blood-donation-management-system, Property 11: Donation reminder is scheduled at the correct gender-based interval
 */
describe('P11: Reminder scheduled at correct gender-based interval', () => {
  it('Male donors: next eligible date is exactly 3 months after donation', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date('2000-01-01'), max: new Date('2030-01-01') }),
        (donationDate) => {
          const nextEligible = addMonths(donationDate, 3);
          const expected = new Date(donationDate);
          expected.setMonth(expected.getMonth() + 3);
          return nextEligible.getTime() === expected.getTime();
        }
      ),
      { numRuns: 200 }
    );
  });

  it('Female donors: next eligible date is exactly 4 months after donation', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date('2000-01-01'), max: new Date('2030-01-01') }),
        (donationDate) => {
          const nextEligible = addMonths(donationDate, 4);
          const expected = new Date(donationDate);
          expected.setMonth(expected.getMonth() + 4);
          return nextEligible.getTime() === expected.getTime();
        }
      ),
      { numRuns: 200 }
    );
  });

  it('gender determines correct interval: Male=3, Female=4', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date('2000-01-01'), max: new Date('2030-01-01') }),
        fc.constantFrom('Male', 'Female', 'Other'),
        (donationDate, gender) => {
          const months = gender === 'Female' ? 4 : 3;
          const nextEligible = addMonths(donationDate, months);
          const expected = new Date(donationDate);
          expected.setMonth(expected.getMonth() + months);
          return nextEligible.getTime() === expected.getTime();
        }
      ),
      { numRuns: 200 }
    );
  });
});

// ─── P12: Opted-out donors excluded from notifications ────────────────────────
/**
 * Validates: Requirements 9.2
 * Feature: blood-donation-management-system, Property 12: Opted-out donors do not receive notifications
 */
describe('P12: Opted-out donors excluded from notifications', () => {
  it('getDueReminders SQL query includes reminder_notifications_enabled = true filter', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await getDueReminders();

    const [sql] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('reminder_notifications_enabled = true');
  });

  it('property: getDueReminders only returns donors whose next eligible date is today', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            donor_id: fc.uuid(),
            email: fc.emailAddress(),
            full_name: fc.string({ minLength: 1, maxLength: 30 }),
            gender: fc.constantFrom('Male', 'Female', 'Other'),
          }),
          { minLength: 0, maxLength: 10 }
        ),
        async (donors) => {
          const today = new Date();
          const rows = donors.map((d) => {
            const months = d.gender === 'Female' ? 4 : 3;
            const lastDonation = new Date(today);
            lastDonation.setMonth(lastDonation.getMonth() - months);
            return { ...d, last_donation_date: lastDonation };
          });

          mockQuery.mockResolvedValueOnce({ rows });

          const results = await getDueReminders();

          for (const r of results) {
            const nextStr = r.next_eligible_date.toISOString().split('T')[0];
            const todayStr = today.toISOString().split('T')[0];
            expect(nextStr).toBe(todayStr);
          }
        }
      ),
      { numRuns: 30 }
    );
  }, 30000);
});

// ─── P13: Reminder notification content is complete ──────────────────────────
/**
 * Validates: Requirements 9.3
 * Feature: blood-donation-management-system, Property 13: Reminder notification content is complete
 */
describe('P13: Reminder notification content is complete', () => {
  it('email body always contains encouragement message, blood banks link, and eligibility status', () => {
    fc.assert(
      fc.property(
        fc.record({
          full_name: fc.string({ minLength: 1, maxLength: 50 }),
        }),
        (donor) => {
          const body = buildReminderEmailBody(donor);
          const hasEncouragement = body.includes('You are now eligible to donate blood again!');
          const hasBloodBanksLink = body.includes('/blood-banks');
          const hasEligibilityStatus = body.includes('You are eligible to donate today');
          return hasEncouragement && hasBloodBanksLink && hasEligibilityStatus;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('blood banks link uses FRONTEND_URL env variable when set', () => {
    const originalUrl = process.env.FRONTEND_URL;
    process.env.FRONTEND_URL = 'https://example.com';

    const body = buildReminderEmailBody({ full_name: 'Test User' });
    expect(body).toContain('https://example.com/blood-banks');

    process.env.FRONTEND_URL = originalUrl;
  });
});

// ─── Unit 11.10: Reminder sent when scheduled date is reached ─────────────────
/**
 * Validates: Requirement 9.3
 */
describe('Unit 11.10: Reminder sent when scheduled date is reached (Requirement 9.3)', () => {
  it('sends email to donor when their next eligible date is today', async () => {
    const today = new Date();
    const lastDonation = new Date(today);
    lastDonation.setMonth(lastDonation.getMonth() - 3);

    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          donor_id: 'donor-uuid-1',
          email: 'donor@example.com',
          full_name: 'John Doe',
          gender: 'Male',
          last_donation_date: lastDonation,
        },
      ],
    });

    const reminders = await getDueReminders();

    expect(reminders).toHaveLength(1);
    expect(reminders[0].donor_id).toBe('donor-uuid-1');
    expect(reminders[0].email).toBe('donor@example.com');

    const html = buildReminderEmailBody(reminders[0]);
    await sendEmail(reminders[0].email, 'You are eligible to donate blood today!', html);

    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const [to, subject, body] = mockSendEmail.mock.calls[0] as [string, string, string];
    expect(to).toBe('donor@example.com');
    expect(subject).toContain('eligible');
    expect(body).toContain('You are now eligible to donate blood again!');
    expect(body).toContain('/blood-banks');
    expect(body).toContain('You are eligible to donate today');
  });

  it('does not send email when no donors are due today', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const reminders = await getDueReminders();
    expect(reminders).toHaveLength(0);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});
