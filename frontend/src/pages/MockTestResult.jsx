import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api.js";
import { renderRich } from "../richContent.jsx";

export default function MockTestResult() {
  const { attemptId } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getAttempt(attemptId).then(setData).catch((e) => setError(e.message));
  }, [attemptId]);

  if (error) return <div className="page"><div className="form-error">{error}</div></div>;
  if (!data) return <div className="page-loading">Loading result…</div>;

  const { attempt, test, questions } = data;
  const pct = attempt.max_score ? Math.max(0, (attempt.score / attempt.max_score) * 100) : 0;

  return (
    <div className="page">
      <Link to="/tests" className="back-link">← Back to mock tests</Link>
      <h1>{test.title}</h1>

      <div className="result-summary">
        <div className="result-score">
          <span className="result-score-value">{attempt.score}</span>
          <span className="result-score-max">/ {attempt.max_score}</span>
        </div>
        <div className="result-bar"><div className="result-bar-fill" style={{ width: `${pct}%` }} /></div>
        <div className="result-stats">
          <div><strong>{attempt.correct_count}</strong><span>Correct</span></div>
          <div><strong>{attempt.wrong_count}</strong><span>Wrong</span></div>
          <div><strong>{attempt.unattempted_count}</strong><span>Unattempted</span></div>
        </div>
      </div>

      <h2 className="section-heading">Answer review</h2>
      <div className="pyq-list">
        {questions.map((q, i) => {
          const given = attempt.answers[q.id];
          const isCorrect = given === q.correct_option;
          return (
            <div key={q.id} className="pyq-card">
              <div className="pyq-meta">Question {i + 1} · Part {q.part}</div>
              <p className="pyq-question">{renderRich(q.question, `q${q.id}`)}</p>
              <ul className="pyq-options">
                {["A", "B", "C", "D"].map((opt) => {
                  const cls = opt === q.correct_option ? "correct" : (opt === given && !isCorrect ? "incorrect" : "");
                  return (
                    <li key={opt} className={cls}>
                      <strong>{opt}.</strong> {renderRich(q[`option_${opt.toLowerCase()}`], `q${q.id}o${opt}`)}
                      {opt === given && <em> — your answer</em>}
                    </li>
                  );
                })}
              </ul>
              {!given && <p className="pyq-explanation">Not attempted.</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
