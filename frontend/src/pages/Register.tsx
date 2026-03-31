import { useState, FormEvent, ChangeEvent } from "react";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const GENDERS = ["Male", "Female", "Other"];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FormData {
  full_name: string; email: string; password: string;
  phone_number: string; date_of_birth: string;
  gender: string; blood_group: string; location_city: string;
}
type FieldErrors = Partial<Record<keyof FormData, string>>;

function validate(d: FormData): FieldErrors {
  const e: FieldErrors = {};
  if (!d.full_name.trim()) e.full_name = "Full name is required";
  if (!d.email.trim()) e.email = "Email is required";
  else if (!EMAIL_REGEX.test(d.email)) e.email = "Enter a valid email address";
  if (!d.password) e.password = "Password is required";
  else if (d.password.length < 8) e.password = "Password must be at least 8 characters";
  if (!d.phone_number.trim()) e.phone_number = "Phone number is required";
  if (!d.date_of_birth) e.date_of_birth = "Date of birth is required";
  else {
    const age = (Date.now() - new Date(d.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    if (age < 18) e.date_of_birth = "You must be at least 18 years old";
  }
  if (!d.gender) e.gender = "Gender is required";
  if (!d.blood_group) e.blood_group = "Blood group is required";
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

export default function Register() {
  const [form, setForm] = useState<FormData>({
    full_name: "", email: "", password: "", phone_number: "",
    date_of_birth: "", gender: "", blood_group: "", location_city: "",
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
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
    setSubmitting(true);
    try {
      const res = await fetch("/api/donors/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) setApiError("This email is already registered.");
        else if (data?.error?.details?.length) setApiError(data.error.details.join(" "));
        else setApiError(data?.error?.message || "Registration failed. Please try again.");
      } else {
        setSuccess(true);
      }
    } catch {
      setApiError("Network error. Please check your connection.");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="container" style={{ maxWidth: 480, padding: "3rem 1rem", textAlign: "center" }}>
        <div className="card">
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🎉</div>
          <h2>Registration Successful!</h2>
          <p style={{ color: "var(--text-muted)", margin: "0.75rem 0 1.5rem" }}>
            Thank you for joining BloodConnect. Check your email for a confirmation message.
          </p>
          <a href="/login" className="btn btn-primary">Go to Login</a>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ maxWidth: 520, padding: "2rem 1rem" }}>
      <div className="card">
        <h1 style={{ marginBottom: "0.25rem" }}>Donor Registration</h1>
        <p style={{ color: "var(--text-muted)", marginBottom: "1.5rem" }}>Create your account to start saving lives</p>
        <form onSubmit={handleSubmit} noValidate>
          <Field label="Full Name" error={fieldErrors.full_name}>
            <input name="full_name" type="text" value={form.full_name} onChange={handleChange} autoComplete="name" placeholder="Jane Doe" />
          </Field>
          <Field label="Email" error={fieldErrors.email}>
            <input name="email" type="email" value={form.email} onChange={handleChange} autoComplete="email" placeholder="you@example.com" />
          </Field>
          <Field label="Password" error={fieldErrors.password}>
            <input name="password" type="password" value={form.password} onChange={handleChange} autoComplete="new-password" placeholder="Min. 8 characters" />
          </Field>
          <Field label="Phone Number" error={fieldErrors.phone_number}>
            <input name="phone_number" type="tel" value={form.phone_number} onChange={handleChange} autoComplete="tel" placeholder="+1 555 000 0000" />
          </Field>
          <Field label="Date of Birth" error={fieldErrors.date_of_birth}>
            <input name="date_of_birth" type="date" value={form.date_of_birth} onChange={handleChange} />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 1rem" }}>
            <Field label="Gender" error={fieldErrors.gender}>
              <select name="gender" value={form.gender} onChange={handleChange}>
                <option value="">Select...</option>
                {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </Field>
            <Field label="Blood Group" error={fieldErrors.blood_group}>
              <select name="blood_group" value={form.blood_group} onChange={handleChange}>
                <option value="">Select...</option>
                {BLOOD_GROUPS.map(bg => <option key={bg} value={bg}>{bg}</option>)}
              </select>
            </Field>
          </div>
          <Field label="City" error={fieldErrors.location_city}>
            <input name="location_city" type="text" value={form.location_city} onChange={handleChange} autoComplete="address-level2" placeholder="Your city" />
          </Field>
          {apiError && <div className="alert alert-error" role="alert">{apiError}</div>}
          <button type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={submitting}>
            {submitting ? "Creating account..." : "Create Account"}
          </button>
        </form>
        <p style={{ textAlign: "center", marginTop: "1.25rem", color: "var(--text-muted)" }}>
          Already have an account? <a href="/login">Login</a>
        </p>
      </div>
    </div>
  );
}