import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { api } from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { DIFFICULTIES, QUESTION_TYPES, examRank, subjectRank, unitRank } from "../lib/taxonomy.js";
import RichContent, { renderRich } from "../components/RichContent.jsx";
import { TierBadge } from "../components/Cards.jsx";
import Icon from "../components/Icon.jsx";

const PAGE_SIZE = 10;
const LETTERS = "ABCDEF";

export default function QuestionBank() {
  const [params, setParams] = useSearchParams();
  const view = params.get("view");
  const unit = params.get("unit");
  if (view === "bookmarks") return <Practice mode="bookmarks" />;
  if (unit) return <Practice mode="topic" />;
  return <TopicGrid setParams={setParams} />;
}

// ---------------------------------------------------------------------------
// Topic grid: one card per exam / subject / topic, with the viewer's progress.
// ---------------------------------------------------------------------------
function TopicGrid({ setParams }) {
  const { user } = useAuth();
  const [topics, setTopics] = useState(null);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const [exam, setExam] = useState("");

  useEffect(() => {
    api.qbTopicSummary().then((d) => setTopics(d.topics)).catch((e) => setError(e.message));
    if (user) api.qbStats().then(setStats).catch(() => {});
  }, [user]);

  const exams = useMemo(
    () => (topics ? [...new Set(topics.map((t) => t.exam))].sort((a, b) => examRank(a) - examRank(b)) : []),
    [topics]
  );
  const shown = useMemo(
    () => (topics || [])
      .filter((t) => !exam || t.exam === exam)
      .sort((a, b) => examRank(a.exam) - examRank(b.exam) || subjectRank(a.subject) - subjectRank(b.subject)
        || unitRank(a.subject, a.unit) - unitRank(b.subject, b.unit)),
    [topics, exam]
  );

  if (!topics && !error) return <div className="page-loading">Loading question bank…</div>;

  return (
    <div className="page page-wide">
      <p className="eyebrow">Practice by topic</p>
      <h1>Question Bank</h1>
      {error && <div className="form-error">{error}</div>}

      <div className="toolbar">
        {exams.length > 1 ? (
          <div className="exam-tabs">
            <button className={exam === "" ? "active" : ""} onClick={() => setExam("")}>All exams</button>
            {exams.map((ex) => <button key={ex} className={exam === ex ? "active" : ""} onClick={() => setExam(ex)}>{ex}</button>)}
          </div>
        ) : <span />}
        {user && (
          <Link className="btn btn-ghost btn-sm" to="/question-bank?view=bookmarks">
            <Icon name="bookmark" size={15} /> Saved questions{stats ? ` (${stats.bookmarked})` : ""}
          </Link>
        )}
      </div>

      {shown.length === 0 && !error && <p className="empty-state">No questions have been added yet.</p>}

      <div className="grid grid-3">
        {shown.map((t) => {
          const pct = t.accessible ? Math.round((t.attempted / t.accessible) * 100) : 0;
          const acc = t.attempted ? Math.round((t.correct / t.attempted) * 100) : null;
          const link = `?exam=${encodeURIComponent(t.exam)}&subject=${encodeURIComponent(t.subject)}&unit=${encodeURIComponent(t.unit)}`;
          return (
            <button key={`${t.exam}|${t.subject}|${t.unit}`} className="card card-hover topic-tile" onClick={() => setParams(new URLSearchParams(link))}>
              <div className="card-top">
                <span className="card-icon"><Icon name="bank" size={20} /></span>
                <span className="tier-badge tier-info">{t.exam}</span>
              </div>
              <h3>{t.unit}</h3>
              <p className="card-meta">{t.subject}</p>
              <p className="card-meta">
                {t.total} question{t.total === 1 ? "" : "s"}
                {t.accessible < t.total && <> · <Icon name="lock" size={13} /> {t.total - t.accessible} in higher plans</>}
              </p>
              {user && (
                <div className="progress" aria-label={`${pct}% attempted`}>
                  <span style={{ width: `${pct}%` }} />
                </div>
              )}
              {user && <p className="card-meta">{t.attempted} attempted{acc !== null ? ` · ${acc}% correct` : ""}</p>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Practice view: the questions of one topic (or the saved questions).
// ---------------------------------------------------------------------------
function Practice({ mode }) {
  const { user } = useAuth();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const exam = params.get("exam") || "";
  const subject = params.get("subject") || "";
  const unit = params.get("unit") || "";
  const [difficulty, setDifficulty] = useState("");
  const [qtype, setQtype] = useState("");
  const [questions, setQuestions] = useState(null);
  const [count, setCount] = useState(0);
  const [progress, setProgress] = useState({});
  const [error, setError] = useState("");
  const [topicInfo, setTopicInfo] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchPage = useCallback(async (offset, ids) => {
    const filters = mode === "bookmarks"
      ? { ids }
      : { exam, subject, unit, difficulty, qtype };
    const d = await api.listQuestions({ ...filters, limit: PAGE_SIZE, offset });
    const prog = user ? (await api.qbProgress(d.questions.map((q) => q.id))).progress : {};
    return { ...d, prog };
  }, [mode, exam, subject, unit, difficulty, qtype, user]);

  useEffect(() => {
    let active = true;
    setQuestions(null); setError("");
    (async () => {
      try {
        const ids = mode === "bookmarks" ? (await api.qbBookmarkedIds()).ids : undefined;
        const d = await fetchPage(0, ids);
        if (!active) return;
        setQuestions(d.questions); setCount(d.count); setProgress(d.prog);
        if (mode === "topic") {
          const t = (await api.qbTopicSummary()).topics.find((x) => x.exam === exam && x.subject === subject && x.unit === unit);
          if (active) setTopicInfo(t || null);
        }
      } catch (e) { if (active) setError(e.message); }
    })();
    return () => { active = false; };
  }, [fetchPage, mode, exam, subject, unit]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const ids = mode === "bookmarks" ? (await api.qbBookmarkedIds()).ids : undefined;
      const d = await fetchPage(questions.length, ids);
      setQuestions((q) => [...q, ...d.questions]);
      setProgress((p) => ({ ...p, ...d.prog }));
    } catch (e) { setError(e.message); } finally { setLoadingMore(false); }
  }

  const back = () => setParams(new URLSearchParams(), { replace: false });
  const hiddenCount = topicInfo ? topicInfo.total - topicInfo.accessible : 0;

  return (
    <div className="page page-reading">
      <button className="back-link link-btn" onClick={back}>← All topics</button>
      <h1>{mode === "bookmarks" ? "Saved questions" : unit}</h1>
      {mode === "topic" && <p className="page-sub">{exam} · {subject}</p>}

      {mode === "topic" && (
        <div className="toolbar">
          <div className="exam-tabs">
            <button className={difficulty === "" ? "active" : ""} onClick={() => setDifficulty("")}>Any level</button>
            {DIFFICULTIES.map((d) => <button key={d} className={difficulty === d ? "active" : ""} onClick={() => setDifficulty(d)}>{d[0].toUpperCase() + d.slice(1)}</button>)}
          </div>
          <div className="exam-tabs">
            <button className={qtype === "" ? "active" : ""} onClick={() => setQtype("")}>All types</button>
            {QUESTION_TYPES.map((t) => <button key={t.id} className={qtype === t.id ? "active" : ""} onClick={() => setQtype(t.id)}>{t.label}</button>)}
          </div>
        </div>
      )}

      {!user && <div className="tier-banner"><span>Log in to check your answers and track progress.</span><span className="tier-banner-actions"><Link className="btn btn-gold btn-sm" to="/login" state={{ from: location.pathname + location.search }}>Log in</Link><Link className="btn btn-ghost btn-sm" to="/register">Sign up free</Link></span></div>}
      {error && <div className="form-error">{error}</div>}
      {!questions && !error && <p className="page-loading">Loading questions…</p>}
      {questions && questions.length === 0 && <p className="empty-state">{mode === "bookmarks" ? "You have not saved any questions yet." : "No questions match these filters."}</p>}

      {questions && questions.map((q, i) => (
        <QuestionCard
          key={q.id} q={q} index={i + 1} user={user} previous={progress[q.id]}
          onProgress={(p) => setProgress((cur) => ({ ...cur, [q.id]: { ...(cur[q.id] || {}), ...p } }))}
        />
      ))}

      {questions && questions.length < count && (
        <button className="btn btn-ghost btn-block" onClick={loadMore} disabled={loadingMore}>{loadingMore ? "Loading…" : `Load more (${count - questions.length} left)`}</button>
      )}

      {hiddenCount > 0 && (
        <div className="locked-inline">
          <Icon name="lock" size={18} />
          <span>{hiddenCount} more question{hiddenCount === 1 ? "" : "s"} in this topic {hiddenCount === 1 ? "is" : "are"} part of a higher plan.</span>
          <Link className="btn btn-gold btn-sm" to="/plans">See plans</Link>
        </div>
      )}
    </div>
  );
}

function QuestionCard({ q, index, user, previous, onProgress }) {
  const location = useLocation();
  const [answer, setAnswer] = useState(previous?.last_response || "");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const bookmarked = !!previous?.bookmarked;
  const solved = result ? result.is_correct : previous?.last_attempted_at ? previous.is_correct : null;

  const picked = q.qtype === "msq" ? answer.split(",").filter(Boolean) : [answer];
  const toggleMsq = (letter) => {
    const set = new Set(picked);
    if (set.has(letter)) set.delete(letter); else set.add(letter);
    setAnswer([...set].sort().join(","));
  };

  async function check() {
    setBusy(true); setError("");
    try {
      const r = await api.checkAnswer(q.id, answer);
      setResult(r);
      onProgress({ is_correct: r.is_correct, last_response: answer, last_attempted_at: new Date().toISOString() });
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  async function toggleBookmark() {
    try {
      await api.setBookmark(q.id, !bookmarked);
      onProgress({ bookmarked: !bookmarked });
    } catch (e) { setError(e.message); }
  }

  // The key may be stored as "b" or "A, C": compare letters, ignoring case and spaces.
  const correctSet = result ? new Set(String(result.answer_key).toUpperCase().split(",").map((x) => x.trim()).filter(Boolean)) : null;

  return (
    <article className={`card q-card${result ? (result.is_correct ? " is-right" : " is-wrong") : ""}`}>
      <header className="q-head">
        <span className="q-num">Q{index}</span>
        <span className={`diff-pill diff-${q.difficulty}`}>{q.difficulty}</span>
        <span className="q-type">{QUESTION_TYPES.find((t) => t.id === q.qtype)?.label}</span>
        {q.min_plan !== "free" && <TierBadge minPlan={q.min_plan} />}
        {solved === true && !result && <span className="solved-tag">Solved</span>}
        {solved === false && !result && <span className="retry-tag">Try again</span>}
        {user && (
          <button className={`bookmark-btn${bookmarked ? " on" : ""}`} onClick={toggleBookmark} aria-pressed={bookmarked} aria-label={bookmarked ? "Remove from saved" : "Save question"}>
            <Icon name="bookmark" size={18} />
          </button>
        )}
      </header>

      <div className="q-stem"><RichContent text={q.content} /></div>
      {q.source && <p className="card-meta">{q.source}</p>}

      {q.qtype === "nat" ? (
        <label className="nat-input">Your answer
          <input type="text" inputMode="decimal" value={answer} onChange={(e) => setAnswer(e.target.value)} disabled={!!result} placeholder="Enter a number" />
        </label>
      ) : (
        <ul className="q-options">
          {q.options.map((opt, i) => {
            const letter = LETTERS[i];
            const chosen = picked.includes(letter);
            const cls = result ? (correctSet.has(letter) ? "correct" : chosen ? "incorrect" : "") : chosen ? "chosen" : "";
            return (
              <li key={letter}>
                <label className={`q-option ${cls}`}>
                  <input
                    type={q.qtype === "msq" ? "checkbox" : "radio"} name={`q${q.id}`} checked={chosen} disabled={!!result}
                    onChange={() => (q.qtype === "msq" ? toggleMsq(letter) : setAnswer(letter))}
                  />
                  <span className="q-letter">{letter}</span>
                  <span className="q-opt-text">{renderRich(opt, `q${q.id}o${letter}`)}</span>
                </label>
              </li>
            );
          })}
        </ul>
      )}

      {error && <div className="form-error">{error}</div>}

      {!result ? (
        <div className="q-actions">
          {user ? (
            <button className="btn btn-navy" onClick={check} disabled={busy || !answer}>{busy ? "Checking…" : "Check answer"}</button>
          ) : (
            <Link className="btn btn-navy" to="/login" state={{ from: location.pathname + location.search }}>Log in to check</Link>
          )}
        </div>
      ) : (
        <div className={`q-feedback ${result.is_correct ? "right" : "wrong"}`}>
          <strong>{result.is_correct ? "Correct" : "Not quite"}</strong>
          {!result.is_correct && <span> · Answer: {result.answer_key}</span>}
          {result.explanation && <div className="q-explain"><RichContent text={result.explanation} /></div>}
          <button className="btn btn-ghost btn-sm" onClick={() => { setResult(null); setAnswer(""); }}>Try again</button>
        </div>
      )}
    </article>
  );
}
