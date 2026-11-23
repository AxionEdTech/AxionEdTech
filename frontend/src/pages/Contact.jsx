import React, { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import Icon from "../components/Icon.jsx";
import { safeUrl } from "../lib/links.js";

const KINDS = [
  { id: "query", label: "Question" },
  { id: "feedback", label: "Feedback or suggestion" },
  { id: "technical", label: "Technical problem" },
];

export default function Contact() {
  const { user } = useAuth();
  const [settings, setSettings] = useState({});
  const [form, setForm] = useState({ name: "", email: "", kind: "query", message: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" });
  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => { api.getSettings().then(setSettings).catch(() => {}); }, []);
  useEffect(() => {
    if (user) setForm((f) => ({ ...f, name: f.name || user.name || "", email: f.email || user.email || "" }));
  }, [user]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setMsg({ type: "", text: "" });
    try {
      await api.createSupportMessage(form);
      setForm((f) => ({ ...f, message: "" }));
      setMsg({ type: "ok", text: "Thanks — your message has been sent." });
    } catch (err) {
      setMsg({ type: "err", text: err.message });
    } finally { setBusy(false); }
  }

  const channels = [
    settings.support_email && { icon: "mail", label: "Email", value: settings.support_email, href: `mailto:${settings.support_email}` },
    safeUrl(settings.whatsapp_url) && { icon: "help", label: "WhatsApp", value: "Message us", href: safeUrl(settings.whatsapp_url) },
    safeUrl(settings.telegram_url) && { icon: "help", label: "Telegram", value: "Join the channel", href: safeUrl(settings.telegram_url) },
    settings.support_phone && { icon: "clock", label: "Phone", value: settings.support_phone, href: `tel:${settings.support_phone}` },
  ].filter(Boolean);

  return (
    <div className="page">
      <p className="eyebrow">Support</p>
      <h1>Contact us</h1>

      {channels.length > 0 && (
        <div className="grid grid-2 contact-channels">
          {channels.map((c) => (
            <a key={c.label} className="card card-hover channel" href={c.href} target={c.href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer">
              <span className="card-icon"><Icon name={c.icon} size={20} /></span>
              <div><strong>{c.label}</strong><p className="card-meta">{c.value}</p></div>
            </a>
          ))}
        </div>
      )}

      <form className="form" onSubmit={submit}>
        <div className="form-row">
          <label>Your name<input required maxLength={120} value={form.name} onChange={(e) => update("name", e.target.value)} /></label>
          <label>Email<input required type="email" maxLength={200} value={form.email} onChange={(e) => update("email", e.target.value)} /></label>
        </div>
        <label>What is this about?
          <select value={form.kind} onChange={(e) => update("kind", e.target.value)}>
            {KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
          </select>
        </label>
        <label>Message<textarea required rows={6} minLength={5} maxLength={4000} value={form.message} onChange={(e) => update("message", e.target.value)} /></label>
        {msg.text && <div className={msg.type === "ok" ? "form-success" : "form-error"}>{msg.text}</div>}
        <button className="btn btn-gold" disabled={busy}>{busy ? "Sending…" : "Send message"}</button>
      </form>
    </div>
  );
}
