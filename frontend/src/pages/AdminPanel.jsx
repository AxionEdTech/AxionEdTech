import React, { useState } from "react";
import { api } from "../api.js";
import { EXAMS, SUBJECTS, UNITS } from "../taxonomy.js";

const TABS = ["Add Note", "Add PYQ", "Add Mock Test", "Manage Students"];

// Reusable controlled dropdowns so section keys are always canonical.
function ExamSelect({ value, onChange }) {
  return (
    <label>Exam
      <select required value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select exam…</option>
        {EXAMS.map((x) => <option key={x} value={x}>{x}</option>)}
      </select>
    </label>
  );
}

function SubjectSelect({ value, onChange }) {
  return (
    <label>Subject
      <select required value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select subject…</option>
        {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
    </label>
  );
}

// Unit list depends on the chosen subject. Falls back to a text input for
// subjects that have no predefined unit list yet.
function UnitSelect({ subject, value, onChange }) {
  const units = UNITS[subject] || [];
  if (!subject) {
    return <label>Unit<input disabled placeholder="Choose a subject first" /></label>;
  }
  if (units.length === 0) {
    return <label>Unit<input required value={value} onChange={(e) => onChange(e.target.value)} placeholder="Unit name" /></label>;
  }
  return (
    <label>Unit / Topic
      <select required value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select unit…</option>
        {units.map((u) => <option key={u} value={u}>{u}</option>)}
      </select>
    </label>
  );
}

const SAMPLE_QUESTIONS_JSON = JSON.stringify([
  {
    part: "A",
    question: "Sample question text goes here?",
    option_a: "Option A", option_b: "Option B", option_c: "Option C", option_d: "Option D",
    correct_option: "B", marks: 2, negative_marks: 0.5
  }
], null, 2);

export default function AdminPanel() {
  const [tab, setTab] = useState(0);
  const [status, setStatus] = useState("");

  return (
    <div className="page">
      <h1>Admin</h1>
      <p className="page-sub">Add content that students will see immediately after login.</p>

      <div className="admin-tabs">
        {TABS.map((t, i) => (
          <button key={t} className={`admin-tab ${tab === i ? "active" : ""}`} onClick={() => { setTab(i); setStatus(""); }}>
            {t}
          </button>
        ))}
      </div>

      {status && <div className="form-note">{status}</div>}

      {tab === 0 && <NoteForm onDone={setStatus} />}
      {tab === 1 && <PYQForm onDone={setStatus} />}
      {tab === 2 && <TestForm onDone={setStatus} />}
      {tab === 3 && <StudentsPanel onDone={setStatus} />}
    </div>
  );
}

function NoteForm({ onDone }) {
  const [form, setForm] = useState({ exam: "", subject: "", unit: "", title: "", content: "", is_premium: false });
  const [busy, setBusy] = useState(false);
  // When subject changes, reset unit so a stale unit from another subject can't be saved.
  const update = (k, v) => setForm((f) => (k === "subject" ? { ...f, subject: v, unit: "" } : { ...f, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.createNote(form);
      onDone("Note added.");
      setForm({ exam: form.exam, subject: form.subject, unit: form.unit, title: "", content: "", is_premium: form.is_premium });
    } catch (err) {
      onDone(err.message);
    } finally { setBusy(false); }
  }

  return (
    <form className="form" onSubmit={submit}>
      <div className="form-row">
        <ExamSelect value={form.exam} onChange={(v) => update("exam", v)} />
        <SubjectSelect value={form.subject} onChange={(v) => update("subject", v)} />
      </div>
      <UnitSelect subject={form.subject} value={form.unit} onChange={(v) => update("unit", v)} />
      <label>Title<input required value={form.title} onChange={(e) => update("title", e.target.value)} /></label>
      <label>Content<textarea required rows={10} value={form.content} onChange={(e) => update("content", e.target.value)} /></label>
      <p className="field-hint">Math: type $E=mc^2$ for inline, or $$...$$ on its own line for a centered equation. Images: paste a link ending in .png/.jpg, or use ![caption](link) for a captioned image.</p>
      <label style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <input type="checkbox" checked={form.is_premium} onChange={(e) => update("is_premium", e.target.checked)} style={{ width: "auto" }} />
        Paid plan only
      </label>
      <button className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : "Add note"}</button>
    </form>
  );
}

function PYQForm({ onDone }) {
  const [form, setForm] = useState({
    exam: "", subject: "", year: new Date().getFullYear(), part: "A", question: "",
    option_a: "", option_b: "", option_c: "", option_d: "", correct_option: "A", explanation: "",
    is_premium: false
  });
  const [busy, setBusy] = useState(false);
  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.createPYQ(form);
      onDone("Question added.");
      setForm((f) => ({ ...f, question: "", option_a: "", option_b: "", option_c: "", option_d: "", explanation: "" }));
    } catch (err) {
      onDone(err.message);
    } finally { setBusy(false); }
  }

  return (
    <form className="form" onSubmit={submit}>
      <div className="form-row">
        <ExamSelect value={form.exam} onChange={(v) => update("exam", v)} />
        <SubjectSelect value={form.subject} onChange={(v) => update("subject", v)} />
      </div>
      <div className="form-row">
        <label>Year<input required type="number" value={form.year} onChange={(e) => update("year", Number(e.target.value))} /></label>
        <label>Part
          <select value={form.part} onChange={(e) => update("part", e.target.value)}>
            <option value="A">A</option><option value="B">B</option><option value="C">C</option>
          </select>
        </label>
      </div>
      <label>Question<textarea required rows={3} value={form.question} onChange={(e) => update("question", e.target.value)} /></label>
      <p className="field-hint">Math: $E=mc^2$ inline or $$...$$ for a centered equation. Images: paste a link ending in .png/.jpg, or ![caption](link).</p>
      <div className="form-row">
        <label>Option A<input required value={form.option_a} onChange={(e) => update("option_a", e.target.value)} /></label>
        <label>Option B<input required value={form.option_b} onChange={(e) => update("option_b", e.target.value)} /></label>
      </div>
      <div className="form-row">
        <label>Option C<input required value={form.option_c} onChange={(e) => update("option_c", e.target.value)} /></label>
        <label>Option D<input required value={form.option_d} onChange={(e) => update("option_d", e.target.value)} /></label>
      </div>
      <label>Correct option
        <select value={form.correct_option} onChange={(e) => update("correct_option", e.target.value)}>
          <option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option>
        </select>
      </label>
      <label>Explanation (optional)<textarea rows={2} value={form.explanation} onChange={(e) => update("explanation", e.target.value)} /></label>
      <label style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <input type="checkbox" checked={form.is_premium} onChange={(e) => update("is_premium", e.target.checked)} style={{ width: "auto" }} />
        Paid plan only
      </label>
      <button className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : "Add question"}</button>
    </form>
  );
}

function TestForm({ onDone }) {
  const [form, setForm] = useState({ exam: "", subject: "", title: "", duration_minutes: 180, is_premium: false });
  const [questionsJson, setQuestionsJson] = useState(SAMPLE_QUESTIONS_JSON);
  const [busy, setBusy] = useState(false);
  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const questions = JSON.parse(questionsJson);
      await api.createTest({ ...form, questions });
      onDone(`Mock test created with ${questions.length} questions.`);
    } catch (err) {
      onDone(err.message.includes("JSON") ? "The questions field isn't valid JSON — check the format." : err.message);
    } finally { setBusy(false); }
  }

  return (
    <form className="form" onSubmit={submit}>
      <div className="form-row">
        <ExamSelect value={form.exam} onChange={(v) => update("exam", v)} />
        <SubjectSelect value={form.subject} onChange={(v) => update("subject", v)} />
      </div>
      <div className="form-row">
        <label>Duration (minutes)<input required type="number" value={form.duration_minutes} onChange={(e) => update("duration_minutes", Number(e.target.value))} /></label>
        <label>Title<input required value={form.title} onChange={(e) => update("title", e.target.value)} /></label>
      </div>
      <label style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <input type="checkbox" checked={form.is_premium} onChange={(e) => update("is_premium", e.target.checked)} style={{ width: "auto" }} />
        Paid plan only
      </label>
      <label>
        Questions (JSON array — part, question, option_a..d, correct_option, marks, negative_marks)
        <textarea required rows={14} className="mono" value={questionsJson} onChange={(e) => setQuestionsJson(e.target.value)} />
      </label>
      <p className="field-hint">Math and images work the same way inside these JSON strings — $E=mc^2$, $$...$$, or ![caption](link).</p>
      <button className="btn btn-primary" disabled={busy}>{busy ? "Creating…" : "Create mock test"}</button>
    </form>
  );
}

function StudentsPanel({ onDone }) {
  const [students, setStudents] = useState(null);
  const [busyId, setBusyId] = useState(null);

  React.useEffect(() => {
    api.listStudents().then((d) => setStudents(d.students)).catch((e) => onDone(e.message));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function changePlan(id, plan) {
    setBusyId(id);
    try {
      await api.setPlan(id, plan);
      setStudents((list) => list.map((s) => (s.id === id ? { ...s, plan } : s)));
    } catch (err) {
      onDone(err.message);
    } finally { setBusyId(null); }
  }

  if (!students) return <p className="page-loading">Loading students…</p>;

  return (
    <div>
      <p className="page-sub">Flip a student to "paid" once you've confirmed payment (manually, until a payment gateway is wired up).</p>
      <div className="test-list">
        {students.map((s) => (
          <div key={s.id} className="test-card">
            <div>
              <h3>{s.name} {s.role === "admin" && <span style={{ color: "var(--accent)", fontSize: "0.75rem" }}>(admin)</span>}</h3>
              <p className="test-card-meta">{s.email}{s.subject ? ` · ${s.subject}` : ""} · currently <strong>{s.plan}</strong></p>
            </div>
            {s.plan === "free" ? (
              <button className="btn btn-primary btn-sm" disabled={busyId === s.id} onClick={() => changePlan(s.id, "paid")}>
                Mark as paid
              </button>
            ) : (
              <button className="btn btn-ghost btn-sm" disabled={busyId === s.id} onClick={() => changePlan(s.id, "free")}>
                Revert to free
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
