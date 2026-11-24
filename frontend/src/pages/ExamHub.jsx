import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import { EXAM_SECTIONS } from "../lib/taxonomy.js";
import useExams from "../context/useExams.jsx";
import Icon from "../components/Icon.jsx";

// One card per exam in the list edited at Admin → Exam Info → "Exams on the
// website". A card shows the exam's short description and which information
// sections (pattern, syllabus, …) have been filled in.
export default function ExamHub() {
  const { exams, loaded } = useExams();
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.listExamInfo().then((d) => setItems(d.items.filter((i) => i.is_active))).catch((e) => { setError(e.message); setItems([]); });
  }, []);

  if (!items || !loaded) return <div className="page-loading">Loading exams…</div>;

  return (
    <div className="page page-wide">
      <p className="eyebrow">Information hub</p>
      <h1>Examinations</h1>
      {error && <div className="form-error">{error}</div>}
      {exams.length === 0 && <p className="empty-state">No exams listed yet.</p>}
      <div className="grid grid-3">
        {exams.map((exam) => {
          const sections = new Set(items.filter((i) => i.exam === exam.name).map((i) => i.section));
          const chips = EXAM_SECTIONS.filter((s) => sections.has(s.id) && s.id !== "overview");
          return (
            <Link key={exam.name} to={`/exams/${encodeURIComponent(exam.name)}`} className="card card-hover exam-card">
              <span className="card-icon lg"><Icon name="exam" size={24} /></span>
              <h3>{exam.name}</h3>
              {exam.blurb && <p className="card-meta">{exam.blurb}</p>}
              {chips.length > 0 && <p className="paper-chips">{chips.map((s) => <span key={s.id}>{s.label}</span>)}</p>}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
