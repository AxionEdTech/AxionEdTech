import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";

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

  if (error) return <div className="page"><div className="form-error">{error}</div></div>;
  if (!attempts) return <div className="page-loading">Loading your results…</div>;

  return (
    <div className="page">
      <h1>My Results</h1>
      {notice && <div className="form-error">{notice}</div>}
      {attempts.length === 0 && <p className="empty-state">You haven't attempted any mock tests yet.</p>}
      <div className="test-list">
        {attempts.map((a) => (
          <div key={a.id} className="test-card">
            <div>
              <h3>{a.title}</h3>
              <p className="test-card-meta">
                {a.subject} · {a.submitted_at ? `Submitted ${when(a.submitted_at)}` : "In progress"}
                {a.submitted_at && ` · Score ${a.score}/${a.max_score}`}
              </p>
            </div>
            <div className="test-card-actions">
              {a.submitted_at ? (
                <Link className="btn btn-ghost" to={`/tests/result/${a.id}`}>View result</Link>
              ) : (
                <Link className="btn btn-primary" to={`/tests/attempt/${a.test_id}`}>Resume</Link>
              )}
              <button type="button" className="btn btn-ghost" disabled={removing === a.id} onClick={() => remove(a)}>
                {removing === a.id ? "Removing…" : "Remove"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
