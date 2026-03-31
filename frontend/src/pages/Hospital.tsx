import { useState } from 'react';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

interface HospitalInfo { id: string; email: string; name: string; }
interface DonorResult { id: string; full_name: string; blood_group: string; location_city: string; distance_km: number; }

export default function Hospital() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('hospital_token'));
  const [hospital, setHospital] = useState<HospitalInfo | null>(() => {
    const s = localStorage.getItem('hospital_info');
    return s ? JSON.parse(s) as HospitalInfo : null;
  });
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [radius, setRadius] = useState('10');
  const [donors, setDonors] = useState<DonorResult[]>([]);
  const [searchError, setSearchError] = useState('');
  const [searching, setSearching] = useState(false);
  const [requestStatus, setRequestStatus] = useState<Record<string, string>>({});

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch('/api/hospitals/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await res.json();
      if (!res.ok) { setLoginError(data.error?.message || 'Login failed'); return; }
      localStorage.setItem('hospital_token', data.token);
      localStorage.setItem('hospital_info', JSON.stringify(data.hospital));
      setToken(data.token);
      setHospital(data.hospital);
    } catch { setLoginError('Network error. Please try again.'); }
  }

  function handleLogout() {
    localStorage.removeItem('hospital_token');
    localStorage.removeItem('hospital_info');
    setToken(null); setHospital(null); setDonors([]);
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearchError(''); setDonors([]); setSearching(true);
    try {
      let lat = 0, lng = 0;
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) => navigator.geolocation.getCurrentPosition(res, rej));
        lat = pos.coords.latitude; lng = pos.coords.longitude;
      } catch { /* use 0,0 */ }
      const params = new URLSearchParams({ bloodGroup, lat: String(lat), lng: String(lng), radius });
      const res = await fetch(`/api/hospitals/donors/search?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) { setSearchError(data.error?.message || 'Search failed'); return; }
      setDonors(data);
    } catch { setSearchError('Network error. Please try again.'); }
    finally { setSearching(false); }
  }

  async function sendContactRequest(donorId: string) {
    if (!hospital) return;
    setRequestStatus(p => ({ ...p, [donorId]: 'sending' }));
    try {
      const res = await fetch('/api/hospitals/contact-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ donor_id: donorId, hospital_id: hospital.id }),
      });
      const data = await res.json();
      if (!res.ok) { setRequestStatus(p => ({ ...p, [donorId]: `Error: ${data.error?.message || 'Failed'}` })); return; }
      setRequestStatus(p => ({ ...p, [donorId]: 'sent' }));
    } catch { setRequestStatus(p => ({ ...p, [donorId]: 'Network error' })); }
  }

  if (!token || !hospital) {
    return (
      <div className="container" style={{ maxWidth: 440, padding: '3rem 1rem' }}>
        <div className="card">
          <h1 style={{ marginBottom: '0.25rem' }}>Hospital Portal</h1>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Sign in to search for available donors</p>
          <form onSubmit={handleLogin} noValidate>
            <div className="form-group">
              <label htmlFor="h-email">Email</label>
              <input id="h-email" type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required placeholder="hospital@example.com" />
            </div>
            <div className="form-group">
              <label htmlFor="h-pass">Password</label>
              <input id="h-pass" type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required placeholder="••••••••" />
            </div>
            {loginError && <div className="alert alert-error">{loginError}</div>}
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Sign In</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: '2rem 1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <h1>{hospital.name}</h1>
        <button className="btn btn-outline" onClick={handleLogout}>Logout</button>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 className="section-heading">Search Donors</h2>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Blood Group</label>
            <select value={bloodGroup} onChange={e => setBloodGroup(e.target.value)} required>
              <option value="">Select...</option>
              {BLOOD_GROUPS.map(bg => <option key={bg} value={bg}>{bg}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Radius (km)</label>
            <input type="number" min={1} max={100} value={radius} onChange={e => setRadius(e.target.value)} style={{ width: 90 }} />
          </div>
          <button type="submit" className="btn btn-primary" disabled={searching}>
            {searching ? <span className="spinner" /> : 'Search'}
          </button>
        </form>
      </div>

      {searchError && <div className="alert alert-error">{searchError}</div>}

      {donors.length === 0 && !searching && !searchError && (
        <p style={{ color: 'var(--text-muted)' }}>No results yet. Run a search above.</p>
      )}

      {donors.length > 0 && (
        <div className="card">
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Name</th><th>Blood Group</th><th>City</th><th>Distance (km)</th><th>Action</th>
                </tr>
              </thead>
              <tbody>
                {donors.map(donor => (
                  <tr key={donor.id}>
                    <td>{donor.full_name}</td>
                    <td><span className="badge badge-blood">{donor.blood_group}</span></td>
                    <td>{donor.location_city}</td>
                    <td>{donor.distance_km}</td>
                    <td>
                      {requestStatus[donor.id] === 'sent' ? (
                        <span style={{ color: 'var(--success)' }}>✓ Sent</span>
                      ) : requestStatus[donor.id] === 'sending' ? (
                        <span className="spinner" />
                      ) : requestStatus[donor.id] ? (
                        <span style={{ color: 'var(--primary)', fontSize: '0.8rem' }}>{requestStatus[donor.id]}</span>
                      ) : (
                        <button className="btn btn-primary" style={{ padding: '0.3rem 0.75rem', fontSize: '0.8rem' }} onClick={() => sendContactRequest(donor.id)}>
                          Contact
                        </button>
                      )}
                    </td>
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
