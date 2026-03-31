import { useEffect, useState } from "react";
import { getCityFromGPS } from "../utils/location";

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
  const [locationAsked, setLocationAsked] = useState(false);

  useEffect(() => {
    if (!navigator.geolocation) { fetchAll(); return; }
    // Check if permission already granted — if so auto-fetch nearby
    if (navigator.permissions) {
      navigator.permissions.query({ name: 'geolocation' }).then(result => {
        if (result.state === 'granted') {
          navigator.geolocation.getCurrentPosition(
            pos => fetchNearby(pos.coords.latitude, pos.coords.longitude),
            () => fetchAll(),
            { timeout: 8000 }
          );
        } else {
          // Not yet granted — show all and let user click Near Me
          fetchAll();
          setLocationAsked(result.state === 'prompt');
        }
      }).catch(() => fetchAll());
    } else {
      fetchAll();
    }
  }, []);

  function fetchAll() {
    setLoading(true); setError(null);
    fetch("/api/blood-banks")
      .then(r => {
        if (!r.ok) throw new Error("server");
        return r.json() as Promise<BloodBank[]>;
      })
      .then(data => {
        if (Array.isArray(data)) setBanks(data);
        else throw new Error("bad response");
      })
      .catch(() => setError("⚠️ Cannot connect to the server. Please make sure the backend is running (npm run dev in the backend folder)."))
      .finally(() => setLoading(false));
  }

  function fetchNearby(lat: number, lng: number) {
    setLoading(true); setError(null);
    fetch(`/api/blood-banks/nearby?lat=${lat}&lng=${lng}&radius=100`)
      .then(r => r.ok ? r.json() as Promise<BloodBank[]> : Promise.reject())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) setBanks(data);
        else fetchAll();
      })
      .catch(() => fetchAll())
      .finally(() => setLoading(false));
  }

  function handleSearch() {
    if (!searchCity.trim()) { fetchAll(); return; }
    setLoading(true); setError(null);
    fetch(`/api/blood-banks/search?location=${encodeURIComponent(searchCity.trim())}`)
      .then(r => r.ok ? r.json() as Promise<BloodBank[]> : Promise.reject())
      .then(data => setBanks(Array.isArray(data) ? data : []))
      .catch(() => setError("⚠️ Search failed. Make sure the backend is running."))
      .finally(() => setLoading(false));
  }

  async function handleUseMyLocation() {
    setLocating(true); setError(null);
    try {
      const { city, lat, lng } = await getCityFromGPS();
      setSearchCity(city);
      setLocationAsked(false);
      fetchNearby(lat, lng);
    } catch {
      setError("Could not get your location. Please allow location access in your browser's address bar, then try again.");
      fetchAll();
    } finally {
      setLocating(false);
    }
  }

  function handleSelect(bank: BloodBank) {
    setSelected(null);
    setRewards([]);
    Promise.all([
      fetch(`/api/blood-banks/${bank.id}`).then(r => r.json() as Promise<BloodBankDetail>),
      fetch(`/api/blood-banks/${bank.id}/rewards`).then(r => r.json() as Promise<Reward[]>),
    ])
      .then(([detail, rews]) => {
        setSelected(detail);
        setRewards(Array.isArray(rews) ? rews : []);
      })
      .catch(() => setError("Failed to load blood bank details."));
  }

  return (
    <div className="container" style={{ padding: "2rem 1rem" }}>
      <h1 style={{ marginBottom: "1.5rem" }}>Find Blood Banks</h1>

      {/* Search bar */}
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end" }}>
          <div className="form-group" style={{ flex: 1, minWidth: 200, marginBottom: 0 }}>
            <label htmlFor="city-search">Search by city or name</label>
            <input
              id="city-search"
              type="text"
              value={searchCity}
              onChange={e => setSearchCity(e.target.value)}
              placeholder="e.g. Delhi, Mumbai..."
              onKeyDown={e => e.key === "Enter" && handleSearch()}
            />
          </div>
          <button className="btn btn-primary" onClick={handleSearch} disabled={loading}>Search</button>
          <button className="btn btn-outline" onClick={fetchAll} disabled={loading}>Show All</button>
          <button
            className="btn btn-outline"
            onClick={() => { void handleUseMyLocation(); }}
            disabled={locating || loading}
          >
            {locating ? "Locating..." : "📍 Near Me"}
          </button>
        </div>
      </div>

      {loading && <div style={{ textAlign: "center", padding: "3rem" }}><div className="spinner" /></div>}
      {error && <div className="alert alert-error" style={{ marginBottom: "1rem" }}>{error}</div>}

      {/* Prompt user to share location if not yet asked */}
      {locationAsked && !loading && (
        <div className="alert alert-success" style={{ marginBottom: "1rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
          <span>📍 Share your location to find the nearest blood banks automatically.</span>
          <button
            className="btn btn-primary"
            style={{ padding: "0.35rem 1rem", fontSize: "0.875rem" }}
            onClick={() => { void handleUseMyLocation(); }}
            disabled={locating}
          >
            {locating ? "Locating..." : "Allow Location"}
          </button>
        </div>
      )}

      <div className="two-col">
        {/* Left: list */}
        <div>
          {!loading && banks.length === 0 && !error && (
            <div className="card" style={{ textAlign: "center", color: "var(--text-muted)" }}>
              <p>No blood banks found.</p>
              <p style={{ fontSize: "0.875rem", marginTop: "0.5rem" }}>
                Try "Show All" or click "📍 Near Me" to find banks near you.
              </p>
            </div>
          )}
          {banks.map(bank => (
            <div
              key={bank.id}
              className="card"
              style={{
                cursor: "pointer",
                marginBottom: "0.75rem",
                borderLeft: selected?.id === bank.id ? "4px solid var(--primary)" : "4px solid transparent",
                transition: "border-color 0.15s",
              }}
              onClick={() => handleSelect(bank)}
            >
              <strong style={{ fontSize: "1rem" }}>{bank.name}</strong>
              <div style={{ color: "var(--text-muted)", fontSize: "0.875rem", marginTop: "0.25rem" }}>
                {bank.address}, {bank.city}
              </div>
              {bank.distance_km !== undefined && (
                <span className="badge badge-red" style={{ marginTop: "0.5rem", display: "inline-block" }}>
                  📍 {bank.distance_km} km away
                </span>
              )}
              {bank.operating_hours && (
                <div style={{ fontSize: "0.8rem", marginTop: "0.35rem", color: "var(--text-muted)" }}>
                  🕐 {bank.operating_hours}
                </div>
              )}
              {bank.contact_number && (
                <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                  📞 {bank.contact_number}
                </div>
              )}
              <div style={{ fontSize: "0.8rem", color: "var(--primary)", marginTop: "0.35rem" }}>
                Click to view on map →
              </div>
            </div>
          ))}
        </div>

        {/* Right: detail + Google Maps embed */}
        {selected ? (
          <div>
            <div className="card" style={{ marginBottom: "1rem" }}>
              <h2 style={{ marginBottom: "0.5rem" }}>{selected.name}</h2>
              <p style={{ color: "var(--text-muted)", marginBottom: "0.75rem" }}>
                {selected.address}, {selected.city}
              </p>
              {selected.operating_hours && (
                <p style={{ marginBottom: "0.35rem" }}>🕐 {selected.operating_hours}</p>
              )}
              {selected.contact_number && (
                <p style={{ marginBottom: "0.75rem" }}>📞 {selected.contact_number}</p>
              )}
              {selected.location_lat && selected.location_lng && (
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${selected.location_lat},${selected.location_lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary"
                  style={{ display: "inline-block" }}
                >
                  🗺 Get Directions on Google Maps
                </a>
              )}
            </div>

            {/* Google Maps embed — no API key needed for embed */}
            {selected.location_lat && selected.location_lng && (
              <div style={{ borderRadius: 8, overflow: "hidden", marginBottom: "1rem", border: "1px solid var(--border)" }}>
                <iframe
                  title={`Map of ${selected.name}`}
                  width="100%"
                  height="280"
                  style={{ border: 0, display: "block" }}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  src={`https://maps.google.com/maps?q=${selected.location_lat},${selected.location_lng}&z=15&output=embed`}
                />
              </div>
            )}

            {rewards.length > 0 && (
              <div className="card">
                <h3 className="section-heading">🎁 Rewards</h3>
                {rewards.map(r => (
                  <div
                    key={r.id}
                    style={{ marginBottom: "0.75rem", paddingBottom: "0.75rem", borderBottom: "1px solid var(--border)" }}
                  >
                    <strong>{r.name}</strong>
                    {r.description && (
                      <p style={{ margin: "0.25rem 0", fontSize: "0.875rem", color: "var(--text-muted)" }}>
                        {r.description}
                      </p>
                    )}
                    {r.eligibility_condition && (
                      <span className="badge badge-red" style={{ fontSize: "0.75rem" }}>
                        {r.eligibility_condition}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="card" style={{ textAlign: "center", color: "var(--text-muted)", padding: "3rem 1rem" }}>
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🏥</div>
            <p>Select a blood bank from the list to view its location on the map.</p>
          </div>
        )}
      </div>
    </div>
  );
}
