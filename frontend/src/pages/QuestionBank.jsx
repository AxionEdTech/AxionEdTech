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
// The question bank's front page, in two views like Mock Tests:
//   Subject-wise  one card per unit (e.g. Mathematical Methods of Physics)
//   Topic-wise    the topics inside each unit (e.g. Vector Analysis), grouped
//                 under their unit, plus an "all questions" card per unit.
// The view is kept in the address (?by=topic) so Back returns to it.
// ---------------------------------------------------------------------------
const VIEWS = [
  { id: "unit", label: "Subject-wise" },
  { id: "topic", label: "Topic-wise" },
];

// One summary row per exam/subject/unit/topic → per-unit totals.
function groupUnits(rows) {
  const map = new Map();
  for (const r of rows) {
    const key = `${r.exam}|${r.subject}|${r.unit}`;
    const u = map.get(key) || { exam: r.exam, subject: r.subject, unit: r.unit, total: 0, accessible: 0, attempted: 0, correct: 0, topics: [] };
    u.total += Number(r.total); u.accessible += Number(r.accessible);
    u.attempted += Number(r.attempted); u.correct += Number(r.correct);
    if (r.topic) u.topics.push({ ...r, total: Number(r.total), accessible: Number(r.accessible), attempted: Number(r.attempted), correct: Number(r.correct) });
    map.set(key, u);
  }
  for (const u of map.values()) u.topics.sort((a, b) => a.topic.localeCompare(b.topic));
  return [...map.values()];
}

function practiceLink({ exam, subject, unit, topic }, by) {
  const p = new URLSearchParams({ exam, subject, unit });
  if (topic) p.set("topic", topic);
  if (by === "topic") p.set("by", "topic");
  return p;
}

function TopicGrid({ setParams }) {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const by = params.get("by") === "topic" ? "topic" : "unit";
  const [rows, setRows] = useState(null);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const [exam, setExam] = useState("");

  useEffect(() => {
    api.qbTopicSummary().then((d) => setRows(d.topics)).catch((e) => setError(e.message));
    if (user) api.qbStats().then(setStats).catch(() => {});
  }, [user]);

  const units = useMemo(() => groupUnits(rows || [])
    .sort((a, b) => examRank(a.exam) - examRank(b.exam) || subjectRank(a.subject) - subjectRank(b.subject)
      || unitRank(a.subject, a.unit) - unitRank(b.subject, b.unit)), [rows]);
  const exams = useMemo(() => [...new Set(units.map((u) => u.exam))], [units]);
  const shown = units.filter((u) => !exam || u.exam === exam);
  const anyTopics = shown.some((u) => u.topics.length > 0);
  const setView = (id) => setParams(id === "topic" ? { by: "topic" } : {}, { replace: true });
  const open = (item) => setParams(practiceLink(item, by));

  if (!rows && !error) return <div className="page-loading">Loading question bank…</div>;

  return (
    <div className="page page-wide">
      <p className="eyebrow">Practice by subject and topic</p>
      <h1>Question Bank</h1>
      {error && <div className="form-error">{error}</div>}

      <div className="toolbar">
        <div className="exam-tabs" role="tablist" aria-label="Group questions">
          {VIEWS.map((v) => (
            <button key={v.id} role="tab" aria-selected={by === v.id} className={by === v.id ? "active" : ""} onClick={() => setView(v.id)}>{v.label}</button>
          ))}
        </div>
        <div className="toolbar-right">
          {exams.length > 1 && (
            <select className="filter-select" value={exam} onChange={(e) => setExam(e.target.value)} aria-label="Filter by exam">
              <option value="">All exams</option>
              {exams.map((ex) => <option key={ex} value={ex}>{ex}</option>)}
            </select>
          )}
          {user && (
            <Link className="btn btn-ghost btn-sm" to="/question-bank?view=bookmarks">
              <Icon name="bookmark" size={15} /> Saved questions{stats ? ` (${stats.bookmarked})` : ""}
            </Link>
          )}
        </div>
      </div>

      {shown.length === 0 && !error && <p className="empty-state">No questions have been added yet.</p>}

      {by === "unit" && (
        <div className="grid grid-3">
          {shown.map((u) => (
            <ProgressTile key={`${u.exam}|${u.subject}|${u.unit}`} item={u} user={user} onOpen={() => open(u)}
              title={u.unit} meta={u.subject}
              extra={u.topics.length > 0 ? `${u.topics.length} topic${u.topics.length === 1 ? "" : "s"}` : null} />
          ))}
        </div>
      )}

      {by === "topic" && shown.length > 0 && !anyTopics && (
        <p className="empty-state">Questions haven't been sorted into topics yet — use Subject-wise for now.</p>
      )}
      {by === "topic" && shown.filter((u) => u.topics.length > 0).map((u) => (
        <section key={`${u.exam}|${u.subject}|${u.unit}`} className="qb-unit-group" aria-label={u.unit}>
          <div className="qb-unit-head">
            <h2>{u.unit}</h2>
            <span className="card-meta">{u.exam} · {u.subject}</span>
          </div>
          <div className="grid grid-3">
            {u.topics.map((t) => (
              <ProgressTile key={t.topic} item={t} user={user} onOpen={() => open(t)} title={t.topic} meta={u.unit} />
            ))}
            <ProgressTile item={u} user={user} onOpen={() => open(u)} title={`All of ${u.unit}`} meta="Every topic mixed together" muted />
          </div>
        </section>
      ))}
    </div>
  );
}

function ProgressTile({ item: t, user, onOpen, title, meta, extra, muted }) {
  const pct = t.accessible ? Math.round((t.attempted / t.accessible) * 100) : 0;
  const acc = t.attempted ? Math.round((t.correct / t.attempted) * 100) : null;
  return (
    <button className={`card card-hover topic-tile${muted ? " topic-tile-all" : ""}`} onClick={onOpen}>
      <div className="card-top">
        <span className="card-icon"><Icon name={muted ? "layers" : "bank"} size={20} /></span>
        <span className="tier-badge tier-info">{t.exam}</span>
      </div>
      <h3>{title}</h3>
      <p className="card-meta">{meta}{extra ? ` · ${extra}` : ""}</p>
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
  const topic = params.get("topic") || "";
  const by = params.get("by") === "topic" ? "topic" : "unit";
  const [unitTopics, setUnitTopics] = useState([]); // summary rows for this unit's topics
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
      : { exam, subject, unit, topic, difficulty, qtype };
    const d = await api.listQuestions({ ...filters, limit: PAGE_SIZE, offset });
    const prog = user ? (await api.qbProgress(d.questions.map((q) => q.id))).progress : {};
    return { ...d, prog };
  }, [mode, exam, subject, unit, topic, difficulty, qtype, user]);

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
          const rows = (await api.qbTopicSummary()).topics.filter((x) => x.exam === exam && x.subject === subject && x.unit === unit);
          const u = groupUnits(rows)[0];
          if (active) {
            setUnitTopics(u ? u.topics : []);
            setTopicInfo(topic ? (u?.topics.find((t) => t.topic === topic) || null) : (u || null));
          }
        }
      } catch (e) { if (active) setError(e.message); }
    })();
    return () => { active = false; };
  }, [fetchPage, mode, exam, subject, unit, topic]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const ids = mode === "bookmarks" ? (await api.qbBookmarkedIds()).ids : undefined;
      const d = await fetchPage(questions.length, ids);
      setQuestions((q) => [...q, ...d.questions]);
      setProgress((p) => ({ ...p, ...d.prog }));
    } catch (e) { setError(e.message); } finally { setLoadingMore(false); }
  }

  const back = () => setParams(by === "topic" ? { by: "topic" } : {}, { replace: false });
  const pickTopic = (t) => setParams(practiceLink({ exam, subject, unit, topic: t }, by), { replace: true });
  const hiddenCount = topicInfo ? topicInfo.total - topicInfo.accessible : 0;

  return (
    <div className="page page-reading">
      <button className="back-link link-btn" onClick={back}>← Question Bank</button>
      <h1>{mode === "bookmarks" ? "Saved questions" : topic || unit}</h1>
      {mode === "topic" && <p className="page-sub">{exam} · {subject}{topic ? ` · ${unit}` : ""}</p>}

      {mode === "topic" && unitTopics.length > 0 && (
        <div className="exam-tabs qb-topic-tabs" role="tablist" aria-label="Topics in this unit">
          <button role="tab" aria-selected={!topic} className={!topic ? "active" : ""} onClick={() => pickTopic("")}>All topics</button>
          {unitTopics.map((t) => (
            <button key={t.topic} role="tab" aria-selected={topic === t.topic} className={topic === t.topic ? "active" : ""} onClick={() => pickTopic(t.topic)}>
              {t.topic} <span className="tab-count">{t.total}</span>
            </button>
          ))}
        </div>
      )}

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
          <span>{hiddenCount} more question{hiddenCount === 1 ? "" : "s"} in this {topic ? "topic" : "unit"} {hiddenCount === 1 ? "is" : "are"} part of a higher plan.</span>
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
