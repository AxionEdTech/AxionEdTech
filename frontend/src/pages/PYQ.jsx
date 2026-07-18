import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import { renderRich } from "../richContent.jsx";

export default function PYQ() {
  const [pyqs, setPyqs] = useState(null);
  const [error, setError] = useState("");
  const [exam, setExam] = useState("");
  const [year, setYear] = useState("");
  const [part, setPart] = useState("");
  const [revealed, setRevealed] = useState({});

  useEffect(() => {
    api.listPYQs().then((d) => setPyqs(d.pyqs)).catch((e) => setError(e.message));
  }, []);

  const exams = useMemo(
    () => (pyqs ? [...new Set(pyqs.map((q) => q.exam || "General"))].sort() : []),
    [pyqs]
  );

  const filtered = useMemo(() => {
    if (!pyqs) return [];
    return pyqs.filter((q) =>
      (!exam || (q.exam || "General") === exam) &&
      (!year || String(q.year) === String(year)) &&
      (!part || q.part === part)
    );
  }, [pyqs, exam, year, part]);

  const years = useMemo(
    () => [...new Set((pyqs || []).filter((q) => !exam || (q.exam || "General") === exam).map((q) => q.year))].sort((a, b) => b - a),
    [pyqs, exam]
  );

  if (error) return <div className="page"><div className="form-error">{error}</div></div>;
  if (!pyqs) return <div className="page-loading">Loading questions…</div>;

  // Group the filtered results by exam so multiple exams display as separate sections.
  const grouped = filtered.reduce((acc, q) => {
    const key = q.exam || "General";
    (acc[key] ||= []).push(q);
    return acc;
  }, {});

  return (
    <div className="page">
      <h1>Previous Year Papers</h1>
      <p className="page-sub">Attempt each question, then reveal the answer and explanation.</p>

      {exams.length > 1 && (
        <div className="exam-tabs">
          <button className={exam === "" ? "active" : ""} onClick={() => setExam("")}>All exams</button>
          {exams.map((ex) => (
            <button key={ex} className={exam === ex ? "active" : ""} onClick={() => setExam(ex)}>{ex}</button>
          ))}
        </div>
      )}

      <div className="filters">
        <select value={year} onChange={(e) => setYear(e.target.value)}>
          <option value="">All years</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={part} onChange={(e) => setPart(e.target.value)}>
          <option value="">All parts</option>
          <option value="A">Part A</option>
          <option value="B">Part B</option>
          <option value="C">Part C</option>
        </select>
      </div>

      {filtered.length === 0 && <p className="empty-state">No questions match this filter yet.</p>}

      {Object.entries(grouped).map(([examName, questions]) => (
        <div key={examName} className="pyq-exam-group">
          {exams.length > 1 && exam === "" && <h2 className="section-heading">{examName}</h2>}
          <div className="pyq-list">
            {questions.map((q) => (
              <div key={q.id} className="pyq-card">
                <div className="pyq-meta">{q.exam || "General"} {q.year} · Part {q.part}</div>
                <p className="pyq-question">{renderRich(q.question, `q${q.id}`)}</p>
                <ul className="pyq-options">
                  {["A", "B", "C", "D"].map((opt) => (
                    <li key={opt} className={revealed[q.id] && opt === q.correct_option ? "correct" : ""}>
                      <strong>{opt}.</strong> {renderRich(q[`option_${opt.toLowerCase()}`], `q${q.id}o${opt}`)}
                    </li>
                  ))}
                </ul>
                {revealed[q.id] ? (
                  q.explanation && <p className="pyq-explanation">{renderRich(q.explanation, `q${q.id}e`)}</p>
                ) : (
                  <button className="btn btn-ghost btn-sm" onClick={() => setRevealed((r) => ({ ...r, [q.id]: true }))}>
                    Show answer
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
