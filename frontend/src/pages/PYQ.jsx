import React, { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api.js";
import RichContent from "../richContent.jsx";
import { examRank, sessionRank } from "../taxonomy.js";
import { useAuth } from "../AuthContext.jsx";
import GuestBanner from "../components/GuestBanner.jsx";

const PAGE_SIZE = 10;

// Builds a compact page-number list around the current page, e.g.
// [1, "…", 4, 5, 6, "…", 20] — so the pagination bar stays short even
// when there are many pages, like a PDF viewer's page picker.
function pageWindow(current, total, delta = 2) {
  const pages = [1];
  const left = Math.max(2, current - delta);
  const right = Math.min(total - 1, current + delta);
  if (left > 2) pages.push("…");
  for (let i = left; i <= right; i++) pages.push(i);
  if (right < total - 1) pages.push("…");
  if (total > 1) pages.push(total);
  return pages;
}

export default function PYQ() {
  const [pyqs, setPyqs] = useState(null);
  const [error, setError] = useState("");
  const [exam, setExam] = useState("");
  const [year, setYear] = useState("");
  const [session, setSession] = useState("");
  const [part, setPart] = useState("");
  const [page, setPage] = useState(1);
  const paperRef = useRef(null);
  const { user } = useAuth();

  useEffect(() => {
    api.listPYQs().then((d) => setPyqs(d.pyqs)).catch((e) => setError(e.message));
  }, []);

  // Jumping to a new page (via a number, or Previous/Next) scrolls back to
  // the top of the sheet — like turning to the next page of a PDF instead
  // of leaving you scrolled halfway down the old one. Skipped on first
  // mount so opening the page doesn't yank the viewport down.
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return; }
    paperRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [page]);

  const exams = useMemo(
    () => (pyqs ? [...new Set(pyqs.map((q) => q.exam || "General"))].sort((a, b) => examRank(a) - examRank(b)) : []),
    [pyqs]
  );

  // One continuous, sorted list — this is what gets sliced into 10-question
  // "pages" below, so page 1 is always questions 1-10 in the same stable order.
  const filtered = useMemo(() => {
    if (!pyqs) return [];
    return pyqs
      .filter((q) =>
        (!exam || (q.exam || "General") === exam) &&
        (!year || String(q.year) === String(year)) &&
        (!session || (q.session || "") === session) &&
        (!part || q.part === part)
      )
      .sort((a, b) =>
        examRank(a.exam) - examRank(b.exam) ||
        b.year - a.year ||
        sessionRank(a.session) - sessionRank(b.session) ||
        a.part.localeCompare(b.part) ||
        a.id - b.id
      );
  }, [pyqs, exam, year, session, part]);

  const years = useMemo(
    () => [...new Set((pyqs || []).filter((q) => !exam || (q.exam || "General") === exam).map((q) => q.year))].sort((a, b) => b - a),
    [pyqs, exam]
  );

  // Only offered once at least one question actually carries a session label
  // (e.g. CSIR NET's June/December sittings) — stays out of the way for
  // exams that run once a year.
  const sessions = useMemo(
    () => [...new Set((pyqs || [])
      .filter((q) => (!exam || (q.exam || "General") === exam) && (!year || String(q.year) === String(year)))
      .map((q) => q.session)
      .filter(Boolean))].sort((a, b) => sessionRank(a) - sessionRank(b)),
    [pyqs, exam, year]
  );

  // Jump back to page 1 whenever a filter changes, so you're never stranded
  // on a page number that no longer has any questions on it.
  useEffect(() => { setPage(1); }, [exam, year, session, part]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const firstNum = filtered.length ? (page - 1) * PAGE_SIZE + 1 : 0;
  const lastNum = Math.min(page * PAGE_SIZE, filtered.length);

  if (error) return <div className="page"><div className="form-error">{error}</div></div>;
  if (!pyqs) return <div className="page-loading">Loading questions…</div>;

  function Pagination() {
    if (totalPages <= 1) return null;
    return (
      <div className="pyq-pagination">
        <button className="btn btn-ghost btn-sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
          ← Previous
        </button>
        <div className="pyq-pagination-numbers">
          {pageWindow(page, totalPages).map((n, i) =>
            n === "…" ? (
              <span key={`gap-${i}`} className="pyq-page-ellipsis">…</span>
            ) : (
              <button
                key={n}
                type="button"
                className={`pyq-page-btn${n === page ? " active" : ""}`}
                aria-current={n === page ? "page" : undefined}
                onClick={() => setPage(n)}
              >
                {n}
              </button>
            )
          )}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
          Next →
        </button>
      </div>
    );
  }

  return (
    <div className="page">
      <h1>Previous Year Papers</h1>
      <p className="page-sub">Read straight through — question, options, and answer are all shown together.</p>

      {!user && <GuestBanner />}

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
        {sessions.length > 0 && (
          <select value={session} onChange={(e) => setSession(e.target.value)}>
            <option value="">All sessions</option>
            {sessions.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
        <select value={part} onChange={(e) => setPart(e.target.value)}>
          <option value="">All parts</option>
          <option value="A">Part A</option>
          <option value="B">Part B</option>
          <option value="C">Part C</option>
        </select>
      </div>

      {filtered.length === 0 && (
        <p className="empty-state">
          {user ? "No questions match this filter yet." : "No free-preview questions match this filter — log in for full access."}
        </p>
      )}

      {filtered.length > 0 && (
        <>
          <p className="pyq-range">Showing questions {firstNum}–{lastNum} of {filtered.length}</p>

          <div className="pyq-paper" ref={paperRef}>
            <div className="pyq-page-marker">Page {page} of {totalPages}</div>
            {pageItems.map((q, i) => {
              const num = firstNum + i;
              return (
                <div key={q.id} className="pyq-entry">
                  <div className="pyq-entry-head">
                    <span className="pyq-num">{num}.</span>
                    <span className="pyq-meta">
                      {q.exam || "General"} {q.year}{q.session ? ` (${q.session})` : ""} · Part {q.part}
                    </span>
                  </div>
                  <div className="pyq-question"><RichContent text={q.content} /></div>
                </div>
              );
            })}
          </div>

          <Pagination />
        </>
      )}
    </div>
  );
}
