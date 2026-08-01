import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";

export default function MyResults() {
  const [attempts, setAttempts] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.myAttempts().then((d) => setAttempts(d.attempts)).catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="page"><div className="form-error">{error}</div></div>;
  if (!attempts) return <div className="page-loading">Loading your results…</div>;

  return (
    <div className="page">
      <h1>My Results</h1>
      {attempts.length === 0 && <p className="empty-state">You haven't attempted any mock tests yet.</p>}
      <div className="test-list">
        {attempts.map((a) => (
          <div key={a.id} className="test-card">
            <div>
              <h3>{a.title}</h3>
              <p className="test-card-meta">
                {a.subject} · {a.submitted_at ? `Submitted ${a.submitted_at}` : "In progress"}
                {a.submitted_at && ` · Score ${a.score}/${a.max_score}`}
              </p>
            </div>
            {a.submitted_at ? (
              <Link className="btn btn-ghost" to={`/tests/result/${a.id}`}>View result</Link>
            ) : (
              <Link className="btn btn-primary" to={`/tests/attempt/${a.test_id}`}>Resume</Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
