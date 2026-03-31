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
interface DonorProfile {
  id: string; full_name: string; email: string; blood_group: string;
  gender: string; location_city: string; is_available: boolean;
  allow_hospital_contact: boolean; date_of_birth: string;
  email_notifications_enabled: boolean; sms_notifications_enabled: boolean;
  reminder_notifications_enabled: boolean;
}

export default function Profile() {
  const [profile, setProfile] = useState<DonorProfile | null>(null);
  const [donations, setDonations] = useState<DonationRecord[]>([]);
  const [eligibility, setEligibility] = useState<EligibilityResponse | null>(null);
  const [rewards, setRewards] = useState<EarnedReward[]>([]);
  const [availMsg, setAvailMsg] = useState<string | null>(null);
  const [notifMsg, setNotifMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [cityUpdating, setCityUpdating] = useState(false);
  const [cityMsg, setCityMsg] = useState<string | null>(null);
  const [editingBloodGroup, setEditingBloodGroup] = useState(false);
  const [newBloodGroup, setNewBloodGroup] = useState('');
  const [bloodGroupMsg, setBloodGroupMsg] = useState<string | null>(null);

  async function saveBloodGroup() {
    const donorId = getDonorId();
    if (!donorId || !newBloodGroup) return;
    setBloodGroupMsg(null);
    try {
      const res = await fetch(`/api/donors/${donorId}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ blood_group: newBloodGroup }),
      });
      if (!res.ok) throw new Error();
      setProfile(p => p ? { ...p, blood_group: newBloodGroup } : p);
      setBloodGroupMsg('Blood group updated!');
      setEditingBloodGroup(false);
    } catch {
      setBloodGroupMsg('Failed to update blood group.');
    }
  }

  async function updateCityFromGPS() {
    const donorId = getDonorId();
    if (!donorId) return;
    setCityUpdating(true); setCityMsg(null);
    try {
      const { city } = await getCityFromGPS();
      const res = await fetch(`/api/donors/${donorId}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ location_city: city }),
      });
      if (!res.ok) throw new Error();
      setProfile(p => p ? { ...p, location_city: city } : p);
      setCityMsg(`City updated to "${city}"`);
    } catch {
      setCityMsg('Could not detect location. Please allow location access.');
    } finally {
      setCityUpdating(false);
    }
  }

  useEffect(() => {
    const token = getToken();
    const donorId = getDonorId();
    if (!token || !donorId) {
      setError('You must be logged in to view your profile.');
      setLoading(false);
      return;
    }
    const h = authHeaders();
    Promise.all([
      fetch(`/api/donors/${donorId}/profile`, { headers: h }),
      fetch(`/api/donors/${donorId}/donations`, { headers: h }),
      fetch(`/api/donors/${donorId}/donations/next-eligible-date`, { headers: h }),
      fetch(`/api/donors/${donorId}/donations/earned-rewards`, { headers: h }),
    ]).then(async ([pRes, dRes, eRes, rRes]) => {
      if (pRes.ok) setProfile(await pRes.json() as DonorProfile);
      if (dRes.ok) setDonations(await dRes.json() as DonationRecord[]);
      if (eRes.ok) setEligibility(await eRes.json() as EligibilityResponse);
      if (rRes.ok) setRewards(await rRes.json() as EarnedReward[]);
    }).catch(() => setError('Failed to load profile data.'))
      .finally(() => setLoading(false));
  }, []);

  async function toggleAvailability() {
    const donorId = getDonorId();
    if (!profile || !donorId) return;
    setAvailMsg(null);
    const newVal = !profile.is_available;
    try {
      const res = await fetch(`/api/donors/${donorId}/availability`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ is_available: newVal }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json() as { id: string; is_available: boolean };
      setProfile(p => p ? { ...p, is_available: data.is_available } : p);
      setAvailMsg(data.is_available ? 'You are now marked as available.' : 'Marked as unavailable.');
    } catch {
      setAvailMsg('Failed to update availability.');
    }
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
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
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

  return (
    <div className="container" style={{ padding: '2rem 1rem' }}>
      <h1 style={{ marginBottom: '1.5rem' }}>My Profile</h1>

      {profile && (
        <div className="profile-grid">
          <div className="card">
            <h2 className="section-heading">Personal Info</h2>
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              <div><span style={{ color: 'var(--text-muted)' }}>Name</span><br /><strong>{profile.full_name}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Email</span><br /><strong>{profile.email}</strong></div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Blood Group</span><br />
                {editingBloodGroup ? (
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                    <select
                      value={newBloodGroup}
                      onChange={e => setNewBloodGroup(e.target.value)}
                      style={{ padding: '0.3rem 0.5rem', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.875rem' }}
                    >
                      <option value="">Select...</option>
                      {BLOOD_GROUPS.map(bg => <option key={bg} value={bg}>{bg}</option>)}
                    </select>
                    <button className="btn btn-primary" style={{ padding: '0.3rem 0.75rem', fontSize: '0.8rem' }}
                      onClick={() => { void saveBloodGroup(); }} disabled={!newBloodGroup}>
                      Save
                    </button>
                    <button className="btn btn-outline" style={{ padding: '0.3rem 0.75rem', fontSize: '0.8rem' }}
                      onClick={() => { setEditingBloodGroup(false); setBloodGroupMsg(null); }}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                    <span className="badge badge-blood">{profile.blood_group}</span>
                    <button onClick={() => { setNewBloodGroup(profile.blood_group); setEditingBloodGroup(true); setBloodGroupMsg(null); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--primary)', padding: 0 }}>
                      ✏️ Edit
                    </button>
                  </div>
                )}
                {bloodGroupMsg && (
                  <div className={`alert ${bloodGroupMsg.startsWith('Failed') ? 'alert-error' : 'alert-success'}`}
                    style={{ marginTop: '0.4rem', fontSize: '0.82rem', padding: '0.4rem 0.75rem' }}>
                    {bloodGroupMsg}
                  </div>
                )}
              </div>
              <div><span style={{ color: 'var(--text-muted)' }}>Gender</span><br /><strong>{profile.gender}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>City</span><br /><strong>{profile.location_city}</strong></div>
              <div style={{ marginTop: '0.5rem' }}>
                <button
                  className="btn btn-outline"
                  style={{ fontSize: '0.8rem', padding: '0.3rem 0.75rem' }}
                  onClick={() => { void updateCityFromGPS(); }}
                  disabled={cityUpdating}
                >
                  {cityUpdating ? 'Detecting...' : '📍 Update City from GPS'}
                </button>
                {cityMsg && (
                  <div className={`alert ${cityMsg.startsWith('Could') ? 'alert-error' : 'alert-success'}`} style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
                    {cityMsg}
                  </div>
                )}
              </div>
            </div>
          </div>

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
              {availMsg && (
                <div className={`alert ${availMsg.startsWith('Failed') ? 'alert-error' : 'alert-success'}`} style={{ marginTop: '0.5rem' }}>
                  {availMsg}
                </div>
              )}
            </div>
          </div>

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
            {notifMsg && (
              <div className={`alert ${notifMsg.startsWith('Failed') ? 'alert-error' : 'alert-success'}`} style={{ marginTop: '0.5rem' }}>
                {notifMsg}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="card" style={{ marginTop: '1.5rem' }}>
        <h2 className="section-heading">Donation History</h2>
        {donations.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No donations recorded yet.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Date</th><th>Blood Bank</th><th>Volume (ml)</th><th>Location</th>
                </tr>
              </thead>
              <tbody>
                {donations.map(d => (
                  <tr key={d.id}>
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

      {rewards.length > 0 && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <h2 className="section-heading">Earned Rewards</h2>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Reward</th><th>Description</th><th>Blood Bank</th><th>Earned On</th>
                </tr>
              </thead>
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
