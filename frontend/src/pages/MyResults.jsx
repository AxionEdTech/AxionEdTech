import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import { attemptPercent, sparkPoints, summarizeAttempts } from "../lib/analytics.js";
import Icon from "../components/Icon.jsx";

const when = (iso) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

export default function MyResults() {
  const [attempts, setAttempts] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [removing, setRemoving] = useState(null);

  async function remove(a) {
    const what = a.submitted_at ? "this result" : "this unfinished attempt";
    if (!window.confirm(`Remove ${what} for "${a.title}" from your results? This can't be undone.`)) return;
    setRemoving(a.id);
    setNotice("");
    try {
      await api.deleteAttempt(a.id);
      setAttempts((list) => list.filter((x) => x.id !== a.id));
    } catch (err) {
      setNotice(err.message);
    } finally {
      setRemoving(null);
    }
  }

  useEffect(() => {
    api.myAttempts().then((d) => setAttempts(d.attempts)).catch((e) => setError(e.message));
  }, []);

  const stats = useMemo(() => summarizeAttempts(attempts || []), [attempts]);

  if (error) return <div className="page"><div className="form-error">{error}</div></div>;
  if (!attempts) return <div className="page-loading">Loading your results…</div>;

  return (
    <div className="page page-wide">
      <p className="eyebrow">Performance</p>
      <h1>My Results</h1>
      {notice && <div className="form-error">{notice}</div>}

      {attempts.length === 0 ? (
        <p className="empty-state">You haven't attempted any mock tests yet. <Link to="/tests">Browse mock tests</Link>.</p>
      ) : (
        <>
          <section className="stat-grid stat-grid-4" aria-label="Summary">
            <div className="stat"><strong>{stats.count}</strong><span>Tests taken</span></div>
            <div className="stat"><strong>{stats.avgPct !== null ? `${stats.avgPct}%` : "—"}</strong><span>Average score</span></div>
            <div className="stat"><strong>{stats.bestPct !== null ? `${stats.bestPct}%` : "—"}</strong><span>Best score</span></div>
            <div className="stat"><strong>{stats.accuracy !== null ? `${stats.accuracy}%` : "—"}</strong><span>Accuracy</span></div>
          </section>

          {stats.series.length > 1 && (
            <section className="card trend-card" aria-label="Score history">
              <h3>Score history</h3>
              <svg className="spark wide" viewBox="0 0 160 44" preserveAspectRatio="none" role="img" aria-label="Score trend over your attempts">
                <polyline points={sparkPoints(stats.series)} fill="none" stroke="#0057A8" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              </svg>
            </section>
          )}

          <div className="grid grid-3 mt-md">
            {attempts.map((a) => (
              <article key={a.id} className="card">
                <div className="card-top">
                  <span className="card-icon"><Icon name="chart" size={20} /></span>
                  {a.submitted_at ? <strong className="big-pct">{Math.round(attemptPercent(a))}%</strong> : <span className="tier-badge tier-info">In progress</span>}
                </div>
                <h3>{a.title}</h3>
                <p className="card-meta">{a.subject} · {a.submitted_at ? `Submitted ${when(a.submitted_at)}` : "In progress"}</p>
                {a.submitted_at && (
                  <p className="card-meta">
                    {a.score}/{a.max_score} · {a.correct_count} correct · {a.wrong_count} wrong · {a.unattempted_count} skipped
                  </p>
                )}
                <div className="card-action result-actions">
                  {a.submitted_at
                    ? <Link className="btn btn-ghost" to={`/tests/result/${a.id}`}>View result</Link>
                    : <Link className="btn btn-navy" to={`/tests/attempt/${a.test_id}`}>Resume</Link>}
                  <button type="button" className="btn btn-ghost" disabled={removing === a.id} onClick={() => remove(a)}>
                    {removing === a.id ? "Removing…" : "Remove"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
