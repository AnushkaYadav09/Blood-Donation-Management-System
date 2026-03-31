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
import { isLoggedIn, getDonorId, authHeaders } from './auth';

const HEALTH_MESSAGES = [
  "Every drop you donate can save up to 3 lives. You're a hero! 🦸",
  "A healthy donor is a happy donor. Stay hydrated and keep smiling! 💧",
  "Your kindness flows through someone's veins today. Thank you! ❤️",
  "Small act, big impact — your blood donation changes lives. 🌟",
  "You have the power to be someone's lifeline. That's incredible! 💪",
  "Donating blood costs you nothing but means everything to someone. 🩸",
  "Be the reason someone gets a second chance at life today! 🌈",
  "Your generosity is someone else's miracle. Keep being amazing! ✨",
];

function GreetingBanner() {
  const [name, setName] = useState<string | null>(null);
  const [loggedIn, setLoggedIn] = useState(isLoggedIn());
  const message = HEALTH_MESSAGES[new Date().getDay() % HEALTH_MESSAGES.length];

  useEffect(() => {
    const id = setInterval(() => setLoggedIn(isLoggedIn()), 500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!loggedIn) { setName(null); return; }
    const donorId = getDonorId();
    if (!donorId) return;
    fetch(`/api/donors/${donorId}/profile`, { headers: authHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then((d: { full_name?: string } | null) => { if (d?.full_name) setName(d.full_name.split(' ')[0]); })
      .catch(() => {});
  }, [loggedIn]);

  if (!loggedIn || !name) return null;

  return (
    <div style={{
      background: 'linear-gradient(90deg, #fff5f5 0%, #fff0f0 100%)',
      borderBottom: '1px solid #fecaca',
      padding: '0.6rem 1.5rem',
      display: 'flex', alignItems: 'center', gap: '0.75rem',
      flexWrap: 'wrap',
    }}>
      <span style={{ fontSize: '1.1rem' }}>👋</span>
      <span style={{ fontWeight: 700, color: '#c41e3a', fontSize: '0.95rem' }}>
        Hi, {name}!
      </span>
      <span style={{ color: '#555', fontSize: '0.875rem' }}>{message}</span>
    </div>
  );
}

const NotFound = () => (
  <div className="container" style={{ textAlign: 'center', padding: '4rem 1rem' }}>
    <h1 style={{ fontSize: '4rem', color: 'var(--primary)' }}>404</h1>
    <p>Page not found.</p>
    <a href="/" className="btn btn-primary">Go Home</a>
  </div>
);

function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <GreetingBanner />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/screening" element={<Screening />} />
          <Route path="/complete-profile" element={<CompleteProfile />} />
          <Route path="/blood-banks" element={<BloodBanks />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}

export default App;
