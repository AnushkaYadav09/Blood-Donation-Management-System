import { useState, FormEvent } from 'react';

export default function AdminLogin() {
  const [email, setEmail] = useState('admin@bloodconnect.com');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault(); setError(null); setLoading(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json() as { token?: string; admin?: { full_name: string }; error?: { message: string } };
      if (!res.ok) { setError(data.error?.message ?? 'Login failed'); return; }
      localStorage.setItem('adminToken', data.token!);
      localStorage.setItem('adminName', data.admin?.full_name ?? 'Admin');
      window.location.href = '/admin/dashboard';
    } catch { setError('Network error.'); }
    finally { setLoading(false); }
  }

  return (
    <div className="container" style={{ maxWidth: 400, padding: '3rem 1rem' }}>
      <div className="card">
        <div style={{ fontSize: '2rem', marginBottom: '0.5rem', textAlign: 'center' }}>🔐</div>
        <h1 style={{ textAlign: 'center', marginBottom: '0.25rem' }}>Admin Login</h1>
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
          BloodConnect Admin Panel
        </p>
        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Admin@1234" required />
          </div>
          {error && <div className="alert alert-error">{error}</div>}
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
