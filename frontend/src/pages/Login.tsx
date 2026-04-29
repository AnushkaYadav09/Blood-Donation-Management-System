import { useState, FormEvent } from 'react';
import { GoogleLogin, CredentialResponse } from '@react-oauth/google';
import { saveAuth } from '../auth';

type LoginMode = 'user' | 'admin';

export default function Login() {
  const [mode, setMode] = useState<LoginMode>('user');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function switchMode(m: LoginMode) {
    setMode(m); setError(null); setEmail(''); setPassword('');
  }

  // ─── User login ───────────────────────────────────────────────────────────
  async function handleUserLogin(e: FormEvent) {
    e.preventDefault(); setError(null); setLoading(true);
    try {
      const res = await fetch('/api/donors/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json() as { token?: string; donor?: { id: string }; error?: { message: string } };
      if (!res.ok) { setError(data.error?.message ?? 'Login failed.'); return; }
      saveAuth(data.token!, data.donor!.id);
      window.location.href = '/profile';
    } catch { setError('Network error. Please check your connection.'); }
    finally { setLoading(false); }
  }

  // ─── Admin login ──────────────────────────────────────────────────────────
  async function handleAdminLogin(e: FormEvent) {
    e.preventDefault(); setError(null); setLoading(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json() as { token?: string; admin?: { full_name: string }; error?: { message: string } };
      if (!res.ok) { setError(data.error?.message ?? 'Admin login failed.'); return; }
      localStorage.setItem('adminToken', data.token!);
      localStorage.setItem('adminName', data.admin?.full_name ?? 'Admin');
      window.open('/admin/dashboard', '_blank');
    } catch { setError('Network error. Please check your connection.'); }
    finally { setLoading(false); }
  }

  // ─── Google login (user only) ─────────────────────────────────────────────
  async function handleGoogleSuccess(credentialResponse: CredentialResponse) {
    if (!credentialResponse.credential) return;
    setError(null); setLoading(true);
    try {
      const res = await fetch('/api/donors/google-auth', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: credentialResponse.credential }),
      });
      const data = await res.json() as { token?: string; donor?: { id: string }; error?: { message: string } };
      if (!res.ok) { setError(data.error?.message ?? 'Google sign-in failed.'); return; }
      saveAuth(data.token!, data.donor!.id);
      // Check if profile needs completion
      const profileRes = await fetch(`/api/donors/${data.donor!.id}/profile`, {
        headers: { Authorization: `Bearer ${data.token}` },
      });
      if (profileRes.ok) {
        const profile = await profileRes.json() as { blood_group?: string; gender?: string; phone_number?: string };
        const needsCompletion = !profile.phone_number || (profile.blood_group === 'O+' && profile.gender === 'Other');
        window.location.href = needsCompletion ? '/complete-profile' : '/profile';
      } else {
        window.location.href = '/profile';
      }
    } catch { setError('Network error. Please check your connection.'); }
    finally { setLoading(false); }
  }

  return (
    <div className="container" style={{ maxWidth: 440, padding: '3rem 1rem' }}>
      <div className="card">

        {/* Role dropdown */}
        <div className="form-group" style={{ marginBottom: '1.5rem' }}>
          <label htmlFor="role-select">Login as</label>
          <select id="role-select" value={mode} onChange={e => switchMode(e.target.value as LoginMode)}
            style={{ fontWeight: 600 }}>
            <option value="user">👤 User (Donor)</option>
            <option value="admin">🔐 Admin</option>
          </select>
        </div>

        {mode === 'user' ? (
          <>
            <h1 style={{ marginBottom: '0.25rem' }}>Welcome back</h1>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Sign in to your donor account</p>

            <form onSubmit={handleUserLogin} noValidate>
              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                  autoComplete="email" required placeholder="you@example.com" />
              </div>
              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password" required placeholder="••••••••" />
              </div>
              {error && <div className="alert alert-error" role="alert">{error}</div>}
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
                {loading ? <span className="spinner" /> : 'Sign In'}
              </button>
            </form>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '1.25rem 0' }}>
              <hr style={{ flex: 1, border: 'none', borderTop: '1px solid var(--border)' }} />
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>or</span>
              <hr style={{ flex: 1, border: 'none', borderTop: '1px solid var(--border)' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <GoogleLogin onSuccess={handleGoogleSuccess}
                onError={() => setError('Google sign-in failed. Please try again.')}
                text="signin_with" shape="rectangular" width="360" />
            </div>

            <p style={{ textAlign: 'center', marginTop: '1.25rem', color: 'var(--text-muted)' }}>
              Don't have an account? <a href="/register">Register</a>
            </p>
            <p style={{ textAlign: 'center', marginTop: '0.5rem' }}>
              <a href="/forgot-password" style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Forgot password?</a>
            </p>
          </>
        ) : (
          <>
            <h1 style={{ marginBottom: '0.25rem' }}>Admin Login</h1>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Access the BloodConnect admin panel</p>

            <form onSubmit={handleAdminLogin} noValidate>
              <div className="form-group">
                <label htmlFor="admin-email">Admin Email</label>
                <input id="admin-email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                  autoComplete="email" required placeholder="admin@bloodconnect.com" />
              </div>
              <div className="form-group">
                <label htmlFor="admin-password">Password</label>
                <input id="admin-password" type="password" value={password} onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password" required placeholder="••••••••" />
              </div>
              {error && <div className="alert alert-error" role="alert">{error}</div>}
              <button type="submit" className="btn btn-primary" style={{ width: '100%', background: '#1e293b' }} disabled={loading}>
                {loading ? <span className="spinner" /> : '🔐 Sign In as Admin'}
              </button>
            </form>

            <p style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Admin access is restricted. Contact the system administrator if you need access.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
