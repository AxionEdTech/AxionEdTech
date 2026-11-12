import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { examRank } from "../taxonomy.js";
import { groupNotes } from "../noteOrdering.js";
import { useAuth } from "../AuthContext.jsx";
import { TierBadge } from "../components/Cards.jsx";
import Icon from "../components/Icon.jsx";

export default function Notes() {
  const [notes, setNotes] = useState(null);
  const [error, setError] = useState("");
  const [exam, setExam] = useState("");
  const [query, setQuery] = useState("");
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
    const q = query.trim().toLowerCase();
    return notes.filter((n) =>
      (!exam || (n.exam || "General") === exam)
      && (!q || `${n.title} ${n.unit} ${n.subject}`.toLowerCase().includes(q)));
  }, [notes, exam, query]);

  // Order is entirely driven by noteOrdering.js: an admin's manual arrangement
  // (position) wins where set, otherwise the syllabus order from taxonomy.js.
  const sections = useMemo(() => groupNotes(filtered, { splitByExam: !exam }), [filtered, exam]);

  if (error) return <div className="page"><div className="form-error">{error}</div></div>;
  if (!notes) return <div className="page-loading">Loading notes…</div>;

  return (
    <div className="page page-wide">
      <p className="eyebrow">Study materials</p>
      <h1>Study Notes</h1>

      <div className="toolbar">
        {exams.length > 1 && (
          <div className="exam-tabs">
            <button className={exam === "" ? "active" : ""} onClick={() => setExam("")}>All exams</button>
            {exams.map((ex) => <button key={ex} className={exam === ex ? "active" : ""} onClick={() => setExam(ex)}>{ex}</button>)}
          </div>
        )}
        <input className="search-input" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search notes" aria-label="Search notes" />
      </div>

      {sections.length === 0 && (
        <p className="empty-state">{query ? "No notes match your search." : user ? "No notes have been added yet." : "No notes are available yet."}</p>
      )}

      <div className="grid grid-3 topic-grid">
        {sections.map(({ key, items }) => (
          <section key={key} className="card topic-card">
            <h3>{key}</h3>
            <ol className="note-list">
              {items.map((n) => (
                <li key={n.id} className={n.has_access ? "" : "locked"}>
                  <Link to={`/notes/${n.id}`}>
                    {!n.has_access && <Icon name="lock" size={14} />}
                    <span>{n.title}</span>
                  </Link>
                  <TierBadge minPlan={n.min_plan} />
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}
