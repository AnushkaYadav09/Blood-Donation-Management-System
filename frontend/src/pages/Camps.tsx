import { useEffect, useState } from 'react';
import { getToken } from '../auth';
import { getCityFromGPS } from '../utils/location';

interface Camp {
  id: string; name: string; organizer: string;
  camp_date: string; camp_time: string | null;
  venue: string; address: string; goodies: string | null; distance_km?: number;
}

export default function Camps() {
  const [camps, setCamps] = useState<Camp[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [locating, setLocating] = useState(false);

  async function handleUseMyLocation() {
    setLocating(true); setError(null);
    try {
      const { lat, lng } = await getCityFromGPS();
      fetchNearby(lat, lng);
    } catch {
      setError('Could not get your location. Please allow location access.');
    } finally {
      setLocating(false);
    }
  }

  useEffect(() => {
    if (!navigator.geolocation) { fetchAll(); return; }
    navigator.geolocation.getCurrentPosition(
      pos => fetchNearby(pos.coords.latitude, pos.coords.longitude),
      () => fetchAll()
    );
  }, []);

  function fetchNearby(lat: number, lng: number) {
    setLoading(true); setError(null);
    fetch(`/api/donation-camps/nearby?lat=${lat}&lng=${lng}&radius=50`)
      .then(async r => {
        const data = await r.json();
        if (!r.ok || !Array.isArray(data)) throw new Error('Invalid response');
        setCamps(data as Camp[]);
      })
      .catch(() => setError('Failed to load nearby donation camps.'))
      .finally(() => setLoading(false));
  }

  function fetchAll() {
    setLoading(true); setError(null);
    fetch('/api/donation-camps')
      .then(async r => {
        const data = await r.json();
        if (!r.ok || !Array.isArray(data)) throw new Error('Invalid response');
        setCamps(data as Camp[]);
      })
      .catch(() => setError('Failed to load donation camps.'))
      .finally(() => setLoading(false));
  }

  const filtered = filter.trim()
    ? camps.filter(c =>
        c.name.toLowerCase().includes(filter.toLowerCase()) ||
        c.address.toLowerCase().includes(filter.toLowerCase()) ||
        c.venue.toLowerCase().includes(filter.toLowerCase())
      )
    : camps;

  function handleRegister(campId: string) {
    const token = getToken();
    if (!token) { setMessages(p => ({ ...p, [campId]: 'Please log in to register.' })); return; }
    fetch(`/api/donation-camps/${campId}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({}),
    }).then(async r => {
      if (r.ok) {
        setMessages(p => ({ ...p, [campId]: 'Registered successfully!' }));
      } else {
        const data = await r.json() as { error?: { message?: string } };
        setMessages(p => ({ ...p, [campId]: data.error?.message ?? 'Registration failed.' }));
      }
    }).catch(() => setMessages(p => ({ ...p, [campId]: 'Registration failed.' })));
  }

  return (
    <div className="container" style={{ padding: '2rem 1rem' }}>
      <h1 style={{ marginBottom: '1.5rem' }}>Donation Camps</h1>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ flex: 1, minWidth: 200, marginBottom: 0 }}>
            <label htmlFor="camp-filter">Filter camps</label>
            <input
              id="camp-filter"
              type="text"
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="Search by name, venue or address"
            />
          </div>
          <button className="btn btn-outline" onClick={() => { void handleUseMyLocation(); }} disabled={locating || loading}>
            {locating ? 'Locating...' : '📍 Near Me'}
          </button>
          <button className="btn btn-outline" onClick={fetchAll} disabled={loading}>
            Show All
          </button>
        </div>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: '2rem' }}><span className="spinner" /></div>}
      {error && <div className="alert alert-error">{error}</div>}
      {!loading && filtered.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No upcoming donation camps found.</p>}

      <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
        {filtered.map(camp => (
          <div key={camp.id} className="camp-card">
            <div className="camp-header">
              <h3>{camp.name}</h3>
              {camp.distance_km !== undefined && (
                <span className="badge">{camp.distance_km} km</span>
              )}
            </div>
            <div className="camp-meta">
              <span>📅 {new Date(camp.camp_date).toLocaleDateString()}{camp.camp_time ? ` at ${camp.camp_time}` : ''}</span>
              <span>📍 {camp.venue}</span>
              <span>🏢 {camp.organizer}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{camp.address}</span>
            </div>
            {camp.goodies && (
              <div style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
                🎁 <em>{camp.goodies}</em>
              </div>
            )}
            <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                className="btn btn-primary"
                style={{ padding: '0.4rem 1rem' }}
                onClick={() => handleRegister(camp.id)}
                disabled={messages[camp.id] === 'Registered successfully!'}
              >
                {messages[camp.id] === 'Registered successfully!' ? '✓ Registered' : 'Register Interest'}
              </button>
              {messages[camp.id] && messages[camp.id] !== 'Registered successfully!' && (
                <span style={{ fontSize: '0.85rem', color: messages[camp.id].includes('log in') ? 'var(--primary)' : 'var(--danger)' }}>
                  {messages[camp.id]}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
