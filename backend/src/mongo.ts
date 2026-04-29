import mongoose from 'mongoose';

// ─── Schemas ──────────────────────────────────────────────────────────────────

const userActivitySchema = new mongoose.Schema({
  event: { type: String, required: true }, // 'register' | 'login' | 'google_login'
  donor_id: String,
  full_name: String,
  email: { type: String, required: true },
  blood_group: String,
  gender: String,
  location_city: String,
  ip_address: String,
  timestamp: { type: Date, default: Date.now },
});

export const UserActivity = mongoose.model('UserActivity', userActivitySchema);

// ─── Connect ──────────────────────────────────────────────────────────────────

export async function connectMongo(): Promise<void> {
  const url = process.env.MONGODB_URL;
  if (!url) {
    console.log('[MongoDB] MONGODB_URL not set, skipping connection.');
    return;
  }
  try {
    await mongoose.connect(url);
    console.log('[MongoDB] Connected to', url);
  } catch (err) {
    console.error('[MongoDB] Connection failed:', err);
    // Non-fatal — app continues without MongoDB
  }
}

// ─── Log helpers ─────────────────────────────────────────────────────────────

export async function logUserActivity(data: {
  event: string;
  donor_id?: string;
  full_name?: string;
  email: string;
  blood_group?: string;
  gender?: string;
  location_city?: string;
  ip_address?: string;
}): Promise<void> {
  try {
    if (mongoose.connection.readyState !== 1) return;
    await UserActivity.create(data);
  } catch (err) {
    console.error('[MongoDB] Log error:', err);
  }
}
