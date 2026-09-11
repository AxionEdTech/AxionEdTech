import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import { EXAMS, SUBJECTS, UNITS, SESSIONS } from "../taxonomy.js";
import { groupNotes, assignPositions } from "../noteOrdering.js";

const TABS = ["Notices", "Notes", "PYQs", "Mock Tests", "Manage Students"];

// Exam suggestions everywhere now come straight from the shared taxonomy so
// this list can never drift out of sync with what the public pages expect.
function ExamDatalist() {
  return (
    <datalist id="exam-suggestions">
      {EXAMS.map((e) => <option key={e} value={e} />)}
    </datalist>
  );
}

function SessionDatalist() {
  return (
    <datalist id="session-suggestions">
      {SESSIONS.map((s) => <option key={s} value={s} />)}
    </datalist>
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
      <p className="page-sub">Add, edit, or remove content that students see immediately after login.</p>

      <div className="admin-tabs">
        {TABS.map((t, i) => (
          <button key={t} className={`admin-tab ${tab === i ? "active" : ""}`} onClick={() => { setTab(i); setStatus(""); }}>
            {t}
          </button>
        ))}
      </div>

      {status && <div className="form-note">{status}</div>}

      {tab === 0 && <AnnouncementsManager onDone={setStatus} />}
      {tab === 1 && <NotesManager onDone={setStatus} />}
      {tab === 2 && <PYQManager onDone={setStatus} />}
      {tab === 3 && <TestManager onDone={setStatus} />}
      {tab === 4 && <StudentsPanel onDone={setStatus} />}
    </div>
  );
}

// ============================================================================
// Notices (notice board)
// ============================================================================
function AnnouncementsManager({ onDone }) {
  const [items, setItems] = useState(null);
  const [editing, setEditing] = useState(null);

  async function refresh() {
    try { setItems((await api.listAnnouncements()).announcements); } catch (err) { onDone(err.message); }
  }
  useEffect(() => { refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleDelete(a) {
    if (!window.confirm(`Delete the notice "${a.title}"? This can't be undone.`)) return;
    try { await api.deleteAnnouncement(a.id); onDone("Notice deleted."); refresh(); } catch (err) { onDone(err.message); }
  }

  return (
    <div>
      <AnnouncementForm
        key={editing?.id ?? "new"}
        editing={editing}
        onCancelEdit={() => setEditing(null)}
        onDone={(msg) => { onDone(msg); setEditing(null); refresh(); }}
      />
      <h2 className="section-heading">Existing notices</h2>
      {!items && <p className="page-loading">Loading…</p>}
      {items && items.length === 0 && <p className="empty-state">No notices yet. Post one above — it appears on the home page and student dashboard immediately.</p>}
      <div className="admin-list">
        {items && items.map((a) => (
          <div key={a.id} className="admin-list-row">
            <div>
              <strong>{a.title}{a.is_pinned ? " · Pinned" : ""}{!a.is_active ? " · Hidden" : ""}</strong>
              <span className="admin-list-meta">{new Date(a.created_at).toLocaleDateString()}</span>
            </div>
            <div className="admin-list-actions">
              <button className="btn btn-ghost btn-sm" onClick={() => setEditing(a)}>Edit</button>
              <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(a)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AnnouncementForm({ editing, onDone, onCancelEdit }) {
  const [form, setForm] = useState(() => editing
    ? { title: editing.title, body: editing.body, is_pinned: editing.is_pinned, is_active: editing.is_active }
    : { title: "", body: "", is_pinned: false, is_active: true }
  );
  const [busy, setBusy] = useState(false);
  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const isEditing = !!editing;

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      if (isEditing) {
        await api.updateAnnouncement(editing.id, form);
        onDone("Notice updated.");
      } else {
        await api.createAnnouncement(form);
        onDone("Notice posted.");
        setForm({ title: "", body: "", is_pinned: false, is_active: true });
      }
    } catch (err) {
      onDone(err.message);
    } finally { setBusy(false); }
  }

  return (
    <form className="form" onSubmit={submit}>
      {isEditing && <p className="form-note">Editing "{editing.title}"</p>}
      <label>Title<input required value={form.title} onChange={(e) => update("title", e.target.value)} placeholder="e.g. New CSIR NET December 2026 papers added" /></label>
      <label>Message<textarea required rows={4} value={form.body} onChange={(e) => update("body", e.target.value)} placeholder="What's changed, and what students should do next." /></label>
      <p className="field-hint">Shows on the home page and student dashboard, pinned notices first, then newest. Basic formatting works: **bold**, *italic*, links.</p>
      <div className="form-row">
        <label style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <input type="checkbox" checked={form.is_pinned} onChange={(e) => update("is_pinned", e.target.checked)} style={{ width: "auto" }} />
          Pin to top
        </label>
        <label style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <input type="checkbox" checked={form.is_active} onChange={(e) => update("is_active", e.target.checked)} style={{ width: "auto" }} />
          Visible to students
        </label>
      </div>
      <div className="form-row">
        <button className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : isEditing ? "Update notice" : "Post notice"}</button>
        {isEditing && <button type="button" className="btn btn-ghost" onClick={onCancelEdit}>Cancel</button>}
      </div>
    </form>
  );
}

// ============================================================================
// Notes
// ============================================================================
function NotesManager({ onDone }) {
  const [notes, setNotes] = useState(null);
  const [editing, setEditing] = useState(null);
  const [reorderMode, setReorderMode] = useState(false);
  const [busyOrder, setBusyOrder] = useState(false);

  async function refresh() {
    try { setNotes((await api.listNotes()).notes); } catch (err) { onDone(err.message); }
  }
  useEffect(() => { refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleEdit(n) {
    try { setEditing((await api.getNote(n.id)).note); } catch (err) { onDone(err.message); }
  }

  async function handleDelete(n) {
    if (!window.confirm(`Delete "${n.title}"? This can't be undone.`)) return;
    try { await api.deleteNote(n.id); onDone("Note deleted."); refresh(); } catch (err) { onDone(err.message); }
  }

  const groups = useMemo(() => (notes ? groupNotes(notes, { splitByExam: true }) : []), [notes]);

  async function persist(newGroups) {
    setBusyOrder(true);
    try {
      const updates = assignPositions(newGroups).filter((u) => {
        const original = notes.find((n) => n.id === u.id);
        return !original || original.position !== u.position;
      });
      if (updates.length) {
        await Promise.all(updates.map((u) => api.updateNote(u.id, { position: u.position })));
      }
      onDone("Order updated.");
      await refresh();
    } catch (err) {
      onDone(err.message);
    } finally {
      setBusyOrder(false);
    }
  }

  function moveGroup(gi, dir) {
    const ni = gi + dir;
    if (ni < 0 || ni >= groups.length) return;
    const copy = groups.map((g) => ({ ...g, items: g.items.slice() }));
    [copy[gi], copy[ni]] = [copy[ni], copy[gi]];
    persist(copy);
  }

  function moveItem(gi, ii, dir) {
    const group = groups[gi];
    const ni = ii + dir;
    if (ni < 0 || ni >= group.items.length) return;
    const copy = groups.map((g, i) => (i === gi ? { ...g, items: g.items.slice() } : g));
    const items = copy[gi].items;
    [items[ii], items[ni]] = [items[ni], items[ii]];
    persist(copy);
  }

  return (
    <div>
      <NoteForm
        key={editing?.id ?? "new"}
        editing={editing}
        onCancelEdit={() => setEditing(null)}
        onDone={(msg) => { onDone(msg); setEditing(null); refresh(); }}
      />
      <div className="section-heading">
        <h2>Existing notes</h2>
        {notes && notes.length > 0 && (
          <button className="btn btn-ghost btn-sm" onClick={() => setReorderMode((r) => !r)}>
            {reorderMode ? "Done reordering" : "Reorder notes"}
          </button>
        )}
      </div>
      {!notes && <p className="page-loading">Loading…</p>}
      {notes && notes.length === 0 && <p className="empty-state">No notes yet.</p>}

      {notes && reorderMode && (
        <div className="reorder-list">
          <p className="field-hint">Move a whole topic, or a single note within it. Students see this exact order — top to bottom, across every exam.</p>
          {groups.map((g, gi) => (
            <div key={g.key} className="reorder-group">
              <div className="reorder-group-head">
                <strong>{g.key}</strong>
                <div className="reorder-controls">
                  <button className="btn btn-ghost btn-sm" disabled={busyOrder || gi === 0} onClick={() => moveGroup(gi, -1)}>↑ Topic</button>
                  <button className="btn btn-ghost btn-sm" disabled={busyOrder || gi === groups.length - 1} onClick={() => moveGroup(gi, 1)}>↓ Topic</button>
                </div>
              </div>
              {g.items.map((n, ii) => (
                <div key={n.id} className="reorder-item">
                  <span>{n.title}{n.is_premium ? " · Paid" : ""}</span>
                  <div className="reorder-controls">
                    <button className="btn btn-ghost btn-sm" disabled={busyOrder || ii === 0} onClick={() => moveItem(gi, ii, -1)}>↑</button>
                    <button className="btn btn-ghost btn-sm" disabled={busyOrder || ii === g.items.length - 1} onClick={() => moveItem(gi, ii, 1)}>↓</button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {notes && !reorderMode && (
        <div className="admin-list">
          {notes.map((n) => (
            <div key={n.id} className="admin-list-row">
              <div>
                <strong>{n.title}</strong>
                <span className="admin-list-meta">
                  {n.exam} · {n.subject} — {n.unit}{n.is_premium ? " · Paid" : ""}{n.is_preview ? " · Preview" : ""}
                </span>
              </div>
              <div className="admin-list-actions">
                <button className="btn btn-ghost btn-sm" onClick={() => handleEdit(n)}>Edit</button>
                <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(n)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NoteForm({ editing, onDone, onCancelEdit }) {
  const [form, setForm] = useState(() => editing
    ? { exam: editing.exam, subject: editing.subject, unit: editing.unit, title: editing.title, content: editing.content, is_premium: editing.is_premium, is_preview: !!editing.is_preview }
    : { exam: "", subject: "", unit: "", title: "", content: "", is_premium: false, is_preview: false }
  );
  const [busy, setBusy] = useState(false);
  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const isEditing = !!editing;

  // Subject drives which units are offered — switching subject resets unit to
  // that subject's first canonical unit so the two fields can never fall out
  // of sync with each other.
  function updateSubject(subject) {
    const firstUnit = (UNITS[subject] || [])[0] || "";
    setForm((f) => ({ ...f, subject, unit: firstUnit }));
  }

  function updatePremium(isPremium) {
    // A note can't be both "Paid plan only" and a free guest preview.
    setForm((f) => ({ ...f, is_premium: isPremium, is_preview: isPremium ? false : f.is_preview }));
  }

  // Existing notes saved before this taxonomy existed (or with a typo) may
  // hold a subject/unit that isn't in the canonical list. Rather than
  // silently swapping it out from under the admin when they open it to edit,
  // keep it as an extra selectable option, clearly marked, until they
  // consciously pick a canonical one.
  const subjectOptions = form.subject && !SUBJECTS.includes(form.subject)
    ? [form.subject, ...SUBJECTS] : SUBJECTS;
  const unitsForSubject = UNITS[form.subject] || [];
  const unitOptions = form.unit && !unitsForSubject.includes(form.unit)
    ? [form.unit, ...unitsForSubject] : unitsForSubject;

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      if (isEditing) {
        await api.updateNote(editing.id, form);
        onDone("Note updated.");
      } else {
        await api.createNote(form);
        onDone("Note added.");
        setForm({ exam: form.exam, subject: form.subject, unit: form.unit, title: "", content: "", is_premium: form.is_premium, is_preview: form.is_preview });
      }
    } catch (err) {
      onDone(err.message);
    } finally { setBusy(false); }
  }

  return (
    <form className="form" onSubmit={submit}>
      <ExamDatalist />
      {isEditing && <p className="form-note">Editing "{editing.title}"</p>}
      <div className="form-row">
        <label>Exam<input list="exam-suggestions" required value={form.exam} onChange={(e) => update("exam", e.target.value)} placeholder="CSIR NET, GATE, DU..." /></label>
        <label>Subject
          <select required value={form.subject} onChange={(e) => updateSubject(e.target.value)}>
            <option value="" disabled>Select subject…</option>
            {subjectOptions.map((s) => <option key={s} value={s}>{s}{form.subject === s && !SUBJECTS.includes(s) ? " (not in taxonomy)" : ""}</option>)}
          </select>
        </label>
      </div>
      <label>Topic / Unit (subsection)
        <select required value={form.unit} onChange={(e) => update("unit", e.target.value)} disabled={!form.subject}>
          <option value="" disabled>{form.subject ? "Select topic…" : "Choose a subject first"}</option>
          {unitOptions.map((u) => <option key={u} value={u}>{u}{form.unit === u && !unitsForSubject.includes(u) ? " (not in taxonomy)" : ""}</option>)}
        </select>
      </label>
      <label>Title<input required value={form.title} onChange={(e) => update("title", e.target.value)} /></label>
      <label>Content<textarea required rows={10} value={form.content} onChange={(e) => update("content", e.target.value)} /></label>
      <p className="field-hint">Formatting works here: ## heading, **bold**, * bullet list, $E=mc^2$ inline math, $$...$$ block math, or paste an image link directly.</p>
      <div className="form-row">
        <label style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <input type="checkbox" checked={form.is_preview} disabled={form.is_premium} onChange={(e) => update("is_preview", e.target.checked)} style={{ width: "auto" }} />
          Show to visitors without logging in (free preview)
        </label>
        <label style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <input type="checkbox" checked={form.is_premium} onChange={(e) => updatePremium(e.target.checked)} style={{ width: "auto" }} />
          Paid plan only
        </label>
      </div>
      <div className="form-row">
        <button className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : isEditing ? "Update note" : "Add note"}</button>
        {isEditing && <button type="button" className="btn btn-ghost" onClick={onCancelEdit}>Cancel</button>}
      </div>
    </form>
  );
}

// ============================================================================
// PYQs
// ============================================================================
function PYQManager({ onDone }) {
  const [pyqs, setPyqs] = useState(null);
  const [editing, setEditing] = useState(null);

  async function refresh() {
    try { setPyqs((await api.listPYQs()).pyqs); } catch (err) { onDone(err.message); }
  }
  useEffect(() => { refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleDelete(q) {
    if (!window.confirm(`Delete this ${q.year} question? This can't be undone.`)) return;
    try { await api.deletePYQ(q.id); onDone("Question deleted."); refresh(); } catch (err) { onDone(err.message); }
  }

  return (
    <div>
      <PYQForm
        key={editing?.id ?? "new"}
        editing={editing}
        onCancelEdit={() => setEditing(null)}
        onDone={(msg) => { onDone(msg); setEditing(null); refresh(); }}
      />
      <h2 className="section-heading">Existing questions</h2>
      {!pyqs && <p className="page-loading">Loading…</p>}
      {pyqs && pyqs.length === 0 && <p className="empty-state">No questions yet.</p>}
      <div className="admin-list">
        {pyqs && pyqs.map((q) => (
          <div key={q.id} className="admin-list-row">
            <div>
              <strong>{(q.content || "").length > 70 ? q.content.slice(0, 70) + "…" : q.content}</strong>
              <span className="admin-list-meta">
                {q.exam} {q.year}{q.session ? ` (${q.session})` : ""} · Part {q.part} · {q.subject}
                {q.is_premium ? " · Paid" : ""}{q.is_preview ? " · Preview" : ""}
              </span>
            </div>
            <div className="admin-list-actions">
              <button className="btn btn-ghost btn-sm" onClick={() => setEditing(q)}>Edit</button>
              <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(q)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PYQForm({ editing, onDone, onCancelEdit }) {
  const [form, setForm] = useState(() => editing
    ? { exam: editing.exam, subject: editing.subject, year: editing.year, session: editing.session || "", part: editing.part, content: editing.content, is_premium: editing.is_premium, is_preview: !!editing.is_preview }
    : { exam: "", subject: "", year: new Date().getFullYear(), session: "", part: "A", content: "", is_premium: false, is_preview: false }
  );
  const [busy, setBusy] = useState(false);
  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const isEditing = !!editing;

  function updatePremium(isPremium) {
    setForm((f) => ({ ...f, is_premium: isPremium, is_preview: isPremium ? false : f.is_preview }));
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      if (isEditing) {
        await api.updatePYQ(editing.id, form);
        onDone("Question updated.");
      } else {
        await api.createPYQ(form);
        onDone("Question added.");
        setForm((f) => ({ ...f, content: "" }));
      }
    } catch (err) {
      onDone(err.message);
    } finally { setBusy(false); }
  }

  return (
    <form className="form" onSubmit={submit}>
      <ExamDatalist />
      <SessionDatalist />
      {isEditing && <p className="form-note">Editing the {editing.year} Part {editing.part} question</p>}
      <div className="form-row">
        <label>Exam<input list="exam-suggestions" required value={form.exam} onChange={(e) => update("exam", e.target.value)} placeholder="CSIR NET, GATE, DU..." /></label>
        <label>Subject<input required value={form.subject} onChange={(e) => update("subject", e.target.value)} placeholder="Physics, Chemistry..." /></label>
      </div>
      <div className="form-row">
        <label>Year<input required type="number" value={form.year} onChange={(e) => update("year", Number(e.target.value))} /></label>
        <label>Session (optional)
          <input list="session-suggestions" value={form.session} onChange={(e) => update("session", e.target.value)} placeholder="June, December…" />
        </label>
        <label>Part
          <select value={form.part} onChange={(e) => update("part", e.target.value)}>
            <option value="A">A</option><option value="B">B</option><option value="C">C</option>
          </select>
        </label>
      </div>
      <p className="field-hint">Leave Session blank for an exam that runs once a year. Fill it in for exams like CSIR NET, which is held twice a year, so both papers from the same year stay distinct.</p>
      <label>Content<textarea required rows={10} value={form.content} onChange={(e) => update("content", e.target.value)} /></label>
      <p className="field-hint">One box for everything — question, options, and the answer. Formatting works the same as Notes: ## heading, **bold**, * bullet list, $E=mc^2$ inline math, $$...$$ block math, or paste an image link directly. Since there's no separate answer field anymore, students will see the whole thing at once (no "reveal answer" step) — so write it the way you'd want it read straight through, e.g.:</p>
      <pre className="field-example">{`Which organelle is the primary site of ATP synthesis?

A) Golgi apparatus
B) Mitochondrion
C) Peroxisome
D) Lysosome

**Answer: B**

The inner mitochondrial membrane houses the electron transport chain.`}</pre>
      <div className="form-row">
        <label style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <input type="checkbox" checked={form.is_preview} disabled={form.is_premium} onChange={(e) => update("is_preview", e.target.checked)} style={{ width: "auto" }} />
          Show to visitors without logging in (free preview)
        </label>
        <label style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <input type="checkbox" checked={form.is_premium} onChange={(e) => updatePremium(e.target.checked)} style={{ width: "auto" }} />
          Paid plan only
        </label>
      </div>
      <div className="form-row">
        <button className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : isEditing ? "Update question" : "Add question"}</button>
        {isEditing && <button type="button" className="btn btn-ghost" onClick={onCancelEdit}>Cancel</button>}
      </div>
    </form>
  );
}

// ============================================================================
// Mock Tests
// ============================================================================
function TestManager({ onDone }) {
  const [tests, setTests] = useState(null);
  const [editing, setEditing] = useState(null);

  async function refresh() {
    try { setTests((await api.listTests()).tests); } catch (err) { onDone(err.message); }
  }
  useEffect(() => { refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleEdit(t) {
    try {
      const { test, questions } = await api.getTest(t.id);
      setEditing({ ...test, questions });
    } catch (err) { onDone(err.message); }
  }

  async function handleDelete(t) {
    if (!window.confirm(`Delete "${t.title}"? This also removes its questions and any student attempts. This can't be undone.`)) return;
    try { await api.deleteTest(t.id); onDone("Mock test deleted."); refresh(); } catch (err) { onDone(err.message); }
  }

  return (
    <div>
      <TestForm
        key={editing?.id ?? "new"}
        editing={editing}
        onCancelEdit={() => setEditing(null)}
        onDone={(msg) => { onDone(msg); setEditing(null); refresh(); }}
      />
      <h2 className="section-heading">Existing mock tests</h2>
      {!tests && <p className="page-loading">Loading…</p>}
      {tests && tests.length === 0 && <p className="empty-state">No mock tests yet.</p>}
      <div className="admin-list">
        {tests && tests.map((t) => (
          <div key={t.id} className="admin-list-row">
            <div>
              <strong>{t.title}</strong>
              <span className="admin-list-meta">{t.exam} · {t.subject} · {t.question_count} questions{t.is_premium ? " · Paid" : ""}</span>
            </div>
            <div className="admin-list-actions">
              <button className="btn btn-ghost btn-sm" onClick={() => handleEdit(t)}>Edit</button>
              <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(t)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TestForm({ editing, onDone, onCancelEdit }) {
  const [form, setForm] = useState(() => editing
    ? { exam: editing.exam, subject: editing.subject, title: editing.title, duration_minutes: editing.duration_minutes, is_premium: editing.is_premium }
    : { exam: "", subject: "", title: "", duration_minutes: 180, is_premium: false }
  );
  const [questionsJson, setQuestionsJson] = useState(() => editing
    ? JSON.stringify(editing.questions.map(({ part, question, option_a, option_b, option_c, option_d, correct_option, marks, negative_marks }) =>
        ({ part, question, option_a, option_b, option_c, option_d, correct_option, marks, negative_marks })), null, 2)
    : SAMPLE_QUESTIONS_JSON
  );
  const [busy, setBusy] = useState(false);
  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const isEditing = !!editing;

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const questions = JSON.parse(questionsJson);
      if (isEditing) {
        await api.updateTest(editing.id, { ...form, questions });
        onDone("Mock test updated.");
      } else {
        await api.createTest({ ...form, questions });
        onDone(`Mock test created with ${questions.length} questions.`);
      }
    } catch (err) {
      onDone(err.message.includes("JSON") ? "The questions field isn't valid JSON — check the format." : err.message);
    } finally { setBusy(false); }
  }

  return (
    <form className="form" onSubmit={submit}>
      <ExamDatalist />
      {isEditing && <p className="form-note">Editing "{editing.title}" — saving replaces all its questions with what's below.</p>}
      <div className="form-row">
        <label>Exam<input list="exam-suggestions" required value={form.exam} onChange={(e) => update("exam", e.target.value)} placeholder="CSIR NET, GATE, DU..." /></label>
        <label>Subject<input required value={form.subject} onChange={(e) => update("subject", e.target.value)} placeholder="Physics, Chemistry..." /></label>
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
      <div className="form-row">
        <button className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : isEditing ? "Update mock test" : "Create mock test"}</button>
        {isEditing && <button type="button" className="btn btn-ghost" onClick={onCancelEdit}>Cancel</button>}
      </div>
    </form>
  );
}

// ============================================================================
// Students
// ============================================================================
function StudentsPanel({ onDone }) {
  const [students, setStudents] = useState(null);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
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
