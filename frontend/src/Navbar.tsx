import { useEffect, useState } from 'react';
import { isLoggedIn, logout, getDonorId, authHeaders } from './auth';

const links = [
  { to: '/', label: '🏠 Home' },
  { to: '/blood-banks', label: '🏥 Blood Banks' },
];

interface UserInfo { full_name: string; email: string; }

export default function Navbar() {
  const [loggedIn, setLoggedIn] = useState(isLoggedIn());
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    const handler = () => setLoggedIn(isLoggedIn());
    window.addEventListener('storage', handler);
    const id = setInterval(() => setLoggedIn(isLoggedIn()), 500);
    return () => { window.removeEventListener('storage', handler); clearInterval(id); };
  }, []);

  useEffect(() => {
    if (!loggedIn) { setUserInfo(null); return; }
    const donorId = getDonorId();
    if (!donorId) return;
    fetch(`/api/donors/${donorId}/profile`, { headers: authHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then((d: UserInfo | null) => { if (d) setUserInfo({ full_name: d.full_name, email: d.email }); })
      .catch(() => {});
  }, [loggedIn]);

  const path = window.location.pathname;

  // Close dropdown on outside click
  useEffect(() => {
    const close = () => setDropdownOpen(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  return (
    <nav className="navbar">
      <a href="/" className="navbar-brand">🩸 BloodConnect</a>
      <ul className="navbar-links">
        {links.map(l => (
          <li key={l.to}>
            <a href={l.to} className={path === l.to ? 'active' : ''}>{l.label}</a>
          </li>
        ))}
        {loggedIn ? (
          <>
            {/* User avatar + dropdown */}
            <li style={{ position: 'relative' }}>
              <button
                onClick={e => { e.stopPropagation(); setDropdownOpen(o => !o); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)',
                  borderRadius: 8, padding: '0.35rem 0.75rem', cursor: 'pointer', color: '#fff',
                }}
              >
                <span style={{
                  width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: '0.9rem', flexShrink: 0,
                }}>
                  {userInfo?.full_name?.[0]?.toUpperCase() ?? '👤'}
                </span>
                <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.875rem' }}>
                  {userInfo?.full_name ?? 'My Account'}
                </span>
                <span style={{ fontSize: '0.65rem' }}>▼</span>
              </button>

              {dropdownOpen && (
                <div onClick={e => e.stopPropagation()} style={{
                  position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                  background: '#fff', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                  minWidth: 220, zIndex: 1000, overflow: 'hidden',
                }}>
                  {/* User info header */}
                  <div style={{ padding: '0.85rem 1rem', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>
                    <div style={{ fontWeight: 700, color: '#1a1a1a', fontSize: '0.9rem' }}>
                      {userInfo?.full_name ?? '—'}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#666', marginTop: '0.15rem', wordBreak: 'break-all' }}>
                      {userInfo?.email ?? '—'}
                    </div>
                  </div>
                  {/* Menu items */}
                  <a href="/profile" style={{
                    display: 'flex', alignItems: 'center', gap: '0.6rem',
                    padding: '0.65rem 1rem', color: '#333', textDecoration: 'none',
                    fontSize: '0.875rem', transition: 'background 0.15s',
                  }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f5')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    👤 My Profile
                  </a>
                  <a href="/screening" style={{
                    display: 'flex', alignItems: 'center', gap: '0.6rem',
                    padding: '0.65rem 1rem', color: '#333', textDecoration: 'none',
                    fontSize: '0.875rem',
                  }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f5')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    ✅ Check Eligibility
                  </a>
                  <div style={{ borderTop: '1px solid #f0f0f0' }}>
                    <button onClick={logout} style={{
                      width: '100%', textAlign: 'left', padding: '0.65rem 1rem',
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: '#c41e3a', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.6rem',
                    }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#fff5f5')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      🚪 Logout
                    </button>
                  </div>
                </div>
              )}
            </li>
          </>
        ) : (
          <>
            <li><a href="/login" className={path === '/login' ? 'active' : ''}>Login</a></li>
            <li>
              <a href="/register" className={path === '/register' ? 'active' : ''}
                style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 6, padding: '0.35rem 0.75rem' }}>
                Register
              </a>
            </li>
          </>
        )}
      </ul>
    </nav>
  );
}
