import React, { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api.js";
import { EXAMS, EXAM_SECTIONS, SUBJECTS, UNITS, QUESTION_TYPES } from "../../lib/taxonomy.js";
import { PERIODS, PLAN_IDS, effectivePlan, formatPrice, planName } from "../../lib/plans.js";
import { parseDriveFileId } from "../../lib/drivePdf.js";
import { safeUrl } from "../../lib/links.js";
import { DOWNLOAD_CATEGORIES, SOCIALS, orderCategories } from "../../lib/social.js";
import { parseQuestionBank, questionToText, SAMPLE_QB_TEXT } from "../../lib/qbParser.js";
import usePlans, { usePlanNames } from "../../context/usePlans.jsx";
import ContentEditor from "../ContentEditor.jsx";
import RichContent from "../RichContent.jsx";

const checkStyle = { flexDirection: "row", alignItems: "center", gap: 8 };
const fmtDate = (d) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

function ExamList() {
  return <datalist id="exam-list-x">{EXAMS.map((e) => <option key={e} value={e} />)}</datalist>;
}

// "Which plan unlocks this?" — used by notes, mock tests and questions.
export function PlanSelect({ value, onChange, label = "Included from plan" }) {
  usePlanNames();
  return (
    <label>{label}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {PLAN_IDS.map((id) => (
          <option key={id} value={id}>{id === "free" ? "Free — any signed-in student" : `${planName(id)} and above`}</option>
        ))}
      </select>
    </label>
  );
}

// ============================================================================
// Plans & prices
// ============================================================================
export function PlansManager({ onDone }) {
  const { refresh: refreshPlans } = usePlans();
  const [plans, setPlans] = useState(null);
  const [busy, setBusy] = useState(null);

  useEffect(() => { api.listPlans().then((d) => setPlans(d.plans)).catch((e) => onDone(e.message)); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (id, k, v) => setPlans((list) => list.map((p) => (p.id === id ? { ...p, [k]: v } : p)));

  async function save(p) {
    setBusy(p.id);
    try {
      const num = (v) => (v === "" || v === null || v === undefined ? null : Number(v));
      await api.updatePlan(p.id, {
        name: p.name, is_popular: !!p.is_popular, is_active: !!p.is_active,
        price_monthly: num(p.price_monthly), price_quarterly: num(p.price_quarterly),
        price_half_yearly: num(p.price_half_yearly), price_yearly: num(p.price_yearly),
      });
      refreshPlans();
      onDone(`${p.name} saved.`);
    } catch (e) { onDone(e.message); } finally { setBusy(null); }
  }

  if (!plans) return <p className="page-loading">Loading plans…</p>;
  return (
    <div>
      <p className="page-sub">Leave a price empty to hide that billing period. A period appears on the site as soon as any paid plan has a price for it.</p>
      <div className="admin-list">
        {plans.map((p) => (
          <div key={p.id} className="form" style={{ marginBottom: 16 }}>
            <div className="form-row">
              <label>Name<input value={p.name} onChange={(e) => set(p.id, "name", e.target.value)} /></label>
              <label style={checkStyle}><input type="checkbox" style={{ width: "auto" }} checked={p.is_popular} onChange={(e) => set(p.id, "is_popular", e.target.checked)} /> Highlight as most popular</label>
              <label style={checkStyle}><input type="checkbox" style={{ width: "auto" }} checked={p.is_active} onChange={(e) => set(p.id, "is_active", e.target.checked)} /> Show on site</label>
            </div>
            {p.id !== "free" && (
              <div className="form-row">
                {PERIODS.map((per) => (
                  <label key={per.id}>{per.label} price (₹)
                    <input type="number" min="0" value={p[per.column] ?? ""} onChange={(e) => set(p.id, per.column, e.target.value)} />
                  </label>
                ))}
              </div>
            )}
            <div className="form-row"><button className="btn btn-primary btn-sm" disabled={busy === p.id} onClick={() => save(p)}>{busy === p.id ? "Saving…" : `Save ${p.name}`}</button></div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Subscriptions: pending requests + manual plan changes
// ============================================================================
export function SubscriptionsManager({ onDone }) {
  const [requests, setRequests] = useState(null);
  const [students, setStudents] = useState(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(null);
  const [grant, setGrant] = useState({}); // userId -> { plan, months }

  const load = () => {
    api.listSubscriptionRequests().then((d) => setRequests(d.requests)).catch((e) => onDone(e.message));
    api.listStudents().then((d) => setStudents(d.students)).catch((e) => onDone(e.message));
  };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function decide(r, approve) {
    setBusy(`r${r.id}`);
    try {
      await api.decideSubscription(r.id, approve);
      onDone(approve ? "Plan activated for the student." : "Request declined.");
      load();
    } catch (e) { onDone(e.message); } finally { setBusy(null); }
  }

  async function apply(s, plan, months) {
    setBusy(s.id);
    try {
      await api.adminGrantPlan(s.id, plan, months);
      onDone(plan === "free" ? `${s.name} moved to Free.` : `${s.name} is now on ${planName(plan)}.`);
      load();
    } catch (e) { onDone(e.message); } finally { setBusy(null); }
  }

  const pending = (requests || []).filter((r) => r.status === "pending");
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (students || []).filter((s) => !q || `${s.name} ${s.email} ${s.phone || ""}`.toLowerCase().includes(q));
  }, [students, query]);

  // Spreadsheet of the (filtered) student list: opens in Excel / Google Sheets.
  function exportCsv() {
    // Names and phone numbers are typed by students. A leading = + - @ would make
    // Excel treat the cell as a formula ("+91…" shows as an error, "=HYPERLINK(…)"
    // could run), so such values get an invisible tab in front and stay text.
    const cell = (v) => {
      let t = String(v ?? "");
      if (/^[=+\-@]/.test(t)) t = `\t${t}`;
      return `"${t.replace(/"/g, '""')}"`;
    };
    const rows = [["Name", "Email", "Phone", "Plan", "Plan ends", "Role", "Joined"]].concat(
      shown.map((s) => [s.name, s.email, s.phone || "", planName(effectivePlan(s)),
        s.plan_expires_at ? fmtDate(s.plan_expires_at) : "", s.role, s.created_at ? fmtDate(s.created_at) : ""]),
    );
    const blob = new Blob(["\ufeff" + rows.map((r) => r.map(cell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `axion-students-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  return (
    <div>
      <h3>Waiting for confirmation ({pending.length})</h3>
      {requests === null && <p className="page-loading">Loading…</p>}
      {requests && pending.length === 0 && <p className="empty-state">No requests waiting.</p>}
      <div className="admin-list">
        {pending.map((r) => (
          <div key={r.id} className="admin-list-row">
            <div>
              <strong>{r.profiles?.name || "Student"} · {planName(r.plan)} · {PERIODS.find((p) => p.id === r.period)?.label}</strong>
              <span className="admin-list-meta">
                {r.profiles?.email} · {r.amount != null ? `${formatPrice(r.amount)} · ` : ""}ref: {r.payment_ref || "none given"} · {fmtDate(r.created_at)}
              </span>
            </div>
            <div className="admin-list-actions">
              <button className="btn btn-primary btn-sm" disabled={busy === `r${r.id}`} onClick={() => decide(r, true)}>Payment received — activate</button>
              <button className="btn btn-ghost btn-sm" disabled={busy === `r${r.id}`} onClick={() => decide(r, false)}>Decline</button>
            </div>
          </div>
        ))}
      </div>

      <div className="admin-subhead">
        <h3>Students{students ? ` (${students.length})` : ""}</h3>
        <div className="admin-subhead-tools">
          <input className="search-input" type="search" placeholder="Search name, email or phone" value={query} onChange={(e) => setQuery(e.target.value)} />
          <button type="button" className="btn btn-ghost btn-sm" onClick={exportCsv} disabled={!shown.length}>Download list (CSV)</button>
        </div>
      </div>
      {!students && <p className="page-loading">Loading…</p>}
      <div className="admin-list">
        {shown.map((s) => {
          const eff = effectivePlan(s);
          const g = grant[s.id] || { plan: "notes_mock", months: 3 };
          return (
            <div key={s.id} className="admin-list-row" style={{ flexWrap: "wrap" }}>
              <div>
                <strong>{s.name}{s.role === "admin" && " (admin)"}</strong>
                <span className="admin-list-meta">
                  {s.email}{s.phone ? <> · <a href={`tel:${s.phone.replace(/[^\d+]/g, "")}`}>{s.phone}</a></> : ""} · {planName(eff)}
                  {eff !== "free" && s.plan_expires_at ? ` until ${fmtDate(s.plan_expires_at)}` : eff !== "free" ? " · no expiry" : s.plan !== "free" ? " · expired" : ""}
                </span>
              </div>
              {s.role !== "admin" && (
                <div className="admin-list-actions">
                  <select value={g.plan} onChange={(e) => setGrant((m) => ({ ...m, [s.id]: { ...g, plan: e.target.value } }))}>
                    {PLAN_IDS.filter((id) => id !== "free").map((id) => <option key={id} value={id}>{planName(id)}</option>)}
                  </select>
                  <select value={g.months} onChange={(e) => setGrant((m) => ({ ...m, [s.id]: { ...g, months: Number(e.target.value) } }))}>
                    {PERIODS.map((p) => <option key={p.id} value={p.months}>{p.label}</option>)}
                  </select>
                  <button className="btn btn-primary btn-sm" disabled={busy === s.id} onClick={() => apply(s, g.plan, g.months)}>Grant</button>
                  {s.plan !== "free" && <button className="btn btn-ghost btn-sm" disabled={busy === s.id} onClick={() => apply(s, "free", 0)}>Revoke</button>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// Previous-year papers (Drive PDFs)
// ============================================================================
export function PapersManager({ onDone }) {
  const blank = { exam: "", year: new Date().getFullYear(), session: "", subject: "Physics", title: "", paper_url: "", key_url: "", is_active: true };
  const [papers, setPapers] = useState(null);
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);
  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const refresh = () => api.listPapers().then((d) => setPapers(d.papers)).catch((e) => onDone(e.message));
  useEffect(() => { refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const paperOk = !form.paper_url || !!parseDriveFileId(form.paper_url);
  const keyOk = !form.key_url || !!parseDriveFileId(form.key_url);

  async function submit(e) {
    e.preventDefault();
    if (!parseDriveFileId(form.paper_url)) { onDone("The question-paper link is not a Google Drive file link."); return; }
    if (!keyOk) { onDone("The answer-key link is not a Google Drive file link."); return; }
    setBusy(true);
    try {
      const payload = { ...form, year: Number(form.year), session: form.session || null, title: form.title || null, key_url: form.key_url || null };
      if (editingId) { await api.updatePaper(editingId, payload); onDone("Paper updated."); }
      else { await api.createPaper(payload); onDone("Paper added."); }
      setForm({ ...blank, exam: form.exam, year: form.year }); setEditingId(null); refresh();
    } catch (err) { onDone(err.message); } finally { setBusy(false); }
  }

  async function remove(p) {
    if (!window.confirm(`Delete ${p.exam} ${p.year}? The PDF in Google Drive is not touched.`)) return;
    try { await api.deletePaper(p.id); onDone("Paper removed."); refresh(); } catch (err) { onDone(err.message); }
  }

  return (
    <div>
      <ExamList />
      <form className="form" onSubmit={submit}>
        {editingId && <p className="form-note">Editing a paper — <button type="button" className="link-btn" onClick={() => { setEditingId(null); setForm(blank); }}>cancel</button></p>}
        <div className="form-row">
          <label>Exam<input list="exam-list-x" required value={form.exam} onChange={(e) => update("exam", e.target.value)} /></label>
          <label>Year<input type="number" required value={form.year} onChange={(e) => update("year", e.target.value)} /></label>
          <label>Session (optional)<input value={form.session} onChange={(e) => update("session", e.target.value)} placeholder="June / December" /></label>
        </div>
        <div className="form-row">
          <label>Subject / paper<input required value={form.subject} onChange={(e) => update("subject", e.target.value)} /></label>
          <label>Label (optional)<input value={form.title} onChange={(e) => update("title", e.target.value)} placeholder="e.g. Physical Sciences, Booklet A" /></label>
        </div>
        <label>Question paper — Google Drive link
          <input required value={form.paper_url} onChange={(e) => update("paper_url", e.target.value)} placeholder="https://drive.google.com/file/d/…/view?usp=sharing" />
        </label>
        {!paperOk && <p className="form-error">That doesn't look like a Google Drive file link.</p>}
        <label>Answer key — Google Drive link (optional)
          <input value={form.key_url} onChange={(e) => update("key_url", e.target.value)} />
        </label>
        {!keyOk && <p className="form-error">That doesn't look like a Google Drive file link.</p>}
        <p className="field-hint">In Drive: right-click the PDF → Share → "Anyone with the link" → Viewer → Copy link. The paper then opens inside the site.</p>
        <label style={checkStyle}><input type="checkbox" style={{ width: "auto" }} checked={form.is_active} onChange={(e) => update("is_active", e.target.checked)} /> Visible to students</label>
        <button className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : editingId ? "Update paper" : "Add paper"}</button>
      </form>

      {!papers && <p className="page-loading">Loading…</p>}
      <div className="admin-list">
        {(papers || []).map((p) => (
          <div key={p.id} className="admin-list-row">
            <div>
              <strong>{p.exam} {p.year}{p.session ? ` · ${p.session}` : ""}</strong>
              <span className="admin-list-meta">{p.title || p.subject}{p.key_url ? " · answer key" : ""}{p.is_active ? "" : " · hidden"}</span>
            </div>
            <div className="admin-list-actions">
              <button className="btn btn-ghost btn-sm" onClick={() => { setEditingId(p.id); setForm({ exam: p.exam, year: p.year, session: p.session || "", subject: p.subject, title: p.title || "", paper_url: p.paper_url, key_url: p.key_url || "", is_active: p.is_active }); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Edit</button>
              <button className="btn btn-ghost btn-sm" onClick={() => remove(p)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Exam information
// ============================================================================
export function ExamInfoManager({ onDone }) {
  const blank = { exam: "", section: "pattern", title: "", body: "", sort_order: 0, is_active: true };
  const [items, setItems] = useState(null);
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState(null);
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const refresh = () => api.listExamInfo().then((d) => setItems(d.items)).catch((e) => onDone(e.message));
  useEffect(() => { refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const examNames = useMemo(() => [...new Set([...(items || []).map((i) => i.exam)])], [items]);
  const shown = (items || []).filter((i) => !filter || i.exam === filter);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = { ...form, sort_order: Number(form.sort_order) || 0 };
      if (editingId) { await api.updateExamInfo(editingId, payload); onDone("Saved."); }
      else { await api.createExamInfo(payload); onDone("Added."); }
      setForm({ ...blank, exam: form.exam, section: form.section }); setEditingId(null); refresh();
    } catch (err) { onDone(err.message); } finally { setBusy(false); }
  }

  async function remove(i) {
    if (!window.confirm(`Delete "${i.title}"?`)) return;
    try { await api.deleteExamInfo(i.id); onDone("Deleted."); refresh(); } catch (err) { onDone(err.message); }
  }

  return (
    <div>
      <ExamList />
      <form className="form" onSubmit={submit}>
        {editingId && <p className="form-note">Editing "{form.title}" — <button type="button" className="link-btn" onClick={() => { setEditingId(null); setForm(blank); }}>cancel</button></p>}
        <div className="form-row">
          <label>Exam<input list="exam-list-x" required value={form.exam} onChange={(e) => update("exam", e.target.value)} /></label>
          <label>Section
            <select value={form.section} onChange={(e) => update("section", e.target.value)}>
              {EXAM_SECTIONS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </label>
          <label>Order<input type="number" value={form.sort_order} onChange={(e) => update("sort_order", e.target.value)} /></label>
        </div>
        <label>Title<input required value={form.title} onChange={(e) => update("title", e.target.value)} placeholder={form.section === "faq" ? "The question" : form.section === "syllabus" ? "Unit name" : "e.g. Marking scheme"} /></label>
        <ContentEditor id="examinfo-body" value={form.body} onChange={(v) => update("body", v)} rows={9}>
          <p className="field-hint">Works like notes: tables (use "Insert table"), **bold**, lists, $math$. FAQ and Syllabus entries show as expandable items; other sections show as cards. Check every figure against the official notification before publishing.</p>
        </ContentEditor>
        <label style={checkStyle}><input type="checkbox" style={{ width: "auto" }} checked={form.is_active} onChange={(e) => update("is_active", e.target.checked)} /> Visible to students</label>
        <button className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : editingId ? "Update" : "Add"}</button>
      </form>

      {examNames.length > 1 && (
        <select className="filter-select" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ margin: "12px 0" }}>
          <option value="">All exams</option>
          {examNames.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      )}
      {!items && <p className="page-loading">Loading…</p>}
      <div className="admin-list">
        {shown.map((i) => (
          <div key={i.id} className="admin-list-row">
            <div>
              <strong>{i.title}</strong>
              <span className="admin-list-meta">{i.exam} · {EXAM_SECTIONS.find((s) => s.id === i.section)?.label}{i.is_active ? "" : " · hidden"}</span>
            </div>
            <div className="admin-list-actions">
              <button className="btn btn-ghost btn-sm" onClick={() => { setEditingId(i.id); setForm({ exam: i.exam, section: i.section, title: i.title, body: i.body, sort_order: i.sort_order, is_active: i.is_active }); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Edit</button>
              <button className="btn btn-ghost btn-sm" onClick={() => remove(i)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Question bank
// ============================================================================
export function QuestionBankManager({ onDone }) {
  const [meta, setMeta] = useState({ exam: "", subject: "", unit: "", min_plan: "notes_mock", is_preview: false });
  const [text, setText] = useState(SAMPLE_QB_TEXT);
  const [busy, setBusy] = useState(false);
  const [list, setList] = useState(null);
  const [editing, setEditing] = useState(null); // { id, text, meta }
  const [filter, setFilter] = useState({ exam: "", subject: "", unit: "" });
  const setM = (k, v) => setMeta((m) => ({ ...m, [k]: v }));

  const parsed = useMemo(() => parseQuestionBank(text), [text]);
  const units = UNITS[meta.subject] || [];

  const refresh = () => api.adminListQuestions(filter).then((d) => setList(d.questions)).catch((e) => onDone(e.message));
  useEffect(() => { refresh(); }, [filter.exam, filter.subject, filter.unit]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save(e) {
    e.preventDefault();
    if (parsed.errors.length) { onDone(`Fix these first — ${parsed.errors.join(" ")}`); return; }
    if (!parsed.questions.length) { onDone("No questions found in the box."); return; }
    setBusy(true);
    try {
      const { count } = await api.createQuestions(parsed.questions, meta);
      onDone(`${count} question${count === 1 ? "" : "s"} added to ${meta.unit}.`);
      setText(""); refresh();
    } catch (err) { onDone(err.message); } finally { setBusy(false); }
  }

  async function saveEdit(e) {
    e.preventDefault();
    const p = parseQuestionBank(editing.text);
    if (p.errors.length || p.questions.length !== 1) { onDone(p.errors.join(" ") || "Edit exactly one question."); return; }
    setBusy(true);
    try {
      await api.updateQuestion(editing.id, p.questions[0], editing.meta);
      onDone("Question updated."); setEditing(null); refresh();
    } catch (err) { onDone(err.message); } finally { setBusy(false); }
  }

  async function remove(q) {
    if (!window.confirm("Delete this question?")) return;
    try { await api.deleteQuestion(q.id); onDone("Question deleted."); refresh(); } catch (err) { onDone(err.message); }
  }

  if (editing) {
    const m = editing.meta;
    const setE = (k, v) => setEditing((s) => ({ ...s, meta: { ...s.meta, [k]: v } }));
    return (
      <form className="form" onSubmit={saveEdit}>
        <p className="form-note">Editing a question — <button type="button" className="link-btn" onClick={() => setEditing(null)}>cancel</button></p>
        <div className="form-row">
          <label>Exam<input list="exam-list-x" required value={m.exam} onChange={(e) => setE("exam", e.target.value)} /></label>
          <label>Subject<select value={m.subject} onChange={(e) => setE("subject", e.target.value)}>{SUBJECTS.map((s) => <option key={s}>{s}</option>)}</select></label>
          <label>Topic<input value={m.unit} onChange={(e) => setE("unit", e.target.value)} /></label>
        </div>
        <PlanSelect value={m.min_plan} onChange={(v) => setE("min_plan", v)} />
        <label style={checkStyle}><input type="checkbox" style={{ width: "auto" }} checked={m.is_preview} disabled={m.min_plan !== "free"} onChange={(e) => setE("is_preview", e.target.checked)} /> Show to visitors without logging in</label>
        <textarea rows={12} value={editing.text} onChange={(e) => setEditing((s) => ({ ...s, text: e.target.value }))} />
        <button className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : "Save changes"}</button>
      </form>
    );
  }

  return (
    <div>
      <ExamList />
      <form className="form" onSubmit={save}>
        <div className="form-row">
          <label>Exam<input list="exam-list-x" required value={meta.exam} onChange={(e) => setM("exam", e.target.value)} placeholder="CSIR NET, GATE, JEST…" /></label>
          <label>Subject
            <select required value={meta.subject} onChange={(e) => { setM("subject", e.target.value); setM("unit", (UNITS[e.target.value] || [])[0] || ""); }}>
              <option value="" disabled>Select…</option>
              {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
        </div>
        <label>Topic
          <select required value={meta.unit} onChange={(e) => setM("unit", e.target.value)} disabled={!meta.subject}>
            <option value="" disabled>{meta.subject ? "Select topic…" : "Choose a subject first"}</option>
            {units.map((u) => <option key={u}>{u}</option>)}
          </select>
        </label>
        <div className="form-row">
          <PlanSelect value={meta.min_plan} onChange={(v) => setM("min_plan", v)} label="Available from plan (applies to every question below)" />
          <label style={checkStyle}><input type="checkbox" style={{ width: "auto" }} checked={meta.is_preview} disabled={meta.min_plan !== "free"} onChange={(e) => setM("is_preview", e.target.checked)} /> Show to visitors without logging in</label>
        </div>

        <label>Questions
          <textarea rows={14} value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} />
        </label>
        <p className="field-hint">
          One question after another, separated by a line with <code>---</code>. Start each with <code>Q:</code>, list options as <code>A) …</code>,
          then <code>Answer:</code> (<code>B</code> for MCQ, <code>A, C</code> for multiple-select, a number for numerical). Optional:
          <code> Difficulty:</code> easy/medium/hard, <code>Source:</code>, <code>Tolerance:</code> (numerical), <code>Explanation:</code>. Images, tables and $maths$ work as in notes.
        </p>
        <div className={parsed.errors.length ? "form-error" : "form-note"}>
          {parsed.errors.length
            ? parsed.errors.join(" ")
            : `${parsed.questions.length} question${parsed.questions.length === 1 ? "" : "s"} ready — ${QUESTION_TYPES.map((t) => `${parsed.questions.filter((q) => q.qtype === t.id).length} ${t.label}`).join(", ")}.`}
        </div>
        <button className="btn btn-primary" disabled={busy || parsed.errors.length > 0 || parsed.questions.length === 0}>{busy ? "Saving…" : `Add ${parsed.questions.length} question${parsed.questions.length === 1 ? "" : "s"}`}</button>
      </form>

      <h3 style={{ marginTop: 28 }}>Existing questions</h3>
      <div className="form-row">
        <input list="exam-list-x" placeholder="Filter by exam" value={filter.exam} onChange={(e) => setFilter((f) => ({ ...f, exam: e.target.value }))} />
        <select value={filter.subject} onChange={(e) => setFilter({ exam: filter.exam, subject: e.target.value, unit: "" })}>
          <option value="">All subjects</option>{SUBJECTS.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select value={filter.unit} onChange={(e) => setFilter((f) => ({ ...f, unit: e.target.value }))} disabled={!filter.subject}>
          <option value="">All topics</option>{(UNITS[filter.subject] || []).map((u) => <option key={u}>{u}</option>)}
        </select>
      </div>
      {!list && <p className="page-loading">Loading…</p>}
      {list && list.length === 0 && <p className="empty-state">No questions yet.</p>}
      <div className="admin-list">
        {(list || []).map((q) => (
          <div key={q.id} className="admin-list-row">
            <div style={{ minWidth: 0 }}>
              <strong style={{ display: "block", maxWidth: 560, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q.content.replace(/\s+/g, " ")}</strong>
              <span className="admin-list-meta">
                {q.exam} · {q.unit} · {QUESTION_TYPES.find((t) => t.id === q.qtype)?.label} · {q.difficulty} · {q.min_plan === "free" ? "Free" : planName(q.min_plan)}{q.is_preview ? " · Preview" : ""}
                {q.answer ? "" : " · NO ANSWER KEY"}
              </span>
            </div>
            <div className="admin-list-actions">
              <button className="btn btn-ghost btn-sm" onClick={() => setEditing({ id: q.id, text: questionToText(q, q.answer), meta: { exam: q.exam, subject: q.subject, unit: q.unit, min_plan: q.min_plan, is_preview: q.is_preview } })}>Edit</button>
              <button className="btn btn-ghost btn-sm" onClick={() => remove(q)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Site settings
// ============================================================================
const SOCIAL_HINTS = {
  instagram_url: "e.g. https://instagram.com/yourhandle",
  youtube_url: "e.g. https://youtube.com/@yourchannel",
  telegram_url: "e.g. https://t.me/yourchannel",
  whatsapp_url: "e.g. https://wa.me/91XXXXXXXXXX or a channel link",
  x_url: "e.g. https://x.com/yourhandle",
  linkedin_url: "e.g. https://linkedin.com/company/yourpage",
  facebook_url: "e.g. https://facebook.com/yourpage",
};

const SETTING_FIELDS = [
  { key: "support_email", label: "Support email", type: "input" },
  { key: "support_phone", label: "Support phone (optional)", type: "input" },
  ...SOCIALS.map((so) => ({ key: so.key, label: `${so.label} link (optional)`, type: "input", url: true, hint: SOCIAL_HINTS[so.key] })),
  { key: "payment_instructions", label: "How students pay", type: "textarea", rows: 6, hint: "Shown on the Subscribe page — e.g. your UPI ID, bank details, or a payment link, and what reference to send. Basic formatting works." },
  { key: "about_text", label: "About text (replaces the default introduction)", type: "textarea", rows: 6, hint: "Leave empty to use the built-in text." },
];

export function SettingsManager({ onDone }) {
  const [values, setValues] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.getSettings().then(setValues).catch((e) => onDone(e.message)); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!values) return <p className="page-loading">Loading…</p>;

  async function save(e) {
    e.preventDefault();
    const bad = SETTING_FIELDS.find((f) => f.url && (values[f.key] || "").trim() && !safeUrl(values[f.key]));
    if (bad) { onDone(`${bad.label}: please paste a full web address starting with https://`); return; }
    setBusy(true);
    try {
      await api.saveSettings(Object.fromEntries(SETTING_FIELDS.map((f) => [f.key, (values[f.key] || "").trim()])));
      onDone("Settings saved.");
    } catch (err) { onDone(err.message); } finally { setBusy(false); }
  }

  return (
    <form className="form" onSubmit={save}>
      {SETTING_FIELDS.map((f) => (
        <label key={f.key}>{f.label}
          {f.type === "textarea"
            ? <textarea rows={f.rows} value={values[f.key] || ""} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} />
            : <input value={values[f.key] || ""} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} />}
          {f.hint && <span className="field-hint">{f.hint}</span>}
        </label>
      ))}
      {values.payment_instructions && <div className="pay-box"><h3>Preview: how to pay</h3><RichContent text={values.payment_instructions} /></div>}
      <button className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : "Save settings"}</button>
    </form>
  );
}

// ============================================================================
// Support inbox
// ============================================================================
const KIND_LABEL = { query: "Question", feedback: "Feedback", technical: "Technical" };

export function MessagesManager({ onDone }) {
  const [messages, setMessages] = useState(null);
  const refresh = () => api.listSupportMessages().then((d) => setMessages(d.messages)).catch((e) => onDone(e.message));
  useEffect(() => { refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function toggle(m) {
    try { await api.setSupportStatus(m.id, m.status === "new" ? "resolved" : "new"); refresh(); } catch (e) { onDone(e.message); }
  }
  async function remove(m) {
    if (!window.confirm("Delete this message?")) return;
    try { await api.deleteSupportMessage(m.id); refresh(); } catch (e) { onDone(e.message); }
  }

  if (!messages) return <p className="page-loading">Loading…</p>;
  if (messages.length === 0) return <p className="empty-state">No messages yet.</p>;
  return (
    <div className="admin-list">
      {messages.map((m) => (
        <div key={m.id} className="admin-list-row" style={{ alignItems: "flex-start" }}>
          <div>
            <strong>{m.name} · {KIND_LABEL[m.kind]} {m.status === "new" && <span className="tier-badge tier-info">New</span>}</strong>
            <span className="admin-list-meta"><a href={`mailto:${m.email}`}>{m.email}</a> · {fmtDate(m.created_at)}</span>
            <p style={{ margin: "6px 0 0", whiteSpace: "pre-wrap" }}>{m.message}</p>
          </div>
          <div className="admin-list-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => toggle(m)}>{m.status === "new" ? "Mark resolved" : "Reopen"}</button>
            <button className="btn btn-ghost btn-sm" onClick={() => remove(m)}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  );
}


// ============================================================================
// Downloads (Drive links: papers, sample material, cheat sheets, anything else)
// ============================================================================
export function DownloadsManager({ onDone }) {
  const blank = { title: "", description: "", category: "Previous Year Papers", exam: "", link_url: "", min_plan: "free", sort_order: 0, is_active: true };
  const [items, setItems] = useState(null);
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);
  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const refresh = () => api.adminListDownloads().then((d) => setItems(d.items)).catch((e) => onDone(e.message));
  useEffect(() => { refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const categories = useMemo(() => orderCategories([...DOWNLOAD_CATEGORIES, ...(items || []).map((i) => i.category)]), [items]);
  const linkOk = !form.link_url || !!safeUrl(form.link_url);

  async function submit(e) {
    e.preventDefault();
    if (!safeUrl(form.link_url)) { onDone("Please paste a full web address (a Google Drive share link) starting with https://"); return; }
    setBusy(true);
    try {
      const payload = {
        title: form.title.trim(), description: form.description.trim() || null,
        category: form.category.trim() || "Other", exam: form.exam.trim() || null,
        link_url: form.link_url.trim(), min_plan: form.min_plan,
        sort_order: Number(form.sort_order) || 0, is_active: !!form.is_active,
      };
      if (editingId) { await api.updateDownload(editingId, payload); onDone("Download updated."); }
      else { await api.createDownload(payload); onDone("Download added."); }
      setForm({ ...blank, category: form.category, exam: form.exam, min_plan: form.min_plan }); setEditingId(null); refresh();
    } catch (err) { onDone(err.message); } finally { setBusy(false); }
  }

  async function remove(i) {
    if (!window.confirm(`Delete "${i.title}"? The file in Google Drive is not touched.`)) return;
    try { await api.deleteDownload(i.id); onDone("Download removed."); refresh(); } catch (err) { onDone(err.message); }
  }

  return (
    <div>
      <ExamList />
      <datalist id="download-categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
      <form className="form" onSubmit={submit}>
        {editingId && <p className="form-note">Editing "{form.title}" — <button type="button" className="link-btn" onClick={() => { setEditingId(null); setForm(blank); }}>cancel</button></p>}
        <div className="form-row">
          <label>Title<input required value={form.title} onChange={(e) => update("title", e.target.value)} placeholder="e.g. Classical Mechanics formula sheet" /></label>
          <label>Category
            <input list="download-categories" required value={form.category} onChange={(e) => update("category", e.target.value)} />
          </label>
        </div>
        <label>Short description (optional)<input value={form.description} onChange={(e) => update("description", e.target.value)} placeholder="One line shown on the card" /></label>
        <label>Google Drive link
          <input required value={form.link_url} onChange={(e) => update("link_url", e.target.value)} placeholder="https://drive.google.com/file/d/…/view?usp=sharing" />
        </label>
        {!linkOk && <p className="form-error">That doesn't look like a web address.</p>}
        <p className="field-hint">In Drive: right-click the file → Share → "Anyone with the link" → Viewer → Copy link. Students get an Open button and a Download button.</p>
        <div className="form-row">
          <label>Exam (optional)<input list="exam-list-x" value={form.exam} onChange={(e) => update("exam", e.target.value)} /></label>
          <PlanSelect value={form.min_plan} onChange={(v) => update("min_plan", v)} label="Available from plan" />
          <label>Order<input type="number" value={form.sort_order} onChange={(e) => update("sort_order", e.target.value)} /></label>
        </div>
        <label style={checkStyle}><input type="checkbox" style={{ width: "auto" }} checked={form.is_active} onChange={(e) => update("is_active", e.target.checked)} /> Visible to students</label>
        <button className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : editingId ? "Update download" : "Add download"}</button>
      </form>

      {!items && <p className="page-loading">Loading…</p>}
      {items && items.length === 0 && <p className="empty-state">Nothing added yet.</p>}
      <div className="admin-list">
        {(items || []).map((i) => (
          <div key={i.id} className="admin-list-row">
            <div>
              <strong>{i.title}</strong>
              <span className="admin-list-meta">{i.category}{i.exam ? ` · ${i.exam}` : ""} · {i.min_plan === "free" ? "Free" : planName(i.min_plan)}{i.is_active ? "" : " · hidden"}</span>
            </div>
            <div className="admin-list-actions">
              <button className="btn btn-ghost btn-sm" onClick={() => { setEditingId(i.id); setForm({ title: i.title, description: i.description || "", category: i.category, exam: i.exam || "", link_url: i.link_url, min_plan: i.min_plan, sort_order: i.sort_order, is_active: i.is_active }); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Edit</button>
              <button className="btn btn-ghost btn-sm" onClick={() => remove(i)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Notes: move a whole topic (or subject) to a plan in one step
// ============================================================================
export function NotesPlanBulk({ onDone }) {
  usePlanNames();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ exam: "", subject: "", unit: "", plan: "notes_mock" });
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const units = UNITS[f.subject] || [];

  async function apply(e) {
    e.preventDefault();
    if (!f.subject) { onDone("Choose a subject first."); return; }
    setBusy(true);
    try {
      const { notes } = await api.listNotes();
      const n = notes.filter((x) => (!f.exam || x.exam === f.exam) && x.subject === f.subject && (!f.unit || x.unit === f.unit)).length;
      if (n === 0) { onDone("No notes match that selection."); return; }
      const where = `${f.exam ? `${f.exam} › ` : ""}${f.subject}${f.unit ? ` › ${f.unit}` : ""}`;
      const label = f.plan === "free" ? "Free" : planName(f.plan);
      if (!window.confirm(`Move ${n} note${n === 1 ? "" : "s"} in ${where} to "${label}"?`)) return;
      const r = await api.setNotesPlan(f, f.plan);
      onDone(`${r.count} note${r.count === 1 ? "" : "s"} moved to ${label}.`);
    } catch (err) { onDone(err.message); } finally { setBusy(false); }
  }

  return (
    <details className="acc" open={open} onToggle={(e) => setOpen(e.currentTarget.open)} style={{ marginBottom: 16 }}>
      <summary>Move a whole topic to a plan</summary>
      <form className="form" onSubmit={apply}>
        <p className="field-hint">Choose a subject (and optionally one topic) and every note in it is moved to the plan you pick. You can still change a single note afterwards from its own Edit screen.</p>
        <div className="form-row">
          <label>Exam (optional)
            <select value={f.exam} onChange={(e) => set("exam", e.target.value)}><option value="">Any exam</option>{EXAMS.map((x) => <option key={x}>{x}</option>)}</select>
          </label>
          <label>Subject
            <select value={f.subject} onChange={(e) => { set("subject", e.target.value); set("unit", ""); }}>
              <option value="">Select…</option>{SUBJECTS.map((x) => <option key={x}>{x}</option>)}
            </select>
          </label>
          <label>Topic
            <select value={f.unit} onChange={(e) => set("unit", e.target.value)} disabled={!f.subject}>
              <option value="">Whole subject</option>{units.map((u) => <option key={u}>{u}</option>)}
            </select>
          </label>
        </div>
        <PlanSelect value={f.plan} onChange={(v) => set("plan", v)} label="Move to plan" />
        <button className="btn btn-primary" disabled={busy}>{busy ? "Moving…" : "Move notes"}</button>
      </form>
    </details>
  );
}
