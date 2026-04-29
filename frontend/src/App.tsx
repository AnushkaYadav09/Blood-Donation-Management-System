import { BrowserRouter, Routes, Route } from 'react-router-dom';
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
    </BrowserRouter>
  );
}

export default App;
