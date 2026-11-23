import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import usePlans from "../context/usePlans.jsx";
import { planName, PLAN_IDS, daysLeft, effectivePlan, formatPrice, planRank } from "../lib/plans.js";
import { summarizeAttempts, sparkPoints, attemptPercent } from "../lib/analytics.js";
import { getRecent } from "../lib/recent.js";
import NoticeBoard from "../components/NoticeBoard.jsx";
import Icon from "../components/Icon.jsx";

const RESOURCES = [
  { to: "/notes", icon: "notes", title: "Notes", need: "notes_mock", full: "All premium notes", part: "Free notes only" },
  { to: "/tests", icon: "mock", title: "Mock tests", need: "mock", full: "All mock tests", part: "Sample tests only" },
  { to: "/question-bank", icon: "bank", title: "Question bank", need: "notes_mock", full: "Core question sets", part: "Sample questions only" },
  { to: "/papers", icon: "papers", title: "Previous Year Papers", need: "free", full: "All papers", part: "All papers" },
];

export default function Dashboard() {
  const { user } = useAuth();
  const { plans } = usePlans();
  const [attempts, setAttempts] = useState(null);
  const [qb, setQb] = useState(null);
  const plan = effectivePlan(user);
  const left = daysLeft(user?.plan_expires_at);
  const recent = useMemo(() => getRecent(), []);

  useEffect(() => {
    api.myAttempts().then((d) => setAttempts(d.attempts)).catch(() => setAttempts([]));
    api.qbStats().then(setQb).catch(() => setQb({ attempted: 0, correct: 0, bookmarked: 0 }));
  }, []);

  const stats = useMemo(() => summarizeAttempts(attempts || []), [attempts]);
  const nextId = PLAN_IDS[planRank(plan) + 1];
  const nextPlan = nextId ? plans.find((p) => p.id === nextId) : null;
  const nextPrice = nextPlan ? [nextPlan.price_monthly, nextPlan.price_quarterly, nextPlan.price_half_yearly, nextPlan.price_yearly].find((v) => v != null) : null;
  const expiring = plan !== "free" && left !== null && left <= 7;
  const lapsed = plan === "free" && user?.plan !== "free" && user?.plan_expires_at && user.role !== "admin";
  const firstName = user?.name?.trim().split(/\s+/)[0] || "there";
  const recentAttempts = (attempts || []).filter((a) => a.submitted_at).slice(0, 5);

  return (
    <div className="page page-wide">
      <p className="eyebrow">Dashboard</p>
      <h1>Welcome back, {firstName}</h1>
      <p className="page-sub">{user?.email}</p>

      <div className="dash-top">
        <section className={`card sub-card plan-${plan}`} aria-label="Subscription">
          <p className="eyebrow">Your plan</p>
          <h2>{planName(plan)}{user?.role === "admin" && <em className="admin-tag">admin</em>}</h2>
          {plan === "free" ? (
            <p className="card-meta">{lapsed ? "Your previous plan has expired." : "Previous papers, exam information and sample practice."}</p>
          ) : user?.plan_expires_at ? (
            <p className={`card-meta${expiring ? " warn" : ""}`}>
              Active until {new Date(user.plan_expires_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
              {left !== null && ` · ${left} day${left === 1 ? "" : "s"} left`}
            </p>
          ) : <p className="card-meta">Active · no expiry date</p>}
          <div className="hero-actions">
            {plan !== "free" && user?.role !== "admin" && <Link className={`btn btn-sm ${expiring ? "btn-gold" : "btn-ghost"}`} to={`/subscribe?plan=${plan}`}>Renew</Link>}
            {nextPlan && user?.role !== "admin" && (
              <Link className="btn btn-gold btn-sm" to={`/subscribe?plan=${nextId}`}>
                {plan === "free" ? "Subscribe" : "Upgrade"} to {nextPlan.name}{nextPrice != null ? ` · from ${formatPrice(nextPrice)}` : ""}
              </Link>
            )}
            <Link className="btn btn-ghost btn-sm" to="/plans">Compare plans</Link>
          </div>
        </section>

        <section className="stat-grid" aria-label="Performance">
          <Stat label="Tests taken" value={stats.count} />
          <Stat label="Average score" value={stats.avgPct !== null ? `${stats.avgPct}%` : "—"} />
          <Stat label="Best score" value={stats.bestPct !== null ? `${stats.bestPct}%` : "—"} />
          <Stat label="Test accuracy" value={stats.accuracy !== null ? `${stats.accuracy}%` : "—"} />
          <Stat label="Questions practised" value={qb ? qb.attempted : "—"} />
          <Stat label="Practice accuracy" value={qb && qb.attempted ? `${Math.round((qb.correct / qb.attempted) * 100)}%` : "—"} />
        </section>
      </div>

      <section className="section" aria-label="Your resources">
        <div className="section-head"><div><p className="eyebrow">Your access</p><h2>What your plan opens</h2></div></div>
        <div className="grid grid-4">
          {RESOURCES.map((r) => {
            const full = planRank(plan) >= planRank(r.need);
            return (
              <Link key={r.to} to={r.to} className={`card card-hover res-card${full ? "" : " is-partial"}`}>
                <div className="card-top"><span className="card-icon"><Icon name={r.icon} size={20} /></span>{!full && <Icon name="lock" size={16} />}</div>
                <h3>{r.title}</h3>
                <p className="card-meta">{full ? r.full : r.part}</p>
              </Link>
            );
          })}
        </div>
      </section>

      <div className="dash-cols">
        <section className="card" aria-label="Recent test results">
          <div className="section-head tight"><h3>Recent results</h3><Link to="/results" className="section-link">All results <Icon name="arrow" size={16} /></Link></div>
          {!attempts && <p className="card-meta">Loading…</p>}
          {attempts && recentAttempts.length === 0 && <p className="empty-state">No tests taken yet. <Link to="/tests">Take your first mock test</Link>.</p>}
          {stats.series.length > 1 && (
            <svg className="spark" viewBox="0 0 160 44" role="img" aria-label="Score trend">
              <polyline points={sparkPoints(stats.series)} fill="none" stroke="#0057A8" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
            </svg>
          )}
          <ul className="mini-list">
            {recentAttempts.map((a) => (
              <li key={a.id}>
                <Link to={`/tests/result/${a.id}`}><span>{a.title}</span><strong>{Math.round(attemptPercent(a))}%</strong></Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="card" aria-label="Practice and saved">
          <h3>Practice</h3>
          <p className="card-meta">{qb ? `${qb.attempted} questions attempted` : "Loading…"}</p>
          <div className="hero-actions">
            <Link className="btn btn-navy btn-sm" to="/question-bank">Continue practising</Link>
            <Link className="btn btn-ghost btn-sm" to="/question-bank?view=bookmarks"><Icon name="bookmark" size={14} /> Saved ({qb ? qb.bookmarked : 0})</Link>
          </div>
          {recent.length > 0 && (
            <>
              <h3 className="mt-md">Recently viewed notes</h3>
              <ul className="mini-list">
                {recent.slice(0, 4).map((n) => <li key={n.id}><Link to={`/notes/${n.id}`}><span>{n.title}</span><em>{n.subject}</em></Link></li>)}
              </ul>
            </>
          )}
        </section>
      </div>

      <NoticeBoard limit={3} title="Latest updates" eyebrow="For you" />
    </div>
  );
}

function Stat({ label, value }) {
  return <div className="stat"><strong>{value}</strong><span>{label}</span></div>;
}
