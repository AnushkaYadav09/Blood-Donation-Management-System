import { useState, FormEvent } from 'react';
import { GoogleLogin, CredentialResponse } from '@react-oauth/google';
import { saveAuth } from '../auth';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/donors/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message || 'Login failed. Please try again.');
        return;
      }
      saveAuth(data.token, data.donor.id);
      window.location.href = '/profile';
    } catch {
      setError('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSuccess(credentialResponse: CredentialResponse) {
    if (!credentialResponse.credential) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/donors/google-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: credentialResponse.credential }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message || 'Google sign-in failed.');
        return;
      }
      saveAuth(data.token, data.donor.id);
      // Check if profile needs completion (Google sign-in sets placeholder defaults)
      const profileRes = await fetch(`/api/donors/${data.donor.id}/profile`, {
        headers: { Authorization: `Bearer ${data.token}` },
      });
      if (profileRes.ok) {
        const profile = await profileRes.json() as { blood_group?: string; gender?: string; phone_number?: string };
        const needsCompletion = !profile.phone_number || (profile.blood_group === 'O+' && profile.gender === 'Other');
        window.location.href = needsCompletion ? '/complete-profile' : '/profile';
      } else {
        window.location.href = '/profile';
      }
    } catch {
      setError('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 440, padding: '3rem 1rem' }}>
      <div className="card">
        <h1 style={{ marginBottom: '0.25rem' }}>Welcome back</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Sign in to your donor account</p>

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
              required
              placeholder="you@example.com"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              placeholder="••••••••"
            />
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
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => setError('Google sign-in failed. Please try again.')}
            text="signin_with"
            shape="rectangular"
            width="360"
          />
        </div>

        <p style={{ textAlign: 'center', marginTop: '1.25rem', color: 'var(--text-muted)' }}>
          Don't have an account? <a href="/register">Register</a>
        </p>
        <p style={{ textAlign: 'center', marginTop: '0.5rem' }}>
          <a href="/forgot-password" style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Forgot password?</a>
        </p>
      </div>
    </div>
  );
}
