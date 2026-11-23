import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api } from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { EXAM_SECTIONS } from "../lib/taxonomy.js";
import RichContent from "../components/RichContent.jsx";
import Icon from "../components/Icon.jsx";

export default function ExamDetail() {
  const { exam: rawExam } = useParams();
  // The router already decodes the address; decoding again broke names with "%".
  const exam = rawExam;
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [params, setParams] = useSearchParams();
  const { user } = useAuth();

  useEffect(() => {
    setItems(null);
    api.listExamInfo().then((d) => setItems(d.items.filter((i) => i.exam === exam && (i.is_active || user?.role === "admin"))))
      .catch((e) => setError(e.message));
  }, [exam, user]);

  const available = useMemo(
    () => EXAM_SECTIONS.filter((s) => (items || []).some((i) => i.section === s.id)),
    [items]
  );
  const tab = available.some((s) => s.id === params.get("tab")) ? params.get("tab") : available[0]?.id;
  const entries = (items || []).filter((i) => i.section === tab);
  const enc = encodeURIComponent(exam);

  if (!items && !error) return <div className="page-loading">Loading {exam}…</div>;

  return (
    <div className="page page-wide">
      <Link to="/exams" className="back-link">← All exams</Link>
      <h1>{exam}</h1>

      <div className="quick-links">
        <Link to={`/papers?exam=${enc}`}><Icon name="papers" size={16} /> Previous Year Papers</Link>
        <Link to="/notes"><Icon name="notes" size={16} /> Notes</Link>
        <Link to="/tests"><Icon name="mock" size={16} /> Mock tests</Link>
        <Link to="/question-bank"><Icon name="bank" size={16} /> Question bank</Link>
      </div>

      {error && <div className="form-error">{error}</div>}

      {available.length === 0 ? (
        <div className="locked-card">
          <h2>Information for {exam} is being added</h2>
          <p className="page-sub">Previous papers and practice material are already available from the links above.</p>
          {user?.role === "admin" && <Link className="btn btn-gold" to="/admin">Add it in Admin → Exam Info</Link>}
        </div>
      ) : (
        <>
          <div className="exam-tabs section-tabs" role="tablist">
            {available.map((s) => (
              <button key={s.id} role="tab" aria-selected={tab === s.id} className={tab === s.id ? "active" : ""} onClick={() => setParams({ tab: s.id }, { replace: true })}>
                {s.label}
              </button>
            ))}
          </div>

          {tab === "syllabus" || tab === "faq" ? (
            <div className="acc-list">
              {entries.map((e, i) => (
                <details key={e.id} className="acc" open={i === 0 && tab === "syllabus"}>
                  <summary>{e.title}</summary>
                  <RichContent text={e.body} />
                </details>
              ))}
            </div>
          ) : (
            <div className="info-stack">
              {entries.map((e) => (
                <section key={e.id} className="card info-card">
                  <h2>{e.title}</h2>
                  <RichContent text={e.body} />
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
