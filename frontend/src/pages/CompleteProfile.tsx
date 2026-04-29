import { useState, FormEvent, ChangeEvent } from "react";
import { getToken, getDonorId, authHeaders } from "../auth";
const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const GENDERS = ["Male", "Female", "Other"];
const INDIA_PHONE_REGEX = /^\+91[6-9]\d{9}$/;

interface FormData {
  blood_group: string;
  gender: string;
  phone_number: string;
  date_of_birth: string;
  location_city: string;
}
type FieldErrors = Partial<Record<keyof FormData, string>>;

function getMaxDOB(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 18);
  return d.toISOString().split("T")[0];
}

function validate(d: FormData): FieldErrors {
  const e: FieldErrors = {};
  if (!d.blood_group) e.blood_group = "Blood group is required";
  if (!d.gender) e.gender = "Gender is required";
  if (!d.phone_number.trim()) {
    e.phone_number = "Phone number is required";
  } else if (!INDIA_PHONE_REGEX.test(d.phone_number.replace(/\s/g, ""))) {
    e.phone_number = "Enter a valid Indian number (e.g. +91 9876543210)";
  }
  if (!d.date_of_birth) {
    e.date_of_birth = "Date of birth is required";
  } else {
    const age = (Date.now() - new Date(d.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    if (age < 18) e.date_of_birth = "You must be at least 18 years old";
  }
  if (!d.location_city.trim()) e.location_city = "City is required";
  return e;
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="form-group">
      <label>{label}</label>
      {children}
      {error && <span className="field-error" role="alert">{error}</span>}
    </div>
  );
}

export default function CompleteProfile() {
  const [form, setForm] = useState<FormData>({
    blood_group: "", gender: "", phone_number: "+91 ",
    date_of_birth: "", location_city: "",
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleChange(e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    setFieldErrors(prev => ({ ...prev, [name]: undefined }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setApiError(null);
    const errors = validate(form);
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }

    const donorId = getDonorId();
    const token = getToken();
    if (!donorId || !token) { window.location.href = '/login'; return; }

    setSubmitting(true);
    try {
      // Update blood group and gender via profile endpoint
      const res = await fetch(`/api/donors/${donorId}/profile`, {
        method: "PUT",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          blood_group: form.blood_group,
          gender: form.gender,
          phone_number: form.phone_number.replace(/\s/g, ""),
          date_of_birth: form.date_of_birth,
          location_city: form.location_city.trim(),
        }),
      });
      if (res.ok) {
        window.location.href = '/profile';
      } else {
        const data = await res.json() as { error?: { message?: string } };
        setApiError(data.error?.message || "Update failed. Please try again.");
      }
    } catch {
      setApiError("Network error. Please check your connection.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 480, padding: "2rem 1rem" }}>
      <div className="card">
        <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>👤</div>
        <h1 style={{ marginBottom: "0.25rem" }}>Complete Your Profile</h1>
        <p style={{ color: "var(--text-muted)", marginBottom: "1.5rem" }}>
          We need a few more details to set up your donor profile.
        </p>
        <form onSubmit={handleSubmit} noValidate>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 1rem" }}>
            <Field label="Blood Group" error={fieldErrors.blood_group}>
              <select name="blood_group" value={form.blood_group} onChange={handleChange}>
                <option value="">Select...</option>
                {BLOOD_GROUPS.map(bg => <option key={bg} value={bg}>{bg}</option>)}
              </select>
            </Field>
            <Field label="Gender" error={fieldErrors.gender}>
              <select name="gender" value={form.gender} onChange={handleChange}>
                <option value="">Select...</option>
                {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Phone Number" error={fieldErrors.phone_number}>
            <input name="phone_number" type="tel" value={form.phone_number}
              onChange={handleChange} placeholder="+91 9876543210" />
          </Field>

          <Field label="Date of Birth" error={fieldErrors.date_of_birth}>
            <input name="date_of_birth" type="date" value={form.date_of_birth}
              onChange={handleChange} max={getMaxDOB()} />
          </Field>

          <Field label="City" error={fieldErrors.location_city}>
            <input name="location_city" type="text" value={form.location_city}
              onChange={handleChange} placeholder="Your city" />
          </Field>

          {apiError && <div className="alert alert-error" role="alert">{apiError}</div>}

          <button type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={submitting}>
            {submitting ? "Saving..." : "Save & Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
