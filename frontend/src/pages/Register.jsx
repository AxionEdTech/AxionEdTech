import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../AuthContext.jsx";

export default function Register() {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const { user, needsEmailConfirm } = await api.register(form);
      if (needsEmailConfirm) {
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
          <div className="auth-mark">Axion EdTech</div>
          <h1>Check your email</h1>
          <p className="auth-sub">We've sent a confirmation link to {form.email}. Click it, then come back and log in.</p>
          <Link to="/login" className="btn btn-primary" style={{ display: "inline-block", textAlign: "center" }}>Go to login</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-mark">Axion EdTech</div>
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
