import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api.js";
import { renderRich } from "../components/RichContent.jsx";

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
  const [error, setError] = useState("");            // the test could not be opened at all
  const [submitError, setSubmitError] = useState(""); // shown inside the test, with a retry
  const [unsaved, setUnsaved] = useState(0);          // answers the server has not confirmed yet
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittedRef = useRef(false);
  const deadlineRef = useRef(null);   // when the time runs out (ms since 1970)
  const answersRef = useRef({});      // the answers on screen (mirrors `answers`)
  const serverRef = useRef({});       // the answers the server has confirmed
  const queueRef = useRef(Promise.resolve()); // saves go out one at a time, in order

  useEffect(() => {
    api.startTest(testId).then(({ attempt, test, questions: loaded }) => {
      const questions = loaded || [];
      if (questions.length === 0) throw new Error("This test has no questions yet.");
      setAttemptId(attempt.id);
      setTest(test);
      setQuestions(questions);
      setAnswers(attempt.answers || {});
      answersRef.current = { ...(attempt.answers || {}) };
      serverRef.current = { ...(attempt.answers || {}) };
      setMarked(new Set((attempt.marked || []).map(Number)));
      // The deadline comes from the server's start time, so reloading the page
      // (or resuming later) never gives extra time.
      deadlineRef.current = new Date(attempt.started_at).getTime() + test.duration_minutes * 60 * 1000;
      setSecondsLeft(Math.max(0, Math.round((deadlineRef.current - Date.now()) / 1000)));
      setActivePart(questions[0].part);
    }).catch((e) => setError(e.message));
  }, [testId]);

  // Timer. It re-reads the clock every tick instead of counting ticks: browsers
  // slow timers down in background tabs, which made the old countdown fall behind.
  useEffect(() => {
    if (!test) return undefined;
    const tick = () => setSecondsLeft(Math.max(0, Math.round((deadlineRef.current - Date.now()) / 1000)));
    const id = setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", tick); };
  }, [test]);

  useEffect(() => {
    if (secondsLeft === 0 && !submittedRef.current) doSubmit(true);
  }, [secondsLeft]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ask before leaving mid-test (the clock keeps running on the server).
  useEffect(() => {
    if (!test) return undefined;
    const warn = (e) => { if (!submittedRef.current) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [test]);

  const partQuestions = useMemo(
    () => questions.filter((q) => q.part === activePart),
    [questions, activePart]
  );
  const partsPresent = useMemo(() => PARTS.filter((p) => questions.some((q) => q.part === p)), [questions]);
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

  function countUnsaved(local) {
    const ids = new Set([...Object.keys(local), ...Object.keys(serverRef.current)]);
    return [...ids].filter((id) => (local[id] || null) !== (serverRef.current[id] || null)).length;
  }

  // Queue one save; resolves true if the server confirmed it.
  function queueSave(questionId, value) {
    const run = queueRef.current.then(async () => {
      try {
        await api.saveAnswer(attemptId, questionId, value);
        if (value) serverRef.current[questionId] = value; else delete serverRef.current[questionId];
        return true;
      } catch {
        return false;
      }
    });
    queueRef.current = run;
    return run;
  }

  function setAnswer(questionId, value) {
    const next = { ...answersRef.current };
    if (value) next[questionId] = value; else delete next[questionId];
    answersRef.current = next;
    setAnswers(next);
    queueSave(questionId, value).then(() => setUnsaved(countUnsaved(answersRef.current)));
  }

  // Sends every answer the server doesn't have yet. Resolves true when all are saved.
  async function resync() {
    await queueRef.current;
    const local = answersRef.current;
    const ids = new Set([...Object.keys(local), ...Object.keys(serverRef.current)]);
    const pending = [...ids].filter((id) => (local[id] || null) !== (serverRef.current[id] || null));
    const results = await Promise.all(pending.map((id) => queueSave(Number(id), local[id] || null)));
    setUnsaved(countUnsaved(answersRef.current));
    return results.every(Boolean);
  }

  // Back online after a dropped connection: send what didn't get through.
  useEffect(() => {
    if (!attemptId) return undefined;
    const onOnline = () => { resync(); };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [attemptId]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectOption = (opt) => setAnswer(current.id, opt);
  const clearResponse = () => setAnswer(current.id, null);

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
      const nextPart = partsPresent[partsPresent.indexOf(activePart) + 1];
      if (nextPart) { setActivePart(nextPart); setCurrentIndex(0); }
    }
  }

  // Previous also steps back into the end of the previous part.
  function goToPrevious() {
    if (currentIndex > 0) { setCurrentIndex((i) => i - 1); return; }
    const prevPart = partsPresent[partsPresent.indexOf(activePart) - 1];
    if (prevPart) {
      setActivePart(prevPart);
      setCurrentIndex(questions.filter((q) => q.part === prevPart).length - 1);
    }
  }
  const atVeryStart = currentIndex === 0 && partsPresent.indexOf(activePart) <= 0;

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
    setSubmitError("");
    try {
      // Make sure every answer on screen has reached the server before grading.
      const allSaved = await resync();
      if (!auto && !allSaved) {
        throw new Error("Some answers could not be saved — please check your internet connection, then press Submit again.");
      }
      await api.submitTest(attemptId);
      navigate(`/tests/result/${attemptId}`, { replace: true });
    } catch (e) {
      setSubmitError(e.message || "The test could not be submitted. Please try again.");
      submittedRef.current = false;
      setSubmitting(false);
      setConfirmOpen(true);
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
        {unsaved > 0 && <span className="exam-unsaved" role="status">{unsaved} answer{unsaved === 1 ? "" : "s"} not saved yet — check your connection</span>}
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
          <div className="exam-question-text">{renderRich(current.question, `q${current.id}`, { block: true })}</div>
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
                <span className="exam-option-text">{renderRich(current[`option_${opt.toLowerCase()}`], `q${current.id}o${opt}`)}</span>
              </label>
            ))}
          </div>

          <div className="exam-actions">
            <button className="btn btn-ghost" onClick={goToPrevious} disabled={atVeryStart}>
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
            {submitError && <div className="form-error">{submitError}</div>}
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setConfirmOpen(false)} disabled={submitting || secondsLeft === 0}>Keep working</button>
              <button className="btn btn-primary" onClick={() => doSubmit(false)} disabled={submitting}>
                {submitting ? "Submitting…" : submitError ? "Try again" : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
