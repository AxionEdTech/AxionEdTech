import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { EXAMS, EXAM_SECTIONS, FEATURED_EXAMS, examRank } from "../taxonomy.js";
import Icon from "../components/Icon.jsx";

// Every featured exam is always listed; any other exam appears as soon as
// it has information entered in Admin → Exam Info.
export default function ExamHub() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.listExamInfo().then((d) => setItems(d.items.filter((i) => i.is_active))).catch((e) => setError(e.message));
  }, []);

  const exams = useMemo(() => {
    const withContent = new Set((items || []).map((i) => i.exam));
    const names = [...new Set([...FEATURED_EXAMS, ...EXAMS.filter((e) => withContent.has(e)), ...withContent])];
    return names.sort((a, b) => examRank(a) - examRank(b));
  }, [items]);

  if (!items && !error) return <div className="page-loading">Loading exams…</div>;

  return (
    <div className="page page-wide">
      <p className="eyebrow">Information hub</p>
      <h1>Examinations</h1>
      {error && <div className="form-error">{error}</div>}
      <div className="grid grid-3">
        {exams.map((exam) => {
          const sections = new Set((items || []).filter((i) => i.exam === exam).map((i) => i.section));
          return (
            <Link key={exam} to={`/exams/${encodeURIComponent(exam)}`} className="card card-hover exam-card">
              <span className="card-icon lg"><Icon name="exam" size={24} /></span>
              <h3>{exam}</h3>
              {sections.size > 0 ? (
                <p className="paper-chips">
                  {EXAM_SECTIONS.filter((s) => sections.has(s.id) && s.id !== "overview").map((s) => <span key={s.id}>{s.label}</span>)}
                </p>
              ) : (
                <p className="card-meta">Information is being added.</p>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
