import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../AuthContext.jsx";
import ResendConfirmation from "../components/ResendConfirmation.jsx";

export default function Register() {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setAlreadyRegistered(false);
    setBusy(true);
    try {
      const { user, needsEmailConfirm, alreadyRegistered: exists } = await api.register(form);
      if (exists) {
        setAlreadyRegistered(true);
      } else if (needsEmailConfirm) {
        setConfirmSent(true);
      } else {
        login(user);
        navigate("/dashboard");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (confirmSent) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <img src="/logo.png" alt="Axion EdTech" className="auth-logo" />
          <h1>Check your email</h1>
          <p className="auth-sub">We've sent a confirmation link to <strong>{form.email}</strong>.</p>
          <ol className="auth-steps">
            <li>Open the email from us — it can take a minute or two to arrive.</li>
            <li>Click the confirmation link. That activates your account.</li>
            <li>Then log in with the email and password you just chose.</li>
          </ol>
          <p className="auth-note">Can't find it? Look in your <strong>Spam</strong> or <strong>Promotions</strong> folder.</p>
          <ResendConfirmation email={form.email} />
          <Link to="/login" className="btn btn-primary" style={{ display: "block", textAlign: "center", marginTop: 16 }}>Go to login</Link>
          <p className="auth-switch">
            Wrong email address? <button type="button" className="btn-link" onClick={() => setConfirmSent(false)}>Go back and change it</button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <img src="/logo.png" alt="Axion EdTech" className="auth-logo" />
        <h1>Create your account</h1>
        <p className="auth-sub">Get access to notes, previous papers and full-length mock tests.</p>

        <form onSubmit={onSubmit} className="form">
          <label>
            Full name
            <input required value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Ananya Sharma" />
          </label>
          <label>
            Email
            <input type="email" required value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="you@example.com" />
          </label>
          <label>
            Password
            <input type="password" required minLength={8} value={form.password} onChange={(e) => update("password", e.target.value)} placeholder="At least 8 characters" />
          </label>
          <div className="form-note" role="note">
            <strong>Heads-up:</strong> after you register we'll email you a confirmation link. You need to click it before you can log in — so use an email address you can open right now.
          </div>
          {alreadyRegistered && (
            <div className="form-error">This email is already registered. <Link to="/login">Log in</Link> instead.</div>
          )}
          {error && <div className="form-error">{error}</div>}
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="auth-switch">
          Already registered? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
}
