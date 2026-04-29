import { useEffect, useState } from 'react';
import { getToken, getDonorId, authHeaders } from '../auth';
import { getCityFromGPS } from '../utils/location';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

interface DonationRecord {
  id: string; donation_date: string;
  blood_bank_name: string | null; volume_donated: number; location: string;
}
interface EarnedReward {
  reward_id: string; reward_name: string; description: string | null;
  blood_bank_name: string; earned_on: string;
}
interface EligibilityResponse { nextEligibleDate: string | null; totalDonations: number; }
interface ScreeningHistoryRecord {
  id: string; is_eligible: boolean; reason: string | null;
  weight: number | null; screened_at: string;
}
interface DonorProfile {
  id: string; full_name: string; email: string; blood_group: string;
  gender: string; location_city: string; is_available: boolean;
  allow_hospital_contact: boolean; date_of_birth: string;
  email_notifications_enabled: boolean; sms_notifications_enabled: boolean;
  reminder_notifications_enabled: boolean;
}

// ─── Badge definitions ────────────────────────────────────────────────────────
const DONATION_BADGES = [
  { id: 'first', emoji: '🩸', label: 'First Drop', desc: '1st donation', req: (n: number) => n >= 1 },
  { id: 'third', emoji: '🥉', label: 'Bronze Donor', desc: '3 donations', req: (n: number) => n >= 3 },
  { id: 'fifth', emoji: '⭐', label: 'Rising Star', desc: '5 donations', req: (n: number) => n >= 5 },
  { id: 'tenth', emoji: '🏅', label: 'Life Saver', desc: '10 donations', req: (n: number) => n >= 10 },
  { id: 'twenty', emoji: '🥇', label: 'Gold Donor', desc: '20 donations', req: (n: number) => n >= 20 },
  { id: 'fifty', emoji: '🏆', label: 'Legend', desc: '50 donations', req: (n: number) => n >= 50 },
];

function hasStreak(donations: DonationRecord[]): boolean {
  if (donations.length < 2) return false;
  const sorted = [...donations].sort((a, b) => new Date(b.donation_date).getTime() - new Date(a.donation_date).getTime());
  for (let i = 0; i < sorted.length - 1; i++) {
    const diff = (new Date(sorted[i].donation_date).getTime() - new Date(sorted[i + 1].donation_date).getTime()) / (1000 * 60 * 60 * 24 * 30);
    if (diff >= 3 && diff <= 5) return true;
  }
  return false;
}

// ─── Food chart data ──────────────────────────────────────────────────────────
const BEFORE_DONATION = [
  { emoji: '🥤', item: 'Water / Juice', tip: 'Drink 500ml extra water 2 hours before' },
  { emoji: '🍌', item: 'Banana', tip: 'Rich in potassium, easy to digest' },
  { emoji: '🍞', item: 'Whole grain bread', tip: 'Provides sustained energy' },
  { emoji: '🥚', item: 'Eggs', tip: 'Good protein source, light on stomach' },
  { emoji: '🥣', item: 'Oatmeal', tip: 'Iron-rich, keeps you full' },
  { emoji: '🍊', item: 'Orange / Citrus', tip: 'Vitamin C boosts iron absorption' },
];

const AFTER_DONATION = [
  { emoji: '🧃', item: 'Fruit juice', tip: 'Replenishes sugar and fluids quickly' },
  { emoji: '🍪', item: 'Biscuits / Snacks', tip: 'Provided at donation centre — eat them!' },
  { emoji: '🥩', item: 'Iron-rich meat', tip: 'Chicken, fish help restore iron levels' },
  { emoji: '🥬', item: 'Spinach / Leafy greens', tip: 'High iron content for recovery' },
  { emoji: '🫘', item: 'Lentils / Beans', tip: 'Plant-based iron and protein' },
  { emoji: '🍫', item: 'Dark chocolate', tip: 'Iron + mood boost — you deserve it!' },
];

const HEMOGLOBIN_FOODS = [
  { emoji: '🥩', item: 'Red meat & liver', tip: 'Highest source of heme iron' },
  { emoji: '🐟', item: 'Tuna / Salmon', tip: 'Omega-3 + iron combo' },
  { emoji: '🥬', item: 'Spinach', tip: '3.6mg iron per 100g' },
  { emoji: '🫘', item: 'Kidney beans', tip: 'Great plant-based iron source' },
  { emoji: '🌰', item: 'Pumpkin seeds', tip: '8mg iron per 100g' },
  { emoji: '🍫', item: 'Dark chocolate', tip: '11mg iron per 100g' },
  { emoji: '🍊', item: 'Vitamin C foods', tip: 'Doubles iron absorption from plants' },
  { emoji: '🥜', item: 'Peanuts / Nuts', tip: 'Iron + healthy fats' },
  { emoji: '🌿', item: 'Fenugreek leaves', tip: 'Traditional iron booster' },
  { emoji: '🍖', item: 'Chicken', tip: 'Lean protein + heme iron' },
];

// ─── Food card component ──────────────────────────────────────────────────────
function FoodCard({ emoji, item, tip }: { emoji: string; item: string; tip: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: '0.6rem',
      padding: '0.6rem 0.75rem', borderRadius: 8,
      background: '#fafafa', border: '1px solid #f0f0f0',
    }}>
      <span style={{ fontSize: '1.4rem', flexShrink: 0 }}>{emoji}</span>
      <div>
        <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{item}</div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>{tip}</div>
      </div>
    </div>
  );
}

export default function Profile() {
  const [profile, setProfile] = useState<DonorProfile | null>(null);
  const [donations, setDonations] = useState<DonationRecord[]>([]);
  const [eligibility, setEligibility] = useState<EligibilityResponse | null>(null);
  const [rewards, setRewards] = useState<EarnedReward[]>([]);
  const [screeningHistory, setScreeningHistory] = useState<ScreeningHistoryRecord[]>([]);
  const [availMsg, setAvailMsg] = useState<string | null>(null);
  const [notifMsg, setNotifMsg] = useState<string | null>(null);
  const [reminderMsg, setReminderMsg] = useState<string | null>(null);
  const [reminderSending, setReminderSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [cityUpdating, setCityUpdating] = useState(false);
  const [cityMsg, setCityMsg] = useState<string | null>(null);
  const [editingBloodGroup, setEditingBloodGroup] = useState(false);
  const [newBloodGroup, setNewBloodGroup] = useState('');
  const [bloodGroupMsg, setBloodGroupMsg] = useState<string | null>(null);
  const [healthTab, setHealthTab] = useState<'before' | 'after' | 'hemo'>('before');

  async function saveBloodGroup() {
    const donorId = getDonorId();
    if (!donorId || !newBloodGroup) return;
    setBloodGroupMsg(null);
    try {
      const res = await fetch(`/api/donors/${donorId}/profile`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ blood_group: newBloodGroup }),
      });
      if (!res.ok) throw new Error();
      setProfile(p => p ? { ...p, blood_group: newBloodGroup } : p);
      setBloodGroupMsg('Blood group updated!');
      setEditingBloodGroup(false);
    } catch { setBloodGroupMsg('Failed to update blood group.'); }
  }

  async function updateCityFromGPS() {
    const donorId = getDonorId();
    if (!donorId) return;
    setCityUpdating(true); setCityMsg(null);
    try {
      const { city } = await getCityFromGPS();
      const res = await fetch(`/api/donors/${donorId}/profile`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ location_city: city }),
      });
      if (!res.ok) throw new Error();
      setProfile(p => p ? { ...p, location_city: city } : p);
      setCityMsg(`City updated to "${city}"`);
    } catch { setCityMsg('Could not detect location. Please allow location access.'); }
    finally { setCityUpdating(false); }
  }

  useEffect(() => {
    const token = getToken(); const donorId = getDonorId();
    if (!token || !donorId) { setError('You must be logged in to view your profile.'); setLoading(false); return; }
    const h = authHeaders();
    Promise.all([
      fetch(`/api/donors/${donorId}/profile`, { headers: h }),
      fetch(`/api/donors/${donorId}/donations`, { headers: h }),
      fetch(`/api/donors/${donorId}/donations/next-eligible-date`, { headers: h }),
      fetch(`/api/donors/${donorId}/donations/earned-rewards`, { headers: h }),
      fetch(`/api/donors/${donorId}/screening-history`, { headers: h }),
    ]).then(async ([pRes, dRes, eRes, rRes, sRes]) => {
      if (pRes.ok) setProfile(await pRes.json() as DonorProfile);
      if (dRes.ok) setDonations(await dRes.json() as DonationRecord[]);
      if (eRes.ok) setEligibility(await eRes.json() as EligibilityResponse);
      if (rRes.ok) setRewards(await rRes.json() as EarnedReward[]);
      if (sRes.ok) setScreeningHistory(await sRes.json() as ScreeningHistoryRecord[]);
    }).catch(() => setError('Failed to load profile data.')).finally(() => setLoading(false));
  }, []);

  async function toggleAvailability() {
    const donorId = getDonorId();
    if (!profile || !donorId) return;
    setAvailMsg(null);
    const newVal = !profile.is_available;
    try {
      const res = await fetch(`/api/donors/${donorId}/availability`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ is_available: newVal }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json() as { id: string; is_available: boolean };
      setProfile(p => p ? { ...p, is_available: data.is_available } : p);
      setAvailMsg(data.is_available ? 'You are now marked as available.' : 'Marked as unavailable.');
    } catch { setAvailMsg('Failed to update availability.'); }
  }

  async function sendReminder() {
    const donorId = getDonorId();
    if (!donorId) return;
    setReminderSending(true); setReminderMsg(null);
    try {
      const res = await fetch(`/api/donors/${donorId}/send-reminder`, {
        method: 'POST', headers: authHeaders(),
      });
      const data = await res.json() as { message?: string; error?: { message?: string } };
      setReminderMsg(res.ok ? (data.message ?? 'Reminder sent!') : (data.error?.message ?? 'Failed to send.'));
    } catch { setReminderMsg('Network error. Could not send reminder.'); }
    finally { setReminderSending(false); }
  }

  async function toggleNotif(
    field: 'email_notifications_enabled' | 'sms_notifications_enabled' | 'reminder_notifications_enabled',
    value: boolean
  ) {
    const donorId = getDonorId();
    if (!profile || !donorId) return;
    setNotifMsg(null);
    setProfile(p => p ? { ...p, [field]: value } : p);
    try {
      const res = await fetch(`/api/donors/${donorId}/notification-preferences`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok) throw new Error();
      setNotifMsg('Preferences saved.');
    } catch {
      setProfile(p => p ? { ...p, [field]: !value } : p);
      setNotifMsg('Failed to update preferences.');
    }
  }

  if (loading) return <div className="container" style={{ padding: '3rem 1rem', textAlign: 'center' }}><span className="spinner" /></div>;
  if (error) return (
    <div className="container" style={{ padding: '3rem 1rem', textAlign: 'center' }}>
      <div className="alert alert-error">{error}</div>
      <a href="/login" className="btn btn-primary" style={{ marginTop: '1rem' }}>Login</a>
    </div>
  );

  const totalDonations = eligibility?.totalDonations ?? donations.length;
  const nextDate = eligibility?.nextEligibleDate ?? null;
  const eligible = !nextDate || new Date(nextDate) <= new Date();
  const streakEarned = hasStreak(donations);

  return (
    <div className="container" style={{ padding: '2rem 1rem' }}>
      <h1 style={{ marginBottom: '1.5rem' }}>My Profile</h1>

      {profile && (
        <div className="profile-grid">
          {/* Personal Info */}
          <div className="card">
            <h2 className="section-heading">Personal Info</h2>
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              <div><span style={{ color: 'var(--text-muted)' }}>Name</span><br /><strong>{profile.full_name}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Email</span><br /><strong>{profile.email}</strong></div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Blood Group</span><br />
                {editingBloodGroup ? (
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                    <select value={newBloodGroup} onChange={e => setNewBloodGroup(e.target.value)}
                      style={{ padding: '0.3rem 0.5rem', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.875rem' }}>
                      <option value="">Select...</option>
                      {BLOOD_GROUPS.map(bg => <option key={bg} value={bg}>{bg}</option>)}
                    </select>
                    <button className="btn btn-primary" style={{ padding: '0.3rem 0.75rem', fontSize: '0.8rem' }}
                      onClick={() => { void saveBloodGroup(); }} disabled={!newBloodGroup}>Save</button>
                    <button className="btn btn-outline" style={{ padding: '0.3rem 0.75rem', fontSize: '0.8rem' }}
                      onClick={() => { setEditingBloodGroup(false); setBloodGroupMsg(null); }}>Cancel</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                    <span className="badge badge-blood">{profile.blood_group}</span>
                    <button onClick={() => { setNewBloodGroup(profile.blood_group); setEditingBloodGroup(true); setBloodGroupMsg(null); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--primary)', padding: 0 }}>✏️ Edit</button>
                  </div>
                )}
                {bloodGroupMsg && <div className={`alert ${bloodGroupMsg.startsWith('Failed') ? 'alert-error' : 'alert-success'}`} style={{ marginTop: '0.4rem', fontSize: '0.82rem', padding: '0.4rem 0.75rem' }}>{bloodGroupMsg}</div>}
              </div>
              <div><span style={{ color: 'var(--text-muted)' }}>Gender</span><br /><strong>{profile.gender}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>City</span><br /><strong>{profile.location_city}</strong></div>
              <div style={{ marginTop: '0.5rem' }}>
                <button className="btn btn-outline" style={{ fontSize: '0.8rem', padding: '0.3rem 0.75rem' }}
                  onClick={() => { void updateCityFromGPS(); }} disabled={cityUpdating}>
                  {cityUpdating ? 'Detecting...' : '📍 Update City from GPS'}
                </button>
                {cityMsg && <div className={`alert ${cityMsg.startsWith('Could') ? 'alert-error' : 'alert-success'}`} style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>{cityMsg}</div>}
              </div>
            </div>
          </div>

          {/* Donation Stats */}
          <div className="card">
            <h2 className="section-heading">Donation Stats</h2>
            <div className="stats-row" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="stat-card">
                <div className="stat-number">{totalDonations}</div>
                <div className="stat-label">Total Donations</div>
              </div>
              <div className="stat-card">
                <div className="stat-number" style={{ fontSize: '1.1rem', color: eligible ? 'var(--success)' : 'var(--primary)' }}>
                  {eligible ? 'Now' : nextDate}
                </div>
                <div className="stat-label">Next Eligible</div>
              </div>
            </div>
            <div style={{ marginTop: '1.25rem' }}>
              <h3 className="section-heading">Availability</h3>
              <label className="toggle-row">
                <span>Available to Donate</span>
                <span className="toggle-switch">
                  <input type="checkbox" checked={profile.is_available} onChange={() => { void toggleAvailability(); }} />
                  <span className="toggle-slider" />
                </span>
              </label>
              {availMsg && <div className={`alert ${availMsg.startsWith('Failed') ? 'alert-error' : 'alert-success'}`} style={{ marginTop: '0.5rem' }}>{availMsg}</div>}
            </div>

            {/* Send reminder button */}
            <div style={{ marginTop: '1.25rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
              <button
                className="btn btn-outline"
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                onClick={() => { void sendReminder(); }}
                disabled={reminderSending}
              >
                {reminderSending ? '⏳ Sending...' : '📧 Send Reminder to My Email'}
              </button>
              {reminderMsg && (
                <div className={`alert ${reminderMsg.startsWith('Network') || reminderMsg.startsWith('Failed') ? 'alert-error' : 'alert-success'}`}
                  style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
                  {reminderMsg}
                </div>
              )}
            </div>
          </div>

          {/* Notification Preferences */}
          <div className="card">
            <h2 className="section-heading">Notification Preferences</h2>
            {(['email_notifications_enabled', 'sms_notifications_enabled', 'reminder_notifications_enabled'] as const).map(field => (
              <label key={field} className="toggle-row">
                <span>{field === 'email_notifications_enabled' ? 'Email Notifications' : field === 'sms_notifications_enabled' ? 'SMS Notifications' : 'Reminder Notifications'}</span>
                <span className="toggle-switch">
                  <input type="checkbox" checked={profile[field]} onChange={e => { void toggleNotif(field, e.target.checked); }} />
                  <span className="toggle-slider" />
                </span>
              </label>
            ))}
            {notifMsg && <div className={`alert ${notifMsg.startsWith('Failed') ? 'alert-error' : 'alert-success'}`} style={{ marginTop: '0.5rem' }}>{notifMsg}</div>}
          </div>
        </div>
      )}

      {/* ─── Donation Badges ─────────────────────────────────────────────── */}
      <div className="card" style={{ marginTop: '1.5rem' }}>
        <h2 className="section-heading">🏅 Donation Badges</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
          You have donated <strong>{totalDonations}</strong> time{totalDonations !== 1 ? 's' : ''}.
          {totalDonations === 0 && ' Make your first donation to start earning badges!'}
        </p>

        {/* Earned badges */}
        {(() => {
          const allBadges = [
            ...DONATION_BADGES,
            { id: 'streak', emoji: '🔥', label: 'Streak Donor', desc: 'Donated within the eligible interval', req: () => streakEarned },
          ];
          const earned = allBadges.filter(b => b.req(totalDonations));
          const locked = allBadges.filter(b => !b.req(totalDonations));
          return (
            <>
              {earned.length > 0 && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                    ✨ Earned ({earned.length})
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.75rem' }}>
                    {earned.map(badge => (
                      <div key={badge.id} style={{
                        textAlign: 'center', padding: '1.1rem 0.75rem', borderRadius: 14,
                        border: '2px solid #fbbf24',
                        background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
                        boxShadow: '0 2px 8px rgba(251,191,36,0.25)',
                        position: 'relative',
                      }}>
                        <div style={{ position: 'absolute', top: 6, right: 8, fontSize: '0.65rem', color: '#d97706', fontWeight: 700 }}>✓ EARNED</div>
                        <div style={{ fontSize: '2.2rem', marginBottom: '0.4rem' }}>{badge.emoji}</div>
                        <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#92400e' }}>{badge.label}</div>
                        <div style={{ fontSize: '0.72rem', color: '#b45309', marginTop: '0.2rem' }}>{badge.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {locked.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                    🔒 Locked ({locked.length})
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.75rem' }}>
                    {locked.map(badge => (
                      <div key={badge.id} style={{
                        textAlign: 'center', padding: '1.1rem 0.75rem', borderRadius: 14,
                        border: '2px solid #e5e7eb',
                        background: '#f9fafb',
                        filter: 'grayscale(1)',
                        opacity: 0.6,
                        position: 'relative',
                      }}>
                        <div style={{ position: 'absolute', top: 6, right: 8, fontSize: '0.7rem' }}>🔒</div>
                        <div style={{ fontSize: '2.2rem', marginBottom: '0.4rem' }}>{badge.emoji}</div>
                        <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#6b7280' }}>{badge.label}</div>
                        <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '0.2rem' }}>{badge.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          );
        })()}
      </div>

      {/* ─── Health & Nutrition Guide ─────────────────────────────────────── */}
      <div className="card" style={{ marginTop: '1.5rem' }}>
        <h2 className="section-heading">🥗 Healthy Eating Guide for Donors</h2>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          {(['before', 'after', 'hemo'] as const).map(tab => (
            <button key={tab} onClick={() => setHealthTab(tab)}
              style={{
                padding: '0.4rem 1rem', borderRadius: 20, border: '2px solid',
                borderColor: healthTab === tab ? 'var(--primary)' : '#e5e7eb',
                background: healthTab === tab ? 'var(--primary)' : '#fff',
                color: healthTab === tab ? '#fff' : 'var(--text)',
                fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem',
              }}>
              {tab === 'before' ? '🍽️ Before Donation' : tab === 'after' ? '🧃 After Donation' : '💪 Boost Hemoglobin'}
            </button>
          ))}
        </div>

        {healthTab === 'before' && (
          <>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
              Eat a light, iron-rich meal 2–3 hours before donating. Avoid fatty foods and alcohol.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.6rem' }}>
              {BEFORE_DONATION.map(f => <FoodCard key={f.item} {...f} />)}
            </div>
          </>
        )}
        {healthTab === 'after' && (
          <>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
              Eat and drink well after donating. Avoid strenuous activity for 24 hours.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.6rem' }}>
              {AFTER_DONATION.map(f => <FoodCard key={f.item} {...f} />)}
            </div>
          </>
        )}
        {healthTab === 'hemo' && (
          <>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
              Hemoglobin must be ≥12.5 g/dL (female) or ≥13.5 g/dL (male) to donate. Eat these regularly between donations.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.6rem' }}>
              {HEMOGLOBIN_FOODS.map(f => <FoodCard key={f.item} {...f} />)}
            </div>
          </>
        )}
      </div>

      {/* ─── Screening History ────────────────────────────────────────────── */}
      {screeningHistory.length > 0 && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <h2 className="section-heading">🔬 Screening History</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
            Your last {screeningHistory.length} eligibility check{screeningHistory.length > 1 ? 's' : ''}. An email is sent to you whenever you are eligible.
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr><th>Date & Time</th><th>Result</th><th>Weight (kg)</th><th>Reason</th></tr>
              </thead>
              <tbody>
                {screeningHistory.map(s => (
                  <tr key={s.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{new Date(s.screened_at).toLocaleString('en-IN')}</td>
                    <td>
                      <span style={{
                        padding: '0.2rem 0.6rem', borderRadius: 20, fontSize: '0.8rem', fontWeight: 700,
                        background: s.is_eligible ? '#dcfce7' : '#fee2e2',
                        color: s.is_eligible ? '#166534' : '#991b1b',
                      }}>
                        {s.is_eligible ? '✅ Eligible' : '❌ Not Eligible'}
                      </span>
                    </td>
                    <td>{s.weight ?? '—'}</td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)', maxWidth: 280 }}>
                      {s.is_eligible ? 'All checks passed' : s.reason ? s.reason.slice(0, 80) + (s.reason.length > 80 ? '…' : '') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Donation History ─────────────────────────────────────────────── */}
      <div className="card" style={{ marginTop: '1.5rem' }}>
        <h2 className="section-heading">Donation History</h2>
        {donations.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No donations recorded yet.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead><tr><th>#</th><th>Date</th><th>Blood Bank</th><th>Volume (ml)</th><th>Location</th></tr></thead>
              <tbody>
                {donations.map((d, i) => (
                  <tr key={d.id}>
                    <td style={{ fontWeight: 700, color: 'var(--primary)' }}>#{donations.length - i}</td>
                    <td>{new Date(d.donation_date).toLocaleDateString()}</td>
                    <td>{d.blood_bank_name ?? '—'}</td>
                    <td>{d.volume_donated}</td>
                    <td>{d.location}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Earned Rewards ───────────────────────────────────────────────── */}
      {rewards.length > 0 && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <h2 className="section-heading">Earned Rewards</h2>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead><tr><th>Reward</th><th>Description</th><th>Blood Bank</th><th>Earned On</th></tr></thead>
              <tbody>
                {rewards.map(r => (
                  <tr key={`${r.reward_id}-${r.earned_on}`}>
                    <td>{r.reward_name}</td>
                    <td>{r.description ?? '—'}</td>
                    <td>{r.blood_bank_name}</td>
                    <td>{new Date(r.earned_on).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
