import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { planBadge } from "../lib/plans.js";
import { usePlanNames } from "../context/usePlans.jsx";
import { TEST_KINDS } from "../lib/taxonomy.js";
import { attemptPercent } from "../lib/analytics.js";
import Icon from "./Icon.jsx";

// Plan badge shown on notes, tests and questions: "Free", "Mock Test", ...
export function TierBadge({ minPlan }) {
  usePlanNames(); // re-render if the plan is renamed
  return <span className={`tier-badge tier-${minPlan || "free"}`}>{planBadge(minPlan)}</span>;
}

export function kindLabel(kind) {
  return TEST_KINDS.find((k) => k.id === kind)?.label || "Full-length";
}

// A mock test. With onStart it is a working card (used on the Mock Tests
// page); without it, the whole card links there (used on the Home page).
// `mine` is this student's history with the test:
//   { result: their latest submitted attempt or null, inProgress: true/false }
// so a finished test shows "View result" and "Reset" instead of "Start test".
export function TestCard({ t, onStart, starting, mine }) {
  const { user } = useAuth();
  const location = useLocation();
  usePlanNames();
  const locked = !t.has_access && !!user;
  const body = (
    <>
      <div className="card-top">
        <span className="card-icon"><Icon name="mock" size={20} /></span>
        <TierBadge minPlan={t.min_plan} />
      </div>
      <h3>{t.title}</h3>
      <p className="card-meta">{t.exam ? `${t.exam} · ` : ""}{t.subject}</p>
      <p className="card-meta"><Icon name="clock" size={14} /> {t.duration_minutes} min · {t.question_count} questions · {kindLabel(t.kind)}</p>
    </>
  );

  if (!onStart) return <Link to="/tests" className="card card-hover">{body}</Link>;

  let action;
  if (!user) action = <Link className="btn btn-navy btn-block" to="/login" state={{ from: location.pathname + location.search }}>Log in to start</Link>;
  else if (locked) action = <Link className="btn btn-gold btn-block" to={`/subscribe?plan=${t.min_plan}`}><Icon name="lock" size={15} /> Unlock with {planBadge(t.min_plan)}</Link>;
  else if (mine?.inProgress) action = <button className="btn btn-gold btn-block" onClick={() => onStart(t.id)} disabled={starting === t.id}>{starting === t.id ? "Opening…" : "Resume test"}</button>;
  else if (mine?.result) {
    const r = mine.result;
    const reset = () => {
      if (window.confirm(`Reset "${t.title}" and take it again from the beginning?\n\nYour earlier result stays in My Results.`)) onStart(t.id);
    };
    action = (
      <>
        <p className="test-last-score">
          <Icon name="check" size={14} /> Submitted · {fmtScore(r.score)}/{fmtScore(r.max_score)} ({Math.round(attemptPercent(r))}%)
        </p>
        <div className="card-action-row">
          <Link className="btn btn-navy" to={`/tests/result/${r.id}`}>View result</Link>
          <button className="btn btn-ghost" onClick={reset} disabled={starting === t.id}>{starting === t.id ? "Starting…" : "Reset"}</button>
        </div>
      </>
    );
  }
  else action = <button className="btn btn-navy btn-block" onClick={() => onStart(t.id)} disabled={starting === t.id}>{starting === t.id ? "Starting…" : "Start test"}</button>;

  return <article className={`card${locked ? " is-locked" : ""}${mine?.result && !mine.inProgress ? " is-done" : ""}`}>{body}<div className="card-action">{action}</div></article>;
}

function fmtScore(v) {
  const n = Number(v) || 0;
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

export function NoteCard({ n }) {
  return (
    <Link to={`/notes/${n.id}`} className={`card card-hover${n.has_access ? "" : " is-locked"}`}>
      <div className="card-top">
        <span className="card-icon"><Icon name={n.has_access ? "notes" : "lock"} size={20} /></span>
        <TierBadge minPlan={n.min_plan} />
      </div>
      <h3>{n.title}</h3>
      <p className="card-meta">{n.exam} · {n.subject}</p>
      <p className="card-meta">{n.unit}</p>
    </Link>
  );
}

export function PaperCard({ p }) {
  return (
    <Link to={`/papers/${p.id}`} className="card card-hover paper-card">
      <div className="card-top">
        <span className="card-icon"><Icon name="papers" size={20} /></span>
        <span className="tier-badge tier-free">Free</span>
      </div>
      <h3>{p.exam} {p.year}{p.session ? ` · ${p.session}` : ""}</h3>
      <p className="card-meta">{p.title || p.subject}</p>
      <p className="paper-chips">
        <span>Question paper</span>
        {p.key_url && <span>Answer key</span>}
      </p>
    </Link>
  );
}
