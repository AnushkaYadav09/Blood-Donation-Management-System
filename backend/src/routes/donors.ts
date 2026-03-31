import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import pool from '../db';
import { hashPassword, comparePassword } from '../utils/auth';
import { sendEmail } from '../utils/email';
import { requireAuth } from '../middleware/auth';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const router = Router();

const VALID_BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const VALID_GENDERS = ['Male', 'Female', 'Other'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateRegistration(body: Record<string, unknown>): string[] {
  const errors: string[] = [];
  const { full_name, blood_group, phone_number, email, date_of_birth, gender, location_city, password } = body as Record<string, string>;
  if (!full_name || !full_name.trim()) errors.push('full_name is required');
  if (!blood_group || !VALID_BLOOD_GROUPS.includes(blood_group))
    errors.push('blood_group must be one of: ' + VALID_BLOOD_GROUPS.join(', '));
  if (!phone_number || !phone_number.trim()) errors.push('phone_number is required');
  if (phone_number && !/^\+91[6-9]\d{9}$/.test(phone_number.replace(/\s/g, ''))) errors.push('phone_number must be a valid Indian mobile number starting with +91');
  if (!email || !EMAIL_REGEX.test(email)) errors.push('email must be a valid RFC format address');
  if (!gender || !VALID_GENDERS.includes(gender))
    errors.push('gender must be one of: ' + VALID_GENDERS.join(', '));
  if (!location_city || !location_city.trim()) errors.push('location_city is required');
  if (!password || password.length < 8) errors.push('password must be at least 8 characters');
  if (password && !/[A-Z]/.test(password)) errors.push('password must contain at least 1 uppercase letter');
  if (password && !/[0-9]/.test(password)) errors.push('password must contain at least 1 number');
  if (password && !/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) errors.push('password must contain at least 1 special character');
  if (date_of_birth) {
    const dob = new Date(date_of_birth);
    if (isNaN(dob.getTime())) {
      errors.push('date_of_birth must be a valid date');
    } else {
      const age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
      if (age < 18) errors.push('Donor must be at least 18 years old');
    }
  } else {
    errors.push('date_of_birth is required');
  }
  return errors;
}

function issueToken(id: string, email: string, role: string): string {
  const secret = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production';
  const expiresIn = (process.env.JWT_EXPIRES_IN || '30m') as string;
  return jwt.sign({ id, email, role }, secret, { expiresIn } as jwt.SignOptions);
}

// Google OAuth
router.post('/google-auth', async (req: Request, res: Response): Promise<void> => {
  const { credential } = req.body as { credential?: string };
  if (!credential) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Google credential is required' } });
    return;
  }
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: process.env.GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      res.status(401).json({ error: { code: 'INVALID_TOKEN', message: 'Invalid Google token' } });
      return;
    }
    const { sub: googleId, email, name } = payload;
    const existing = await pool.query(
      'SELECT id, email, full_name, google_id FROM donors WHERE email = $1 OR google_id = $2',
      [email.toLowerCase(), googleId]
    );
    let donorId: string, donorEmail: string, donorName: string;
    if (existing.rows.length > 0) {
      const donor = existing.rows[0];
      if (!donor.google_id) {
        await pool.query('UPDATE donors SET google_id = $1, updated_at = NOW() WHERE id = $2', [googleId, donor.id]);
      }
      await pool.query('UPDATE donors SET last_login = NOW() WHERE id = $1', [donor.id]);
      donorId = donor.id; donorEmail = donor.email; donorName = donor.full_name;
    } else {
      const result = await pool.query(
        `INSERT INTO donors (full_name, email, google_id, gender, blood_group, location_city)
         VALUES ($1, $2, $3, 'Other', 'O+', 'Unknown') RETURNING id, email, full_name`,
        [name || email.split('@')[0], email.toLowerCase(), googleId]
      );
      donorId = result.rows[0].id; donorEmail = result.rows[0].email; donorName = result.rows[0].full_name;
      await sendEmail(donorEmail, 'Welcome to BloodConnect',
        '<p>Hi ' + donorName + ',</p><p>Please complete your profile to get started!</p>');
    }
    const token = issueToken(donorId, donorEmail, 'donor');
    res.json({ token, donor: { id: donorId, email: donorEmail, full_name: donorName } });
  } catch (err) {
    console.error('Google auth error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Google authentication failed' } });
  }
});

// Register
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  const errors = validateRegistration(req.body);
  if (errors.length > 0) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: errors } });
    return;
  }
  const { full_name, blood_group, phone_number, email, date_of_birth, gender, location_city, password } = req.body as Record<string, string>;
  try {
    const existing = await pool.query('SELECT id FROM donors WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      res.status(409).json({ error: { code: 'EMAIL_EXISTS', message: 'Email address is already registered' } });
      return;
    }
    const password_hash = await hashPassword(password);
    const result = await pool.query(
      `INSERT INTO donors (full_name, email, password_hash, phone_number, date_of_birth, gender, blood_group, location_city)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, email`,
      [full_name.trim(), email.toLowerCase(), password_hash, phone_number.trim(), date_of_birth, gender, blood_group, location_city.trim()]
    );
    const donor = result.rows[0];
    await sendEmail(donor.email, 'Welcome to BloodConnect',
      '<p>Hi ' + full_name + ',</p><p>Your registration was successful. Thank you for joining!</p>');
    res.status(201).json({ id: donor.id, email: donor.email });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Registration failed' } });
  }
});

// Check email
router.get('/check-email/:email', async (req: Request, res: Response): Promise<void> => {
  const { email } = req.params;
  try {
    const result = await pool.query('SELECT id FROM donors WHERE email = $1', [email.toLowerCase()]);
    res.json({ available: result.rows.length === 0 });
  } catch (err) {
    console.error('Check email error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Check failed' } });
  }
});

// Login
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'email and password are required' } });
    return;
  }
  try {
    const result = await pool.query(
      'SELECT id, email, full_name, password_hash, failed_login_attempts, account_locked_until FROM donors WHERE email = $1',
      [email.toLowerCase()]
    );
    if (result.rows.length === 0) {
      res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
      return;
    }
    const donor = result.rows[0];
    if (donor.account_locked_until && new Date(donor.account_locked_until) > new Date()) {
      res.status(401).json({ error: { code: 'ACCOUNT_LOCKED', message: 'Account is temporarily locked', lockedUntil: donor.account_locked_until } });
      return;
    }
    const valid = await comparePassword(password, donor.password_hash);
    if (!valid) {
      const newAttempts = (donor.failed_login_attempts || 0) + 1;
      if (newAttempts >= 5) {
        const lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
        await pool.query('UPDATE donors SET failed_login_attempts = 0, account_locked_until = $1 WHERE id = $2', [lockedUntil, donor.id]);
        await sendEmail(donor.email, 'Account Locked', '<p>Your account has been locked for 15 minutes.</p>');
        res.status(401).json({ error: { code: 'ACCOUNT_LOCKED', message: 'Account locked for 15 minutes', lockedUntil } });
      } else {
        await pool.query('UPDATE donors SET failed_login_attempts = $1 WHERE id = $2', [newAttempts, donor.id]);
        res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
      }
      return;
    }
    await pool.query('UPDATE donors SET failed_login_attempts = 0, account_locked_until = NULL, last_login = NOW() WHERE id = $1', [donor.id]);
    const token = issueToken(donor.id, donor.email, 'donor');
    res.json({ token, donor: { id: donor.id, email: donor.email, full_name: donor.full_name } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Login failed' } });
  }
});

// Token refresh
router.post('/refresh', requireAuth, (req: Request, res: Response): void => {
  const user = req.user!;
  const token = issueToken(user.id, user.email, user.role);
  res.json({ token });
});

// Forgot password
router.post('/forgot-password', async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body as { email?: string };
  if (!email) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'email is required' } });
    return;
  }
  try {
    const result = await pool.query('SELECT id, full_name FROM donors WHERE email = $1', [email.toLowerCase()]);
    if (result.rows.length === 0) {
      res.json({ message: 'If that email is registered, a reset link has been sent.' });
      return;
    }
    const donor = result.rows[0];
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await pool.query('INSERT INTO password_reset_tokens (donor_id, token_hash, expires_at) VALUES ($1, $2, $3)', [donor.id, tokenHash, expiresAt]);
    const resetLink = (process.env.FRONTEND_URL || 'http://localhost:3000') + '/reset-password?token=' + rawToken;
    await sendEmail(email.toLowerCase(), 'Password Reset - BloodConnect',
      '<p>Hi ' + donor.full_name + ',</p><p><a href="' + resetLink + '">Click here to reset your password</a> (valid 1 hour).</p>');
    res.json({ message: 'If that email is registered, a reset link has been sent.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Request failed' } });
  }
});

// Reset password
router.post('/reset-password', async (req: Request, res: Response): Promise<void> => {
  const { token, new_password } = req.body as { token?: string; new_password?: string };
  if (!token || !new_password || new_password.length < 8) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'token and new_password (min 8 chars) are required' } });
    return;
  }
  try {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const result = await pool.query(
      'SELECT id, donor_id FROM password_reset_tokens WHERE token_hash = $1 AND expires_at > NOW() AND used_at IS NULL',
      [tokenHash]
    );
    if (result.rows.length === 0) {
      res.status(400).json({ error: { code: 'INVALID_TOKEN', message: 'Token is invalid or has expired' } });
      return;
    }
    const { id: tokenId, donor_id } = result.rows[0];
    const password_hash = await hashPassword(new_password);
    await pool.query('UPDATE donors SET password_hash = $1, updated_at = NOW() WHERE id = $2', [password_hash, donor_id]);
    await pool.query('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1', [tokenId]);
    res.json({ message: 'Password has been reset successfully.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Reset failed' } });
  }
});

// Update profile
router.put('/:id/profile', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  if (req.user!.id !== id) {
    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You can only update your own profile' } });
    return;
  }
  const body = req.body as Record<string, string>;
  const { full_name, location_city, new_email, new_password, current_password, blood_group, gender, phone_number, date_of_birth } = body;

  if (new_email || new_password) {
    if (!current_password) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'current_password is required to change email or password' } });
      return;
    }
    try {
      const result = await pool.query('SELECT password_hash FROM donors WHERE id = $1', [id]);
      if (result.rows.length === 0) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Donor not found' } }); return; }
      const valid = await comparePassword(current_password, result.rows[0].password_hash);
      if (!valid) { res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Current password is incorrect' } }); return; }
    } catch (err) {
      console.error('Profile re-auth error:', err);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Update failed' } });
      return;
    }
  }

  try {
    const setClauses: string[] = ['updated_at = NOW()'];
    const values: unknown[] = [];
    let idx = 1;

    if (full_name) { setClauses.push('full_name = $' + idx++); values.push(full_name.trim()); }
    if (location_city) { setClauses.push('location_city = $' + idx++); values.push(location_city.trim()); }
    if (phone_number) { setClauses.push('phone_number = $' + idx++); values.push(phone_number.trim()); }
    if (date_of_birth) { setClauses.push('date_of_birth = $' + idx++); values.push(date_of_birth); }
    if (blood_group) {
      if (!VALID_BLOOD_GROUPS.includes(blood_group)) {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid blood group' } }); return;
      }
      setClauses.push('blood_group = $' + idx++); values.push(blood_group);
    }
    if (gender) {
      if (!VALID_GENDERS.includes(gender)) {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid gender' } }); return;
      }
      setClauses.push('gender = $' + idx++); values.push(gender);
    }
    if (new_email) {
      if (!EMAIL_REGEX.test(new_email)) {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'new_email must be a valid email address' } }); return;
      }
      setClauses.push('email = $' + idx++); values.push(new_email.toLowerCase());
    }
    if (new_password) {
      if (new_password.length < 8) {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'new_password must be at least 8 characters' } }); return;
      }
      const hash = await hashPassword(new_password);
      setClauses.push('password_hash = $' + idx++); values.push(hash);
    }

    values.push(id);
    await pool.query('UPDATE donors SET ' + setClauses.join(', ') + ' WHERE id = $' + idx, values);
    res.json({ message: 'Profile updated successfully.' });
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Update failed' } });
  }
});

// Get donor profile
router.get('/:id/profile', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  if (req.user!.id !== id) {
    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You can only view your own profile' } });
    return;
  }
  try {
    const result = await pool.query(
      `SELECT id, full_name, email, blood_group, gender, location_city, phone_number, date_of_birth,
              is_available, allow_hospital_contact,
              email_notifications_enabled, sms_notifications_enabled, reminder_notifications_enabled
       FROM donors WHERE id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Donor not found' } });
      return;
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch profile' } });
  }
});

// Availability toggle
router.put('/:id/availability', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  if (req.user!.id !== id) {
    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You can only update your own availability' } });
    return;
  }
  const { is_available } = req.body as { is_available?: unknown };
  if (typeof is_available !== 'boolean') {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'is_available must be a boolean' } });
    return;
  }
  try {
    const result = await pool.query('UPDATE donors SET is_available = $1 WHERE id = $2 RETURNING id, is_available', [is_available, id]);
    if (result.rows.length === 0) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Donor not found' } }); return; }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Availability toggle error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Update failed' } });
  }
});

// Accept / decline contact request
router.put('/:id/contact-requests/:requestId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { id, requestId } = req.params;
  if (req.user!.role !== 'donor' || req.user!.id !== id) {
    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
    return;
  }
  const { action } = req.body as { action?: string };
  if (!action || !['accept', 'decline'].includes(action)) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'action must be "accept" or "decline"' } });
    return;
  }
  try {
    const updateResult = await pool.query(
      'UPDATE contact_requests SET status = $1, responded_at = NOW() WHERE id = $2 AND donor_id = $3 RETURNING *',
      [action === 'accept' ? 'accepted' : 'declined', requestId, id]
    );
    if (updateResult.rows.length === 0) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Contact request not found' } }); return; }
    if (action === 'decline') { res.json({ message: 'Request declined' }); return; }
    const hospitalResult = await pool.query('SELECT id, name, email, contact_number, address FROM hospitals WHERE id = $1', [updateResult.rows[0].hospital_id]);
    if (hospitalResult.rows.length === 0) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Hospital not found' } }); return; }
    res.json({ hospital: hospitalResult.rows[0] });
  } catch (err) {
    console.error('Contact request response error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Response failed' } });
  }
});

// Notification preferences
router.put('/:id/notification-preferences', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  if (req.user!.id !== id) {
    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You can only update your own notification preferences' } });
    return;
  }
  const { email_notifications_enabled, sms_notifications_enabled, reminder_notifications_enabled } =
    req.body as { email_notifications_enabled?: unknown; sms_notifications_enabled?: unknown; reminder_notifications_enabled?: unknown };

  const setClauses: string[] = [];
  const values: unknown[] = [];
  let idx = 1;
  if (typeof email_notifications_enabled === 'boolean') { setClauses.push('email_notifications_enabled = $' + idx++); values.push(email_notifications_enabled); }
  if (typeof sms_notifications_enabled === 'boolean') { setClauses.push('sms_notifications_enabled = $' + idx++); values.push(sms_notifications_enabled); }
  if (typeof reminder_notifications_enabled === 'boolean') { setClauses.push('reminder_notifications_enabled = $' + idx++); values.push(reminder_notifications_enabled); }

  if (setClauses.length === 0) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'At least one preference field must be provided' } });
    return;
  }
  values.push(id);
  try {
    const result = await pool.query(
      'UPDATE donors SET ' + setClauses.join(', ') + ' WHERE id = $' + idx +
      ' RETURNING id, email_notifications_enabled, sms_notifications_enabled, reminder_notifications_enabled',
      values
    );
    if (result.rows.length === 0) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Donor not found' } }); return; }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Notification preferences update error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Update failed' } });
  }
});

export default router;
