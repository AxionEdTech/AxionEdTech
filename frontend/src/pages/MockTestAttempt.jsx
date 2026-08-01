import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api.js";
import { renderRich } from "../richContent.jsx";

const PARTS = ["A", "B", "C"];

export default function MockTestAttempt() {
  const { testId } = useParams();
  const navigate = useNavigate();

  const [test, setTest] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [attemptId, setAttemptId] = useState(null);
  const [answers, setAnswers] = useState({});
  const [marked, setMarked] = useState(new Set());
  const [visited, setVisited] = useState(new Set());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activePart, setActivePart] = useState("A");
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [error, setError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittedRef = useRef(false);

  useEffect(() => {
    api.startTest(testId).then(({ attempt, test, questions }) => {
      setAttemptId(attempt.id);
      setTest(test);
      setQuestions(questions);
      setAnswers(attempt.answers || {});
      setMarked(new Set((attempt.marked || []).map(Number)));
      // Supabase returns started_at as a full ISO 8601 timestamp already, unlike the old SQLite format.
      const elapsedSec = Math.floor((Date.now() - new Date(attempt.started_at).getTime()) / 1000);
      const totalSec = test.duration_minutes * 60;
      setSecondsLeft(Math.max(totalSec - elapsedSec, 0));
      if (questions.length) setActivePart(questions[0].part);
    }).catch((e) => setError(e.message));
  }, [testId]);

  // Timer
  useEffect(() => {
    if (secondsLeft === null) return;
    if (secondsLeft <= 0) {
      if (!submittedRef.current) doSubmit(true);
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft]);

  const partQuestions = useMemo(
    () => questions.filter((q) => q.part === activePart),
    [questions, activePart]
  );
  const current = partQuestions[currentIndex];

  useEffect(() => {
    if (current) setVisited((v) => new Set(v).add(current.id));
  }, [current]);

  function timeString() {
    if (secondsLeft === null) return "--:--:--";
    const h = String(Math.floor(secondsLeft / 3600)).padStart(2, "0");
    const m = String(Math.floor((secondsLeft % 3600) / 60)).padStart(2, "0");
    const s = String(secondsLeft % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
  }

  function statusOf(q) {
    const isAnswered = !!answers[q.id];
    const isMarked = marked.has(q.id);
    if (isMarked && isAnswered) return "marked-answered";
    if (isMarked) return "marked";
    if (isAnswered) return "answered";
    if (visited.has(q.id)) return "visited";
    return "not-visited";
  }

  async function selectOption(opt) {
    setAnswers((a) => ({ ...a, [current.id]: opt }));
    try { await api.saveAnswer(attemptId, current.id, opt); } catch { /* best-effort autosave */ }
  }

  async function clearResponse() {
    setAnswers((a) => { const n = { ...a }; delete n[current.id]; return n; });
    try { await api.saveAnswer(attemptId, current.id, null); } catch { /* best-effort */ }
  }

  async function toggleMarkCurrent(goNext) {
    const newMarked = !marked.has(current.id);
    setMarked((m) => {
      const n = new Set(m);
      newMarked ? n.add(current.id) : n.delete(current.id);
      return n;
    });
    try { await api.toggleMark(attemptId, current.id, newMarked); } catch { /* best-effort */ }
    if (goNext) goToNext();
  }

  function goToNext() {
    if (currentIndex < partQuestions.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      const nextPartIdx = PARTS.indexOf(activePart) + 1;
      if (nextPartIdx < PARTS.length && questions.some((q) => q.part === PARTS[nextPartIdx])) {
        setActivePart(PARTS[nextPartIdx]);
        setCurrentIndex(0);
      }
    }
  }

  function saveAndNext() {
    goToNext();
  }

  function jumpTo(part, idx) {
    setActivePart(part);
    setCurrentIndex(idx);
  }

  async function doSubmit(auto = false) {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    try {
      await api.submitTest(attemptId);
      navigate(`/tests/result/${attemptId}`, { replace: true });
    } catch (e) {
      setError(e.message);
      submittedRef.current = false;
      setSubmitting(false);
    }
  }

  if (error) return <div className="page"><div className="form-error">{error}</div></div>;
  if (!test || !current) return <div className="page-loading">Setting up your test…</div>;

  const answeredCount = Object.keys(answers).length;
  const markedCount = marked.size;
  const unansweredCount = questions.length - answeredCount;

  return (
    <div className="exam-shell">
      <div className="exam-topbar">
        <div className="exam-title">
          <strong>{test.title}</strong>
          <span>{test.subject}</span>
        </div>
        <div className="exam-timer" data-low={secondsLeft !== null && secondsLeft < 300}>
          <span className="exam-timer-label">Time left</span>
          <span className="exam-timer-value">{timeString()}</span>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setConfirmOpen(true)}>Submit test</button>
      </div>

      <div className="exam-parts">
        {PARTS.filter((p) => questions.some((q) => q.part === p)).map((p) => (
          <button
            key={p}
            className={`exam-part-tab ${activePart === p ? "active" : ""}`}
            onClick={() => { setActivePart(p); setCurrentIndex(0); }}
          >
            Part {p}
          </button>
        ))}
      </div>

      <div className="exam-body">
        <div className="exam-question-panel">
          <div className="exam-question-header">
            <span>Question {currentIndex + 1} of {partQuestions.length}</span>
            <span className="exam-marks">+{current.marks} / −{current.negative_marks}</span>
          </div>
          <p className="exam-question-text">{renderRich(current.question, `q${current.id}`)}</p>
          <div className="exam-options">
            {["A", "B", "C", "D"].map((opt) => (
              <label key={opt} className={`exam-option ${answers[current.id] === opt ? "selected" : ""}`}>
                <input
                  type="radio"
                  name={`q-${current.id}`}
                  checked={answers[current.id] === opt}
                  onChange={() => selectOption(opt)}
                />
                <span className="exam-option-letter">{opt}</span>
                <span>{renderRich(current[`option_${opt.toLowerCase()}`], `q${current.id}o${opt}`)}</span>
              </label>
            ))}
          </div>

          <div className="exam-actions">
            <button className="btn btn-ghost" onClick={() => setCurrentIndex((i) => Math.max(i - 1, 0))} disabled={currentIndex === 0}>
              ← Previous
            </button>
            <button className="btn btn-ghost" onClick={clearResponse}>Clear response</button>
            <button className="btn btn-secondary" onClick={() => toggleMarkCurrent(true)}>
              {marked.has(current.id) ? "Unmark & next" : "Mark for review & next"}
            </button>
            <button className="btn btn-primary" onClick={saveAndNext}>Save & next →</button>
          </div>
        </div>

        <aside className="exam-palette">
          <div className="exam-legend">
            <span><i className="dot answered" />Answered</span>
            <span><i className="dot not-visited" />Not visited</span>
            <span><i className="dot visited" />Not answered</span>
            <span><i className="dot marked" />Marked</span>
            <span><i className="dot marked-answered" />Answered &amp; marked</span>
          </div>
          <div className="exam-palette-grid">
            {partQuestions.map((q, idx) => (
              <button
                key={q.id}
                className={`palette-cell ${statusOf(q)} ${idx === currentIndex ? "current" : ""}`}
                onClick={() => jumpTo(activePart, idx)}
              >
                {idx + 1}
              </button>
            ))}
          </div>
          <div className="exam-summary">
            <div><span>Answered</span><strong>{answeredCount}</strong></div>
            <div><span>Marked</span><strong>{markedCount}</strong></div>
            <div><span>Unanswered</span><strong>{unansweredCount}</strong></div>
          </div>
        </aside>
      </div>

      {confirmOpen && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3>Submit the test?</h3>
            <p>You've answered {answeredCount} of {questions.length} questions ({unansweredCount} unanswered). This can't be undone.</p>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setConfirmOpen(false)} disabled={submitting}>Keep working</button>
              <button className="btn btn-primary" onClick={() => doSubmit(false)} disabled={submitting}>
                {submitting ? "Submitting…" : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
