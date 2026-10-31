import React, { useEffect, useState } from "react";
import { api } from "../api.js";

// "Resend confirmation email" with a short wait between sends (so nobody hits
// the email provider's rate limit by clicking repeatedly) and a clear result.
export default function ResendConfirmation({ email, cooldownSeconds = 60, startCooling = true }) {
  const [left, setLeft] = useState(startCooling ? cooldownSeconds : 0);
  const [status, setStatus] = useState({ type: "", text: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (left <= 0) return undefined;
    const t = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  async function resend() {
    setBusy(true);
    setStatus({ type: "", text: "" });
    try {
      await api.resendConfirmation(email);
      setStatus({ type: "ok", text: `Sent again to ${email}. It can take a minute or two to arrive — check Spam too.` });
      setLeft(cooldownSeconds);
    } catch (err) {
      setStatus({ type: "error", text: err.message });
      if (err.code === "rate_limited") setLeft(cooldownSeconds);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="resend-confirm">
      <button type="button" className="btn btn-ghost" disabled={busy || left > 0 || !email} onClick={resend}>
        {left > 0 ? `Resend email in ${left}s` : busy ? "Sending…" : "Resend confirmation email"}
      </button>
      {status.text && (
        <p className={status.type === "ok" ? "resend-ok" : "form-error"} role="status">{status.text}</p>
      )}
    </div>
  );
}
