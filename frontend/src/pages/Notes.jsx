import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { examRank } from "../taxonomy.js";
import { groupNotes } from "../noteOrdering.js";
import { useAuth } from "../AuthContext.jsx";
import GuestBanner from "../components/GuestBanner.jsx";

export default function Notes() {
  const [notes, setNotes] = useState(null);
  const [error, setError] = useState("");
  const [exam, setExam] = useState("");
  const { user } = useAuth();

  useEffect(() => {
    api.listNotes().then((d) => setNotes(d.notes)).catch((e) => setError(e.message));
  }, []);

  const exams = useMemo(
    () => (notes ? [...new Set(notes.map((n) => n.exam || "General"))].sort((a, b) => examRank(a) - examRank(b)) : []),
    [notes]
  );

  const filtered = useMemo(() => {
    if (!notes) return [];
    return exam ? notes.filter((n) => (n.exam || "General") === exam) : notes;
  }, [notes, exam]);

  // Order is entirely driven by noteOrdering.js: an admin's manual arrangement
  // (position) wins where set, otherwise the syllabus order from taxonomy.js.
  const sections = useMemo(() => groupNotes(filtered, { splitByExam: !exam }), [filtered, exam]);

  if (error) return <div className="page"><div className="form-error">{error}</div></div>;
  if (!notes) return <div className="page-loading">Loading notes…</div>;

  return (
    <div className="page">
      <h1>Study Notes</h1>
      <p className="page-sub">Notes open in the reader below — they can't be downloaded, only read here.</p>

      {!user && <GuestBanner />}

      {exams.length > 1 && (
        <div className="exam-tabs">
          <button className={exam === "" ? "active" : ""} onClick={() => setExam("")}>All exams</button>
          {exams.map((ex) => (
            <button key={ex} className={exam === ex ? "active" : ""} onClick={() => setExam(ex)}>{ex}</button>
          ))}
        </div>
      )}

      {sections.length === 0 && (
        <p className="empty-state">
          {user ? "No notes have been added yet." : "No free-preview notes are available yet — log in for full access."}
        </p>
      )}

      {sections.map(({ key, items }) => (
        <div key={key} className="note-group">
          <h3>{key}</h3>
          <ol className="note-list">
            {items.map((n) => (
              <li key={n.id}>
                <Link to={`/notes/${n.id}`}>{n.title}</Link>
                {n.is_premium && <span className="premium-badge">Paid</span>}
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}
