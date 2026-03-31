import { useEffect, useState } from "react";
import { isLoggedIn } from "../auth";

interface Stats {
  totalDonors: number;
  totalDonations: number;
  totalBloodBanks: number;
  totalCamps: number;
}

export default function Home() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then(r => r.ok ? r.json() as Promise<Stats> : null)
      .then(data => { if (data) setStats(data); })
      .catch(() => {});
  }, []);

  return (
    <>
      {/* Hero */}
      <section className="hero">
        <div className="hero-content">
          <h1>Every Drop Counts</h1>
          <p>Join thousands of donors saving lives across the country. Register today and make a difference.</p>
          <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
            {isLoggedIn() ? (
              <a href="/profile" className="btn btn-white">My Profile</a>
            ) : (
              <>
                <a href="/register" className="btn btn-white">Become a Donor</a>
                <a href="/login" className="btn" style={{ background: "rgba(255,255,255,0.15)", color: "#fff", border: "2px solid rgba(255,255,255,0.5)" }}>Login</a>
              </>
            )}
            <a href="/blood-banks" className="btn" style={{ background: "rgba(255,255,255,0.15)", color: "#fff", border: "2px solid rgba(255,255,255,0.5)" }}>Find Blood Banks</a>
          </div>
        </div>
      </section>

      {/* Stats */}
      {stats && (
        <section className="container" style={{ padding: "2.5rem 1rem 0" }}>
          <div className="stats-row">
            <div className="stat-card">
              <div className="stat-number">{stats.totalDonors.toLocaleString()}</div>
              <div className="stat-label">Registered Donors</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{stats.totalDonations.toLocaleString()}</div>
              <div className="stat-label">Donations Made</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{stats.totalBloodBanks.toLocaleString()}</div>
              <div className="stat-label">Blood Banks</div>
            </div>
          </div>
        </section>
      )}

      {/* About */}
      <section className="container" style={{ padding: "3rem 1rem" }}>
        <div className="card" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem", alignItems: "center" }}>
          <div>
            <h2 style={{ color: "var(--primary)", marginBottom: "1rem" }}>About BloodConnect</h2>
            <p style={{ color: "var(--text-muted)", lineHeight: 1.8, marginBottom: "1rem" }}>
              BloodConnect is a free platform that connects blood donors with blood banks, hospitals, and donation camps across India.
              Our mission is to make blood donation easy, accessible, and rewarding for everyone.
            </p>
            <p style={{ color: "var(--text-muted)", lineHeight: 1.8, marginBottom: "1.5rem" }}>
              Whether you are a donor looking to give, a hospital searching for compatible donors in an emergency,
              or a blood bank managing your inventory — BloodConnect brings everyone together on one platform.
            </p>
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <a href="/register" className="btn btn-primary">Register as Donor</a>
              <a href="/screening" className="btn btn-outline">Check Eligibility</a>
            </div>
          </div>
          <div style={{ display: "grid", gap: "1rem" }}>
            {[
              { icon: "🩸", title: "Donate Blood", desc: "Register as a donor and help save lives in your community." },
              { icon: "🏥", title: "Find Blood Banks", desc: "Locate nearby blood banks, check hours, and get directions." },
            ].map(item => (
              <div key={item.title} style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
                <span style={{ fontSize: "1.75rem", flexShrink: 0 }}>{item.icon}</span>
                <div>
                  <strong style={{ display: "block", marginBottom: "0.2rem" }}>{item.title}</strong>
                  <span style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>{item.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section style={{ background: "var(--gray-100)", padding: "3rem 1rem" }}>
        <div className="container">
          <h2 style={{ textAlign: "center", marginBottom: "2rem" }}>How It Works</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1.5rem", textAlign: "center" }}>
            {[
              { step: "1", title: "Register", desc: "Create your free donor account in under 2 minutes." },
              { step: "2", title: "Check Eligibility", desc: "Answer a quick health screening to confirm you can donate." },
              { step: "3", title: "Find a Location", desc: "Locate a blood bank or upcoming camp near you." },
              { step: "4", title: "Donate & Earn", desc: "Donate blood and earn rewards from participating blood banks." },
            ].map(item => (
              <div key={item.step} className="card" style={{ textAlign: "center" }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--primary)", color: "#fff", fontSize: "1.25rem", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem" }}>
                  {item.step}
                </div>
                <h3 style={{ marginBottom: "0.5rem" }}>{item.title}</h3>
                <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Quick links */}
      <section className="container" style={{ padding: "3rem 1rem 4rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1.5rem" }}>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>🏥</div>
            <h3 style={{ marginBottom: "0.5rem" }}>Find Blood Banks</h3>
            <p style={{ color: "var(--text-muted)", marginBottom: "1rem", fontSize: "0.875rem" }}>Locate nearby blood banks, view operating hours, and get directions.</p>
            <a href="/blood-banks" className="btn btn-primary">Explore</a>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>✅</div>
            <h3 style={{ marginBottom: "0.5rem" }}>Check Eligibility</h3>
            <p style={{ color: "var(--text-muted)", marginBottom: "1rem", fontSize: "0.875rem" }}>Answer a few questions to find out if you are eligible to donate today.</p>
            <a href="/screening" className="btn btn-primary">Start Screening</a>
          </div>
        </div>
      </section>
    </>
  );
}