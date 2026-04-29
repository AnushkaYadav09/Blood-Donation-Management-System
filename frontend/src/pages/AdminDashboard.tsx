import { useEffect, useState } from 'react';

interface Stats { totalDonors: number; totalDonations: number; totalScreenings: number; totalPageVisits: number; todayLogins: number; }
interface Donor { id: string; full_name: string; email: string; blood_group: string; gender: string; location_city: string; is_available: boolean; created_at: string; last_login: string | null; donation_count: string; screening_count: string; last_screened: string | null; }
interface Activity { path: string; ip_address: string; visited_at: string; donor_name: string | null; donor_email: string | null; }

function adminHeaders(): Record<string, string> {
  const t = localStorage.getItem('adminToken');
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [donors, setDonors] = useState<Donor[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [tab, setTab] = useState<'overview' | 'donors' | 'activity'>('overview');
  const [search, setSearch] = useState('');
  const adminName = localStorage.getItem('adminName') ?? 'Admin';

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) { window.location.href = '/admin'; return; }
    fetch('/api/admin/stats', { headers: adminHeaders() }).then(r => r.ok ? r.json() : null).then(d => { if (d) setStats(d as Stats); }).catch(() => {});
    fetch('/api/admin/donors', { headers: adminHeaders() }).then(r => r.ok ? r.json() : null).then(d => { if (d) setDonors(d as Donor[]); }).catch(() => {});
    fetch('/api/admin/activity', { headers: adminHeaders() }).then(r => r.ok ? r.json() : null).then(d => { if (d) setActivity(d as Activity[]); }).catch(() => {});
  }, []);

  function logout() { localStorage.removeItem('adminToken'); localStorage.removeItem('adminName'); window.location.href = '/admin'; }

  const filteredDonors = donors.filter(d =>
    d.full_name.toLowerCase().includes(search.toLowerCase()) ||
    d.email.toLowerCase().includes(search.toLowerCase()) ||
    d.blood_group.toLowerCase().includes(search.toLowerCase()) ||
    d.location_city?.toLowerCase().includes(search.toLowerCase())
  );

  const tabStyle = (t: string) => ({
    padding: '0.5rem 1.25rem', borderRadius: 8, border: '2px solid',
    borderColor: tab === t ? 'var(--primary)' : '#e5e7eb',
    background: tab === t ? 'var(--primary)' : '#fff',
    color: tab === t ? '#fff' : 'var(--text)',
    fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem',
  });

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* Admin navbar */}
      <div style={{ background: '#1e293b', color: '#fff', padding: '0.75rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.25rem' }}>🩸</span>
          <strong>BloodConnect Admin</strong>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.875rem' }}>
          <span>👤 {adminName}</span>
          <button onClick={logout} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', padding: '0.3rem 0.75rem', borderRadius: 6, cursor: 'pointer' }}>Logout</button>
        </div>
      </div>

      <div className="container" style={{ padding: '1.5rem 1rem' }}>
        <h1 style={{ marginBottom: '1.5rem' }}>Admin Dashboard</h1>

        {/* Stats cards */}
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            {[
              { label: 'Total Donors', value: stats.totalDonors, emoji: '👥', color: '#3b82f6' },
              { label: 'Total Donations', value: stats.totalDonations, emoji: '🩸', color: '#ef4444' },
              { label: 'Screenings Done', value: stats.totalScreenings, emoji: '🔬', color: '#8b5cf6' },
              { label: 'Page Visits', value: stats.totalPageVisits, emoji: '📊', color: '#10b981' },
              { label: "Today's Logins", value: stats.todayLogins, emoji: '🔑', color: '#f59e0b' },
            ].map(s => (
              <div key={s.label} className="card" style={{ textAlign: 'center', padding: '1rem' }}>
                <div style={{ fontSize: '1.75rem' }}>{s.emoji}</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          <button style={tabStyle('overview')} onClick={() => setTab('overview')}>📋 Overview</button>
          <button style={tabStyle('donors')} onClick={() => setTab('donors')}>👥 Donors ({donors.length})</button>
          <button style={tabStyle('activity')} onClick={() => setTab('activity')}>📊 Activity Log</button>
        </div>

        {/* Overview tab */}
        {tab === 'overview' && (
          <div className="card">
            <h2 className="section-heading">Recent Registrations</h2>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead><tr><th>Name</th><th>Email</th><th>Blood Group</th><th>City</th><th>Registered</th></tr></thead>
                <tbody>
                  {donors.slice(0, 10).map(d => (
                    <tr key={d.id}>
                      <td>{d.full_name}</td>
                      <td style={{ fontSize: '0.82rem' }}>{d.email}</td>
                      <td><span className="badge badge-blood">{d.blood_group}</span></td>
                      <td>{d.location_city}</td>
                      <td style={{ fontSize: '0.82rem' }}>{new Date(d.created_at).toLocaleDateString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Donors tab */}
        {tab === 'donors' && (
          <div className="card">
            <div style={{ marginBottom: '1rem' }}>
              <input type="text" placeholder="Search by name, email, blood group, city..."
                value={search} onChange={e => setSearch(e.target.value)}
                style={{ width: '100%', maxWidth: 400 }} />
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr><th>#</th><th>Name</th><th>Email</th><th>Blood</th><th>Gender</th><th>City</th><th>Available</th><th>Donations</th><th>Screenings</th><th>Last Login</th><th>Joined</th></tr>
                </thead>
                <tbody>
                  {filteredDonors.map((d, i) => (
                    <tr key={d.id}>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{i + 1}</td>
                      <td style={{ fontWeight: 600 }}>{d.full_name}</td>
                      <td style={{ fontSize: '0.8rem' }}>{d.email}</td>
                      <td><span className="badge badge-blood">{d.blood_group}</span></td>
                      <td>{d.gender}</td>
                      <td>{d.location_city}</td>
                      <td style={{ textAlign: 'center' }}>{d.is_available ? '✅' : '❌'}</td>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--primary)' }}>{d.donation_count}</td>
                      <td style={{ textAlign: 'center' }}>{d.screening_count}</td>
                      <td style={{ fontSize: '0.78rem' }}>{d.last_login ? new Date(d.last_login).toLocaleDateString('en-IN') : '—'}</td>
                      <td style={{ fontSize: '0.78rem' }}>{new Date(d.created_at).toLocaleDateString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Activity tab */}
        {tab === 'activity' && (
          <div className="card">
            <h2 className="section-heading">Recent Page Visits (last 100)</h2>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead><tr><th>Time</th><th>Path</th><th>Donor</th><th>IP Address</th></tr></thead>
                <tbody>
                  {activity.map((a, i) => (
                    <tr key={i}>
                      <td style={{ fontSize: '0.78rem', whiteSpace: 'nowrap' }}>{new Date(a.visited_at).toLocaleString('en-IN')}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>{a.path}</td>
                      <td style={{ fontSize: '0.82rem' }}>{a.donor_name ? `${a.donor_name} (${a.donor_email})` : 'Guest'}</td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{a.ip_address}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
