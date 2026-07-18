import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";

export default function Notes() {
  const [notes, setNotes] = useState(null);
  const [error, setError] = useState("");
  const [exam, setExam] = useState("");

  useEffect(() => {
    api.listNotes().then((d) => setNotes(d.notes)).catch((e) => setError(e.message));
  }, []);

  const exams = useMemo(
    () => (notes ? [...new Set(notes.map((n) => n.exam || "General"))].sort() : []),
    [notes]
  );

  const filtered = useMemo(() => {
    if (!notes) return [];
    return exam ? notes.filter((n) => (n.exam || "General") === exam) : notes;
  }, [notes, exam]);

  if (error) return <div className="page"><div className="form-error">{error}</div></div>;
  if (!notes) return <div className="page-loading">Loading notes…</div>;

  // Group by topic (the "unit" field, e.g. "Quantum Mechanics") within the selected exam.
  // When viewing "All exams", each section header also shows which exam it belongs to.
  const grouped = filtered.reduce((acc, n) => {
    const key = exam
      ? (n.subject ? `${n.subject} — ${n.unit}` : n.unit)
      : `${n.exam || "General"} · ${n.subject ? n.subject + " — " : ""}${n.unit}`;
    (acc[key] ||= []).push(n);
    return acc;
  }, {});

  return (
    <div className="page">
      <h1>Study Notes</h1>
      <p className="page-sub">Notes open in the reader below — they can't be downloaded, only read here.</p>

      {exams.length > 1 && (
        <div className="exam-tabs">
          <button className={exam === "" ? "active" : ""} onClick={() => setExam("")}>All exams</button>
          {exams.map((ex) => (
            <button key={ex} className={exam === ex ? "active" : ""} onClick={() => setExam(ex)}>{ex}</button>
          ))}
        </div>
      )}

      {Object.keys(grouped).length === 0 && <p className="empty-state">No notes have been added yet.</p>}

      {Object.entries(grouped).map(([group, items]) => (
        <div key={group} className="note-group">
          <h3>{group}</h3>
          <ul className="note-list">
            {items.map((n) => (
              <li key={n.id}>
                <Link to={`/notes/${n.id}`}>{n.title}</Link>
                {n.is_premium && <span className="premium-badge">Paid</span>}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
