import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../AuthContext.jsx";
import GuestBanner from "../components/GuestBanner.jsx";

export default function MockTestList() {
  const [tests, setTests] = useState(null);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    api.listTests().then((d) => setTests(d.tests)).catch((e) => setError(e.message));
  }, []);

  async function start(testId) {
    setStarting(testId);
    try {
      const { attempt } = await api.startTest(testId);
      navigate(`/tests/attempt/${attempt.id}`);
    } catch (e) {
      setError(e.message);
      setStarting(null);
    }
  }

  if (error) return <div className="page"><div className="form-error">{error}</div></div>;
  if (!tests) return <div className="page-loading">Loading mock tests…</div>;

  return (
    <div className="page">
      <h1>Mock Tests</h1>
      <p className="page-sub">Full-length tests, timed and scored in a real competitive-exam interface.</p>

      {!user && <GuestBanner />}

      {tests.length === 0 && (
        <p className="empty-state">
          {user ? "No mock tests are available yet." : "No tests are shown to visitors yet — log in for the full catalog."}
        </p>
      )}

      <div className="test-list">
        {tests.map((t) => (
          <div key={t.id} className="test-card">
            <div>
              <h3>{t.title} {t.is_premium && <span className="premium-badge">Paid</span>}</h3>
              <p className="test-card-meta">{t.exam ? `${t.exam} · ` : ""}{t.subject} · {t.question_count} questions · {t.duration_minutes} minutes</p>
            </div>
            {user ? (
              <button className="btn btn-primary" onClick={() => start(t.id)} disabled={starting === t.id}>
                {starting === t.id ? "Starting…" : "Start test"}
              </button>
            ) : (
              <Link className="btn btn-primary" to="/login">Log in to start</Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
