import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api.js";
import { examRank, TEST_KINDS } from "../lib/taxonomy.js";
import { TestCard } from "../components/Cards.jsx";

export default function MockTestList() {
  const [tests, setTests] = useState(null);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(null);
  const [exam, setExam] = useState("");
  const [kind, setKind] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    api.listTests().then((d) => setTests(d.tests)).catch((e) => setError(e.message));
  }, []);

  const exams = useMemo(
    () => (tests ? [...new Set(tests.map((t) => t.exam || "General"))].sort((a, b) => examRank(a) - examRank(b)) : []),
    [tests]
  );
  const shown = useMemo(
    () => (tests || []).filter((t) => (!exam || (t.exam || "General") === exam) && (!kind || (t.kind || "full") === kind)),
    [tests, exam, kind]
  );

  async function start(testId) {
    setStarting(testId);
    try {
      // Starting here (rather than only on the exam page) means problems like
      // "requires a paid plan" show up on this list instead of on a blank exam page.
      await api.startTest(testId);
      // The exam page's route is /tests/attempt/:testId and takes a TEST id —
      // it re-opens this student's unfinished attempt by itself. Passing the
      // attempt id here looked up a different (or missing) test: "Test not found".
      navigate(`/tests/attempt/${testId}`);
    } catch (e) {
      setError(e.message);
      setStarting(null);
    }
  }

  if (!tests && !error) return <div className="page-loading">Loading mock tests…</div>;

  return (
    <div className="page page-wide">
      <p className="eyebrow">Practice under exam conditions</p>
      <h1>Mock Tests</h1>
      {error && <div className="form-error">{error}</div>}

      {tests && (
        <>
          <div className="toolbar">
            <div className="exam-tabs">
              <button className={kind === "" ? "active" : ""} onClick={() => setKind("")}>All tests</button>
              {TEST_KINDS.map((k) => <button key={k.id} className={kind === k.id ? "active" : ""} onClick={() => setKind(k.id)}>{k.label}</button>)}
            </div>
            {exams.length > 1 && (
              <select className="filter-select" value={exam} onChange={(e) => setExam(e.target.value)} aria-label="Filter by exam">
                <option value="">All exams</option>
                {exams.map((ex) => <option key={ex} value={ex}>{ex}</option>)}
              </select>
            )}
          </div>

          {shown.length === 0 && <p className="empty-state">No tests match these filters yet.</p>}
          <div className="grid grid-3">{shown.map((t) => <TestCard key={t.id} t={t} onStart={start} starting={starting} />)}</div>
        </>
      )}
    </div>
  );
}
