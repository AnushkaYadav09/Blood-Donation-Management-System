import { useEffect, useState } from "react";
import { getCityFromGPS } from "../utils/location";
import { apiUrl } from "../api";

interface BloodBank {
  id: string; name: string; address: string; city: string;
  contact_number: string | null; operating_hours: string | null; distance_km?: number;
}
interface BloodBankDetail extends BloodBank { location_lat: number; location_lng: number; }
interface Reward { id: string; name: string; description: string | null; eligibility_condition: string | null; }

export default function BloodBanks() {
  const [banks, setBanks] = useState<BloodBank[]>([]);
  const [selected, setSelected] = useState<BloodBankDetail | null>(null);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [searchCity, setSearchCity] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (!navigator.geolocation) { fetchAll(); return; }
    if (navigator.permissions) {
      navigator.permissions.query({ name: 'geolocation' }).then(result => {
        if (result.state === 'granted') {
          navigator.geolocation.getCurrentPosition(
            pos => fetchNearby(pos.coords.latitude, pos.coords.longitude),
            () => fetchAll(), { timeout: 8000 }
          );
        } else { fetchAll(); }
      }).catch(() => fetchAll());
    } else { fetchAll(); }
  }, []);

  function fetchAll() {
    setLoading(true); setError(null);
    fetch(apiUrl("/api/blood-banks"))
      .then(r => { if (!r.ok) throw new Error(); return r.json() as Promise<BloodBank[]>; })
      .then(data => { if (Array.isArray(data)) setBanks(data); else throw new Error(); })
      .catch(() => setError("⚠️ Cannot connect to the server."))
      .finally(() => setLoading(false));
  }

  function fetchNearby(lat: number, lng: number) {
    setLoading(true); setError(null);
    fetch(apiUrl(`/api/blood-banks/nearby?lat=${lat}&lng=${lng}&radius=100`))
      .then(r => r.ok ? r.json() as Promise<BloodBank[]> : Promise.reject())
      .then(data => { if (Array.isArray(data) && data.length > 0) setBanks(data); else fetchAll(); })
      .catch(() => fetchAll())
      .finally(() => setLoading(false));
  }

  function handleSearch() {
    if (!searchCity.trim()) { fetchAll(); return; }
    setLoading(true); setError(null);
    fetch(`/api/blood-banks/search?location=${encodeURIComponent(searchCity.trim())}`)
      .then(r => r.ok ? r.json() as Promise<BloodBank[]> : Promise.reject())
      .then(data => setBanks(Array.isArray(data) ? data : []))
      .catch(() => setError("⚠️ Search failed."))
      .finally(() => setLoading(false));
  }

  async function handleUseMyLocation() {
    setLocating(true); setError(null);
    try {
      const { city, lat, lng } = await getCityFromGPS();
      setSearchCity(city);
      fetchNearby(lat, lng);
    } catch {
      setError("Could not get your location.");
      fetchAll();
    } finally { setLocating(false); }
  }

  function handleSelect(bank: BloodBank) {
    setSelected(null); setRewards([]);
    Promise.all([
      fetch(`/api/blood-banks/${bank.id}`).then(r => r.json() as Promise<BloodBankDetail>),
      fetch(`/api/blood-banks/${bank.id}/rewards`).then(r => r.json() as Promise<Reward[]>),
    ]).then(([detail, rews]) => {
      setSelected(detail);
      setRewards(Array.isArray(rews) ? rews : []);
      // Scroll to detail panel
      setTimeout(() => document.getElementById('bank-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    }).catch(() => setError("Failed to load blood bank details."));
  }

  return (
    <div className="container" style={{ padding: "2rem 1rem" }}>
      <h1 style={{ marginBottom: "1.5rem" }}>Find Blood Banks</h1>

      {/* Search bar */}
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end" }}>
          <div className="form-group" style={{ flex: 1, minWidth: 200, marginBottom: 0 }}>
            <label htmlFor="city-search">Search by city or name</label>
            <input id="city-search" type="text" value={searchCity}
              onChange={e => setSearchCity(e.target.value)}
              placeholder="e.g. Delhi, Mumbai..."
              onKeyDown={e => e.key === "Enter" && handleSearch()} />
          </div>
          <button className="btn btn-primary" onClick={handleSearch} disabled={loading}>Search</button>
          <button className="btn btn-outline" onClick={fetchAll} disabled={loading}>Show All</button>
          <button className="btn btn-outline" onClick={() => { void handleUseMyLocation(); }} disabled={locating || loading}>
            {locating ? "Locating..." : "📍 Near Me"}
          </button>
        </div>
      </div>

      {loading && <div style={{ textAlign: "center", padding: "2rem" }}><div className="spinner" /></div>}
      {error && <div className="alert alert-error" style={{ marginBottom: "1rem" }}>{error}</div>}

      {/* Blood bank cards in a fixed-height scrollable box */}
      {!loading && banks.length === 0 && !error && (
        <div className="card" style={{ textAlign: "center", color: "var(--text-muted)" }}>
          <p>No blood banks found. Try "Show All" or "📍 Near Me".</p>
        </div>
      )}

      <div style={{
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: "1rem",
        maxHeight: "340px",
        overflowY: "auto",
        background: "#fafafa",
        marginBottom: "1.5rem",
      }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: "1rem",
        }}>
        {banks.map(bank => (
          <div key={bank.id} onClick={() => handleSelect(bank)}
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: "1rem",
              cursor: "pointer",
              border: `2px solid ${selected?.id === bank.id ? "var(--primary)" : "#e5e7eb"}`,
              boxShadow: selected?.id === bank.id ? "0 4px 12px rgba(196,30,58,0.15)" : "0 1px 4px rgba(0,0,0,0.06)",
              transition: "all 0.15s",
            }}
          >
            <div style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: "0.35rem", color: "#1a1a1a" }}>
              🏥 {bank.name}
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "0.35rem" }}>
              {bank.address}, {bank.city}
            </div>
            {bank.distance_km !== undefined && (
              <span style={{ fontSize: "0.75rem", background: "#fee2e2", color: "#991b1b", padding: "0.15rem 0.5rem", borderRadius: 20, display: "inline-block", marginBottom: "0.35rem" }}>
                📍 {bank.distance_km} km
              </span>
            )}
            {bank.operating_hours && (
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>🕐 {bank.operating_hours}</div>
            )}
            {bank.contact_number && (
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>📞 {bank.contact_number}</div>
            )}
            <div style={{ fontSize: "0.75rem", color: "var(--primary)", marginTop: "0.5rem", fontWeight: 600 }}>
              Tap for details & map →
            </div>
          </div>
        ))}
        </div>
      </div>

      {/* Detail panel — appears below cards when one is selected */}
      {selected && (
        <div id="bank-detail" className="card" style={{ marginTop: "0.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1rem" }}>
            <div>
              <h2 style={{ marginBottom: "0.25rem" }}>{selected.name}</h2>
              <p style={{ color: "var(--text-muted)", margin: 0 }}>{selected.address}, {selected.city}</p>
            </div>
            <button onClick={() => setSelected(null)}
              style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: 8, padding: "0.3rem 0.75rem", cursor: "pointer", fontSize: "0.85rem", color: "var(--text-muted)" }}>
              ✕ Close
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem 1.5rem", marginBottom: "1rem", fontSize: "0.875rem" }}>
            {selected.operating_hours && <div>🕐 <strong>Hours:</strong> {selected.operating_hours}</div>}
            {selected.contact_number && <div>📞 <strong>Contact:</strong> {selected.contact_number}</div>}
          </div>

          {selected.location_lat && selected.location_lng && (
            <a href={`https://www.google.com/maps/dir/?api=1&destination=${selected.location_lat},${selected.location_lng}`}
              target="_blank" rel="noopener noreferrer"
              className="btn btn-primary" style={{ display: "inline-block", marginBottom: "1rem" }}>
              🗺 Get Directions on Google Maps
            </a>
          )}

          {/* Embedded map */}
          {selected.location_lat && selected.location_lng && (
            <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid var(--border)", marginBottom: rewards.length > 0 ? "1rem" : 0 }}>
              <iframe
                title={`Map of ${selected.name}`}
                width="100%" height="320"
                style={{ border: 0, display: "block" }}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                src={`https://maps.google.com/maps?q=${selected.location_lat},${selected.location_lng}&z=15&output=embed`}
              />
            </div>
          )}

          {rewards.length > 0 && (
            <div style={{ marginTop: "1rem" }}>
              <h3 className="section-heading">🎁 Rewards at this Blood Bank</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "0.75rem" }}>
                {rewards.map(r => (
                  <div key={r.id} style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "0.75rem" }}>
                    <strong style={{ fontSize: "0.875rem" }}>{r.name}</strong>
                    {r.description && <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: "0.25rem 0 0" }}>{r.description}</p>}
                    {r.eligibility_condition && <span style={{ fontSize: "0.72rem", background: "#fef3c7", color: "#92400e", padding: "0.1rem 0.4rem", borderRadius: 20, display: "inline-block", marginTop: "0.35rem" }}>{r.eligibility_condition}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
