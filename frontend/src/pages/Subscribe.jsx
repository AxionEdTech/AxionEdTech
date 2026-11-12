import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../AuthContext.jsx";
import usePlans from "../usePlans.jsx";
import RichContent from "../richContent.jsx";
import { PERIODS, planName, activePeriods, effectivePlan, formatPrice, planRank } from "../plans.js";

const STATUS_LABEL = { pending: "Awaiting confirmation", approved: "Activated", rejected: "Not accepted" };

export default function Subscribe() {
  const { user } = useAuth();
  const { plans } = usePlans();
  const [params] = useSearchParams();
  const [settings, setSettings] = useState({});
  const [requests, setRequests] = useState([]);
  const [planId, setPlanId] = useState(["mock", "notes_mock", "complete"].includes(params.get("plan")) ? params.get("plan") : "notes_mock");
  const [periodId, setPeriodId] = useState(params.get("period") || "");
  const [ref, setRef] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" });

  const paid = plans.filter((p) => p.id !== "free");
  const periods = activePeriods(plans);
  const period = PERIODS.find((p) => p.id === periodId) || periods[0] || null;
  const plan = plans.find((p) => p.id === planId);
  const price = plan && period ? plan[period.column] : null;
  const current = effectivePlan(user);

  const loadRequests = () => api.mySubscriptionRequests().then((d) => setRequests(d.requests)).catch(() => {});
  useEffect(() => { api.getSettings().then(setSettings).catch(() => {}); loadRequests(); }, []);
  useEffect(() => { if (!periodId && periods[0]) setPeriodId(periods[0].id); }, [periods, periodId]);

  const hasPending = useMemo(() => requests.some((r) => r.status === "pending"), [requests]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setMsg({ type: "", text: "" });
    try {
      await api.createSubscriptionRequest({ plan: planId, period: period.id, amount: price, payment_ref: ref.trim() });
      setRef("");
      setMsg({ type: "ok", text: "Request received. Your plan is switched on as soon as the payment is confirmed." });
      loadRequests();
    } catch (err) {
      setMsg({ type: "err", text: err.message });
    } finally { setBusy(false); }
  }

  return (
    <div className="page">
      <p className="eyebrow">Subscribe</p>
      <h1>{current === "free" ? "Subscribe to a plan" : "Renew or upgrade"}</h1>

      {current !== "free" && (
        <p className="page-sub">
          You are on <strong>{planName(current)}</strong>
          {user.plan_expires_at ? ` until ${new Date(user.plan_expires_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}` : ""}.
        </p>
      )}

      <form className="form subscribe-form" onSubmit={submit}>
        <fieldset className="choice-group">
          <legend>Plan</legend>
          <div className="choice-row">
            {paid.map((p) => (
              <label key={p.id} className={`choice${planId === p.id ? " active" : ""}`}>
                <input type="radio" name="plan" checked={planId === p.id} onChange={() => setPlanId(p.id)} />
                <span>{p.name}</span>
                {planRank(current) >= planRank(p.id) && <em>{current === p.id ? "current" : "included"}</em>}
              </label>
            ))}
          </div>
        </fieldset>

        {periods.length > 0 ? (
          <fieldset className="choice-group">
            <legend>Period</legend>
            <div className="choice-row">
              {periods.map((p) => {
                const pr = plan ? plan[p.column] : null;
                return (
                  <label key={p.id} className={`choice${period?.id === p.id ? " active" : ""}`}>
                    <input type="radio" name="period" checked={period?.id === p.id} onChange={() => setPeriodId(p.id)} disabled={pr == null} />
                    <span>{p.label}</span>
                    <em>{pr != null ? formatPrice(pr) : "n/a"}</em>
                  </label>
                );
              })}
            </div>
          </fieldset>
        ) : (
          <p className="form-note">Prices have not been published yet. <Link to="/contact">Contact us</Link> to subscribe.</p>
        )}

        {price != null && (
          <div className="order-summary">
            <span>{plan.name} · {period.label}</span>
            <strong>{formatPrice(price)}</strong>
          </div>
        )}

        {settings.payment_instructions ? (
          <div className="pay-box">
            <h3>How to pay</h3>
            <RichContent text={settings.payment_instructions} />
          </div>
        ) : (
          <p className="form-note">Payment details have not been set up yet. Please <Link to="/contact">contact support</Link> to complete your subscription.</p>
        )}

        <label>Payment reference (UPI transaction ID or a note for us)
          <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="e.g. UPI ref 4231…" maxLength={200} />
        </label>

        {msg.text && <div className={msg.type === "ok" ? "form-success" : "form-error"}>{msg.text}</div>}
        <button className="btn btn-gold" disabled={busy || price == null || !settings.payment_instructions || planRank(current) > planRank(planId)}>
          {busy ? "Sending…" : "I have paid — send request"}
        </button>
        {planRank(current) > planRank(planId) && <p className="field-hint">Your current plan already includes this one.</p>}
        {hasPending && <p className="field-hint">You already have a request waiting for confirmation. Sending another is fine if it is for a different plan.</p>}
      </form>

      {requests.length > 0 && (
        <>
          <h2 className="mt-xl">Your requests</h2>
          <div className="req-list">
            {requests.map((r) => (
              <div key={r.id} className="req-row">
                <span><strong>{planName(r.plan)}</strong> · {PERIODS.find((p) => p.id === r.period)?.label}{r.amount != null ? ` · ${formatPrice(r.amount)}` : ""}</span>
                <span className={`status-pill status-${r.status}`}>{STATUS_LABEL[r.status]}</span>
                <span className="card-meta">{new Date(r.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
