import { useEffect, useState, FormEvent } from "react";
import { getToken, getDonorId, authHeaders, isLoggedIn } from "../auth";

interface ScreeningForm {
  weight: string; gender: string;
  hasCommunicableDisease: boolean; communicableDiseases: string[];
  hasRecentTattoo: boolean; medicalConditions: string[];
  isPregnant: boolean; isBreastfeeding: boolean; lastDonationDate: string;
}
interface ScreeningResult { eligible: boolean; reason?: string; nextEligibleDate?: string; }

const MEDICAL_CONDITIONS = ["Diabetes", "Hypertension", "Heart Disease", "Asthma", "Epilepsy", "Cancer", "Kidney Disease", "Autoimmune Disorders"];
const COMMUNICABLE_DISEASES = ["HIV/AIDS", "Hepatitis B", "Hepatitis C", "Syphilis", "Malaria", "Tuberculosis"];

function addMonths(date: Date, months: number): Date {
  const d = new Date(date); d.setMonth(d.getMonth() + months); return d;
}

function runChecks(form: ScreeningForm): ScreeningResult {
  const weight = parseFloat(form.weight);
  if (weight < 50) return { eligible: false, reason: "Donors must weigh at least 50 kg to ensure your safety." };
  if (form.hasCommunicableDisease) return { eligible: false, reason: "For the safety of recipients, donors with active communicable diseases are not eligible." };
  if (form.gender === "Female") {
    if (form.isPregnant) return { eligible: false, reason: "Blood donation is not recommended during pregnancy. You are welcome to donate after your pregnancy and recovery period." };
    if (form.isBreastfeeding) return { eligible: false, reason: "We recommend waiting until you have finished breastfeeding before donating blood." };
  }
  if (form.lastDonationDate) {
    const last = new Date(form.lastDonationDate);
    const intervalMonths = form.gender === "Female" ? 6 : 3;
    const nextEligible = addMonths(last, intervalMonths);
    if (new Date() < nextEligible) {
      const nextDateStr = nextEligible.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
      const label = form.gender === "Female" ? "6 months" : "3 months";
      return { eligible: false, reason: `${form.gender === "Female" ? "Female" : "Male"} donors must wait ${label} between donations. You will be eligible again on ${nextDateStr}.`, nextEligibleDate: nextEligible.toISOString().split("T")[0] };
    }
  }
  return { eligible: true };
}

// Yes/No toggle button pair
function YesNo({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
      <button
        type="button"
        onClick={() => onChange(false)}
        style={{
          padding: "0.4rem 1.25rem", borderRadius: 6, border: "2px solid",
          borderColor: !value ? "var(--primary)" : "#d1d5db",
          background: !value ? "var(--primary)" : "#fff",
          color: !value ? "#fff" : "var(--text-muted)",
          fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
        }}
      >No</button>
      <button
        type="button"
        onClick={() => onChange(true)}
        style={{
          padding: "0.4rem 1.25rem", borderRadius: 6, border: "2px solid",
          borderColor: value ? "var(--primary)" : "#d1d5db",
          background: value ? "var(--primary)" : "#fff",
          color: value ? "#fff" : "var(--text-muted)",
          fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
        }}
      >Yes</button>
    </div>
  );
}

// Checkbox grid list
function CheckList({ items, selected, onChange }: {
  items: string[]; selected: string[]; onChange: (item: string) => void;
}) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
      gap: "0.5rem",
      marginTop: "0.75rem",
    }}>
      {items.map(item => {
        const checked = selected.includes(item);
        return (
          <label key={item} style={{
            display: "flex", alignItems: "center", gap: "0.6rem",
            padding: "0.5rem 0.75rem", borderRadius: 8,
            border: `2px solid ${checked ? "var(--primary)" : "#e5e7eb"}`,
            background: checked ? "rgba(196,30,58,0.06)" : "#fff",
            cursor: "pointer", transition: "all 0.15s", userSelect: "none",
          }}>
            <input
              type="checkbox"
              checked={checked}
              onChange={() => onChange(item)}
              style={{ accentColor: "var(--primary)", width: 16, height: 16, flexShrink: 0 }}
            />
            <span style={{ fontSize: "0.875rem", fontWeight: checked ? 600 : 400, color: checked ? "var(--primary)" : "var(--text)" }}>
              {item}
            </span>
          </label>
        );
      })}
    </div>
  );
}

export default function Screening() {
  const [form, setForm] = useState<ScreeningForm>({
    weight: "", gender: "Male", hasCommunicableDisease: false,
    communicableDiseases: [], hasRecentTattoo: false, medicalConditions: [],
    isPregnant: false, isBreastfeeding: false, lastDonationDate: "",
  });
  const [result, setResult] = useState<ScreeningResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [reminderSending, setReminderSending] = useState(false);
  const [reminderMsg, setReminderMsg] = useState<string | null>(null);

  useEffect(() => {
    const donorId = getDonorId();
    if (!donorId) return;
    fetch(`/api/donors/${donorId}/profile`, { headers: authHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then((d: { gender?: string } | null) => { if (d?.gender) setForm(f => ({ ...f, gender: d.gender! })); })
      .catch(() => {});
  }, []);

  function toggleItem(arr: string[], item: string) {
    return arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item];
  }

  async function sendReminderEmail(nextDate: string) {
    const donorId = getDonorId();
    if (!donorId) return;
    setReminderSending(true); setReminderMsg(null);
    try {
      const res = await fetch(`/api/donors/${donorId}/send-reminder`, {
        method: "POST", headers: authHeaders(),
      });
      const data = await res.json() as { message?: string; error?: { message?: string } };
      setReminderMsg(res.ok ? `✅ Reminder sent! Check your email. Next eligible: ${new Date(nextDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}` : (data.error?.message ?? "Failed to send."));
    } catch { setReminderMsg("Network error. Could not send reminder."); }
    finally { setReminderSending(false); }
  }

  function addToGoogleCalendar(nextDate: string) {
    const date = new Date(nextDate);
    const dateStr = date.toISOString().replace(/-|:|\.\d{3}/g, "").slice(0, 8);
    const title = encodeURIComponent("🩸 Time to Donate Blood — BloodConnect");
    const details = encodeURIComponent("You are now eligible to donate blood! Visit your nearest blood bank today and save up to 3 lives.");
    const location = encodeURIComponent("Nearest Blood Bank");
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dateStr}/${dateStr}&details=${details}&location=${location}`;
    window.open(url, "_blank");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault(); setError(null); setResult(null);
    const weight = parseFloat(form.weight);
    if (isNaN(weight) || weight <= 0) { setError("Please enter a valid weight."); return; }
    setLoading(true);
    const donorId = getDonorId(); const token = getToken();
    if (donorId && token) {
      try {
        const res = await fetch(`/api/donors/${donorId}/screening`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            weight, hasCommunicableDisease: form.hasCommunicableDisease,
            communicableDiseases: form.communicableDiseases,
            hasRecentTattoo: form.hasRecentTattoo,
            medicalConditions: form.medicalConditions,
            isPregnant: form.isPregnant, isBreastfeeding: form.isBreastfeeding,
            lastDonationDate: form.lastDonationDate || undefined,
          }),
        });
        const data = await res.json() as ScreeningResult;
        setResult(res.ok ? data : runChecks(form));
      } catch { setResult(runChecks(form)); }
    } else {
      setResult(runChecks(form));
    }
    setLoading(false);
  }

  const isFemale = form.gender === "Female";

  return (
    <div className="container" style={{ maxWidth: 640, padding: "2rem 1rem" }}>
      <div className="card">
        <h1 style={{ marginBottom: "0.25rem" }}>Eligibility Screening</h1>
        <p style={{ color: "var(--text-muted)", marginBottom: "1.75rem" }}>
          Answer a few questions to check if you can donate blood today.
          {!isLoggedIn() && <> You can also <a href="/login">log in</a> for a personalised check.</>}
        </p>

        {result ? (
          <div>
            <div style={{
              padding: "1.25rem 1.5rem", borderRadius: 12, lineHeight: 1.8,
              background: result.eligible ? "#f0fdf4" : "#fff5f5",
              border: `2px solid ${result.eligible ? "#86efac" : "#fca5a5"}`,
              color: result.eligible ? "#166534" : "#991b1b",
            }}>
              <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>
                {result.eligible ? "✅" : "❌"}
              </div>
              <strong style={{ fontSize: "1.05rem" }}>
                {result.eligible ? "You are eligible to donate blood!" : "Not eligible at this time"}
              </strong>
              {!result.eligible && result.reason && (
                <p style={{ marginTop: "0.5rem", marginBottom: 0 }}>{result.reason}</p>
              )}
              {result.eligible && (
                <p style={{ marginTop: "0.5rem", marginBottom: 0 }}>
                  Thank you for choosing to save lives. Find a blood bank near you and book your donation today.
                </p>
              )}
            </div>
            <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.25rem", flexWrap: "wrap" }}>
              <button className="btn btn-primary" onClick={() => { setResult(null); setError(null); setReminderMsg(null); }}>
                Check Again
              </button>
              {result.eligible && <a href="/blood-banks" className="btn btn-outline">Find a Blood Bank</a>}
              {!result.eligible && result.nextEligibleDate && isLoggedIn() && (
                <>
                  <button className="btn btn-outline" disabled={reminderSending}
                    onClick={() => { void sendReminderEmail(result.nextEligibleDate!); }}>
                    {reminderSending ? "⏳ Sending..." : "📧 Send Reminder Email"}
                  </button>
                  <button className="btn btn-outline"
                    style={{ background: "#fff", borderColor: "#4285f4", color: "#4285f4" }}
                    onClick={() => addToGoogleCalendar(result.nextEligibleDate!)}>
                    📅 Add to Google Calendar
                  </button>
                </>
              )}
            </div>
            {reminderMsg && (
              <div className={`alert ${reminderMsg.startsWith("✅") ? "alert-success" : "alert-error"}`}
                style={{ marginTop: "0.75rem", fontSize: "0.875rem" }}>
                {reminderMsg}
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>

            {/* Weight */}
            <div className="form-group">
              <label htmlFor="weight">Weight (kg)</label>
              <input id="weight" type="number" min="1" step="0.1" value={form.weight}
                onChange={e => setForm(f => ({ ...f, weight: e.target.value }))}
                placeholder="e.g. 65" required style={{ maxWidth: 200 }} />
              <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>Minimum 50 kg required</span>
            </div>

            {/* Gender (only if not logged in) */}
            {!isLoggedIn() && (
              <div className="form-group">
                <label htmlFor="gender">Gender</label>
                <select id="gender" value={form.gender}
                  onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}
                  style={{ maxWidth: 200 }}>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            )}

            {/* Last donation date */}
            <div className="form-group">
              <label>Last Donation Date <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>(leave blank if never donated)</span></label>
              <input type="date" value={form.lastDonationDate}
                onChange={e => setForm(f => ({ ...f, lastDonationDate: e.target.value }))}
                style={{ maxWidth: 220 }} />
              <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                {isFemale ? "Female donors must wait 6 months between donations." : "Male donors must wait 3 months between donations."}
              </span>
            </div>

            {/* Communicable diseases */}
            <div className="form-group">
              <label>Do you have any communicable diseases?</label>
              <YesNo value={form.hasCommunicableDisease}
                onChange={v => setForm(f => ({ ...f, hasCommunicableDisease: v, communicableDiseases: v ? f.communicableDiseases : [] }))} />
              {form.hasCommunicableDisease && (
                <>
                  <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginTop: "0.75rem", marginBottom: 0 }}>
                    Select all that apply:
                  </p>
                  <CheckList items={COMMUNICABLE_DISEASES} selected={form.communicableDiseases}
                    onChange={item => setForm(f => ({ ...f, communicableDiseases: toggleItem(f.communicableDiseases, item) }))} />
                </>
              )}
            </div>

            {/* Tattoo / piercing */}
            <div className="form-group">
              <label>Have you had a tattoo or piercing in the last 6 months?</label>
              <YesNo value={form.hasRecentTattoo}
                onChange={v => setForm(f => ({ ...f, hasRecentTattoo: v }))} />
            </div>

            {/* Medical conditions */}
            <div className="form-group">
              <label>Medical Conditions <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>(select all that apply)</span></label>
              <CheckList items={MEDICAL_CONDITIONS} selected={form.medicalConditions}
                onChange={item => setForm(f => ({ ...f, medicalConditions: toggleItem(f.medicalConditions, item) }))} />
            </div>

            {/* Female-only questions */}
            {isFemale && (
              <>
                <div className="form-group">
                  <label>Are you currently pregnant?</label>
                  <YesNo value={form.isPregnant} onChange={v => setForm(f => ({ ...f, isPregnant: v }))} />
                </div>
                <div className="form-group">
                  <label>Are you currently breastfeeding?</label>
                  <YesNo value={form.isBreastfeeding} onChange={v => setForm(f => ({ ...f, isBreastfeeding: v }))} />
                </div>
              </>
            )}

            {error && <div className="alert alert-error" role="alert">{error}</div>}

            <button type="submit" className="btn btn-primary" style={{ width: "100%", marginTop: "0.5rem" }} disabled={loading}>
              {loading ? "Checking..." : "Check Eligibility"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
