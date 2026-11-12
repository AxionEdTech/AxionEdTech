import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api.js";
import { examRank } from "../taxonomy.js";
import { PaperCard } from "../components/Cards.jsx";

export default function Papers() {
  const [papers, setPapers] = useState(null);
  const [error, setError] = useState("");
  const [params, setParams] = useSearchParams();
  const exam = params.get("exam") || "";
  const year = params.get("year") || "";

  useEffect(() => {
    api.listPapers().then((d) => setPapers(d.papers)).catch((e) => setError(e.message));
  }, []);

  const setFilter = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setParams(next, { replace: true });
  };

  const exams = useMemo(
    () => (papers ? [...new Set(papers.map((p) => p.exam))].sort((a, b) => examRank(a) - examRank(b)) : []),
    [papers]
  );
  const years = useMemo(
    () => (papers ? [...new Set(papers.filter((p) => !exam || p.exam === exam).map((p) => p.year))].sort((a, b) => b - a) : []),
    [papers, exam]
  );
  const shown = useMemo(
    () => (papers || []).filter((p) => (!exam || p.exam === exam) && (!year || String(p.year) === year)),
    [papers, exam, year]
  );

  // One block per exam, newest year first.
  const byExam = useMemo(() => {
    const map = new Map();
    for (const p of shown) {
      if (!map.has(p.exam)) map.set(p.exam, []);
      map.get(p.exam).push(p);
    }
    return [...map.entries()].sort((a, b) => examRank(a[0]) - examRank(b[0]));
  }, [shown]);

  if (!papers && !error) return <div className="page-loading">Loading papers…</div>;

  return (
    <div className="page page-wide">
      <p className="eyebrow">Always free</p>
      <h1>Previous Year Papers</h1>
      {error && <div className="form-error">{error}</div>}

      {papers && (
        <>
          <div className="toolbar">
            <div className="exam-tabs">
              <button className={exam === "" ? "active" : ""} onClick={() => { setFilter("exam", ""); setFilter("year", ""); }}>All exams</button>
              {exams.map((ex) => <button key={ex} className={exam === ex ? "active" : ""} onClick={() => { setFilter("exam", ex); setFilter("year", ""); }}>{ex}</button>)}
            </div>
            {years.length > 1 && (
              <select className="filter-select" value={year} onChange={(e) => setFilter("year", e.target.value)} aria-label="Filter by year">
                <option value="">All years</option>
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            )}
          </div>

          {byExam.length === 0 && <p className="empty-state">No papers have been added yet.</p>}
          {byExam.map(([name, list]) => (
            <section key={name} className="paper-block">
              {!exam && <h2>{name}</h2>}
              <div className="grid grid-4">{list.map((p) => <PaperCard key={p.id} p={p} />)}</div>
            </section>
          ))}

          <p className="alt-link"><Link to="/pyqs">Question-wise previous-year questions <span aria-hidden="true">→</span></Link></p>
        </>
      )}
    </div>
  );
}
