import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Navbar from './Navbar';
import Register from './pages/Register';
import Login from './pages/Login';
import Profile from './pages/Profile';
import BloodBanks from './pages/BloodBanks';
import CompleteProfile from './pages/CompleteProfile';
import Screening from './pages/Screening';
import Home from './pages/Home';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';

const NotFound = () => (
  <div className="container" style={{ textAlign: 'center', padding: '4rem 1rem' }}>
    <h1 style={{ fontSize: '4rem', color: 'var(--primary)' }}>404</h1>
    <p>Page not found.</p>
    <a href="/" className="btn btn-primary">Go Home</a>
  </div>
);

function App() {
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => { e.preventDefault(); setInstallPrompt(e); setShowBanner(true); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  function handleInstall() {
    if (!installPrompt) return;
    (installPrompt as unknown as { prompt: () => void }).prompt();
    setShowBanner(false);
  }

  return (
    <BrowserRouter>
      <Navbar />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/screening" element={<Screening />} />
          <Route path="/complete-profile" element={<CompleteProfile />} />
          <Route path="/admin" element={<AdminLogin />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/blood-banks" element={<BloodBanks />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      {showBanner && (
        <div id="pwa-install-banner">
          <span>🩸 Add BloodConnect to your home screen for quick access!</span>
          <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
            <button onClick={handleInstall}
              style={{ background: '#fff', color: '#c41e3a', border: 'none', borderRadius: 6, padding: '0.4rem 0.9rem', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}>
              Install
            </button>
            <button onClick={() => setShowBanner(false)}
              style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: 'none', borderRadius: 6, padding: '0.4rem 0.75rem', cursor: 'pointer', fontSize: '0.85rem' }}>
              ✕
            </button>
          </div>
        </div>
      )}
    </BrowserRouter>
  );
}

export default App;
