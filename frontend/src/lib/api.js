import { supabase } from "./supabaseClient.js";
import { friendlyAuthError, isAlreadyRegistered } from "./authMessages.js";

async function currentAuthUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Not logged in.");
  return data.user;
}

async function fetchProfile(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, email, role, subject, plan, plan_expires_at")
    .eq("id", userId)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

async function saveMockTest(testId, test, questions) {
  const { data, error } = await supabase.rpc("save_mock_test", {
    p_test_id: testId,
    p_test: {
      exam: test.exam, subject: test.subject, title: test.title,
      duration_minutes: Number(test.duration_minutes),
      is_premium: !!test.is_premium, is_preview: !!test.is_preview,
      min_plan: test.min_plan, kind: test.kind,
    },
    p_questions: questions,
  });
  if (error) {
    if (/save_mock_test/i.test(error.message) && /(could not find|does not exist|schema cache)/i.test(error.message)) {
      throw new Error("The database needs a one-time update before tests can be saved. Use the \"Database update\" box at the top of Admin → Mock Tests: copy the SQL, run it in Supabase, then click \"Check again\".");
    }
    throw new Error(error.message);
  }
  return data;
}

function authError(error) {
  const f = friendlyAuthError(error);
  const e = new Error(f.message);
  e.code = f.code;
  return e;
}

// Keeps the older is_premium / is_preview flags in step with min_plan. The
// database does the same in a trigger; doing it here too means the admin
// screens never send a contradictory pair.
function withPlan(payload) {
  // Partial updates (e.g. only a note's position when re-ordering) must not
  // touch the plan, so only act when the caller actually set one.
  if (payload.min_plan === undefined) return payload;
  const min_plan = payload.min_plan || "free";
  const premium = min_plan !== "free";
  return { ...payload, min_plan, is_premium: premium, is_preview: premium ? false : !!payload.is_preview };
}

export const api = {
  // `phone` is optional extra contact information: it is stored as given (only
  // trimmed), never verified, and a sign-up never fails because of it. It
  // travels with the login's metadata, and the database copies it onto the
  // student's profile (migration 6).
  async register({ name, email, password, phone, subject }) {
    const meta = { name: name.trim() };
    if (subject) meta.subject = subject;
    const cleanPhone = (phone || "").trim().slice(0, 30);
    if (cleanPhone) meta.phone = cleanPhone;
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(), password, options: { data: meta }
    });
    if (error) throw authError(error);
    // An email that already has an account looks like a successful sign-up but
    // no confirmation email is sent, so don't tell the person to wait for one.
    if (isAlreadyRegistered(data.user)) {
      return { user: null, needsEmailConfirm: false, alreadyRegistered: true };
    }
    if (!data.session) {
      // Email confirmation is required by this Supabase project's settings.
      return { user: null, needsEmailConfirm: true };
    }
    const user = await fetchProfile(data.user.id);
    return { user, needsEmailConfirm: false };
  },

  async login({ email, password }) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw authError(error);
    const user = await fetchProfile(data.user.id);
    return { user };
  },

  // Sends the sign-up confirmation email again.
  async resendConfirmation(email) {
    const { error } = await supabase.auth.resend({ type: "signup", email });
    if (error) throw authError(error);
    return { ok: true };
  },

  async logout() {
    await supabase.auth.signOut();
  },

  async me() {
    const authUser = await currentAuthUser();
    const user = await fetchProfile(authUser.id);
    return { user };
  },

  // ---- Notes ----
  async listNotes() {
    const { data, error } = await supabase.rpc("list_notes_catalog");
    if (error) throw new Error(error.message);
    return { notes: data };
  },

  // For the "this note needs a plan" screen: the title and the plan it needs,
  // without any of the note's text.
  async noteMeta(id) {
    const { notes } = await this.listNotes();
    return notes.find((n) => String(n.id) === String(id)) || null;
  },

  // Guests may open a note that's flagged as a free preview; maybeSingle()
  // returns null (not an error) when a note either doesn't exist or is
  // outside what the current viewer's plan can see — the page then shows a
  // "log in" / "upgrade" prompt instead of a raw database error.
  async getNote(id) {
    const { data: note, error } = await supabase.from("notes").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!note) return { note: null, watermark: null, restricted: true };

    let watermark = null;
    try {
      const authUser = await currentAuthUser();
      const profile = await fetchProfile(authUser.id);
      watermark = `${profile.name} · ${profile.email} · ${new Date().toISOString()}`;
    } catch {
      watermark = "Guest preview · not for redistribution";
    }
    return { note, watermark, restricted: false };
  },

  async createNote(payload) {
    const { data, error } = await supabase.from("notes").insert(withPlan(payload)).select().single();
    if (error) throw new Error(error.message);
    return { id: data.id };
  },

  async updateNote(id, payload) {
    const { error } = await supabase.from("notes").update(withPlan(payload)).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  },

  async deleteNote(id) {
    const { error } = await supabase.from("notes").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  },

  // ---- Previous year questions ----
  async listPYQs(params = {}) {
    let query = supabase.from("pyqs").select("*").order("year", { ascending: false });
    if (params.year) query = query.eq("year", params.year);
    if (params.part) query = query.eq("part", params.part);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return { pyqs: data };
  },

  async createPYQ(payload) {
    const { data, error } = await supabase.from("pyqs").insert(payload).select().single();
    if (error) throw new Error(error.message);
    return { id: data.id };
  },

  async updatePYQ(id, payload) {
    const { error } = await supabase.from("pyqs").update(payload).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  },

  async deletePYQ(id) {
    const { error } = await supabase.from("pyqs").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  },

  // ---- Notice board ----
  // Row Level Security already limits what comes back: a signed-out visitor
  // only ever receives active notices; an admin calling this from the Admin
  // panel receives every notice, active or not, so they can edit hidden ones.
  async listAnnouncements() {
    const { data, error } = await supabase
      .from("announcements")
      .select("*")
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { announcements: data };
  },

  async createAnnouncement(payload) {
    const { data, error } = await supabase.from("announcements").insert(payload).select().single();
    if (error) throw new Error(error.message);
    return { id: data.id };
  },

  async updateAnnouncement(id, payload) {
    const { error } = await supabase.from("announcements").update(payload).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  },

  async deleteAnnouncement(id) {
    const { error } = await supabase.from("announcements").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  },

  // ---- Author / About info (shown in the site footer) ----
  async listAuthors() {
    const { data, error } = await supabase.from("authors").select("*").order("sort_order").order("id");
    if (error) throw new Error(error.message);
    return { authors: data };
  },

  async createAuthor(payload) {
    const { data, error } = await supabase.from("authors").insert(payload).select().single();
    if (error) throw new Error(error.message);
    return { id: data.id };
  },

  async updateAuthor(id, payload) {
    const { error } = await supabase.from("authors").update(payload).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  },

  async deleteAuthor(id) {
    const { error } = await supabase.from("authors").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  },

  // ---- Mock tests ----
  async listTests() {
    const { data, error } = await supabase.rpc("list_mock_tests");
    if (error) throw new Error(error.message);
    return { tests: data };
  },

  async startTest(testId) {
    const { data, error } = await supabase.rpc("start_test_attempt", { p_test_id: testId });
    if (error) throw new Error(error.message);
    return data; // { attempt, test, questions }
  },

  async saveAnswer(attemptId, questionId, value) {
    const { error } = await supabase.rpc("save_answer", {
      p_attempt_id: attemptId, p_question_id: questionId, p_value: value
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  },

  async toggleMark(attemptId, questionId, marked) {
    const { error } = await supabase.rpc("toggle_mark", {
      p_attempt_id: attemptId, p_question_id: questionId, p_marked: marked
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  },

  async submitTest(attemptId) {
    const { error } = await supabase.rpc("submit_attempt", { p_attempt_id: attemptId });
    if (error) throw new Error(error.message);
    return { ok: true, attemptId };
  },

  async getAttempt(attemptId) {
    const { data: attempt, error: aErr } = await supabase.from("attempts").select("*").eq("id", attemptId).maybeSingle();
    if (aErr) throw new Error(aErr.message);
    if (!attempt) throw new Error("This result couldn't be found. It may have been removed together with its test.");
    const { data: test, error: tErr } = await supabase
      .from("mock_tests").select("id, title, subject").eq("id", attempt.test_id).maybeSingle();
    if (tErr) throw new Error(tErr.message);
    if (!test) throw new Error("This test is no longer available, so its result can't be shown.");
    const { data: questions, error: qErr } = await supabase
      .from("mock_test_questions").select("*").eq("test_id", attempt.test_id).order("order_index").order("id");
    if (qErr) throw new Error(qErr.message);
    return { attempt, test, questions };
  },

  async myAttempts() {
    const authUser = await currentAuthUser();
    // First close out any unfinished attempt whose time has run out (graded if
    // something was answered, discarded if not). Best-effort: older databases
    // without migration 4 just skip this.
    await supabase.rpc("finalize_expired_attempts");
    const { data, error } = await supabase
      .from("attempts")
      .select("id, test_id, started_at, submitted_at, score, max_score, correct_count, wrong_count, unattempted_count, mock_tests(title, subject)")
      .eq("user_id", authUser.id)
      .order("id", { ascending: false });
    if (error) throw new Error(error.message);
    // An attempt whose test is gone (or no longer visible to this student) has
    // nothing to show or open, so it is left out rather than listed blank.
    const attempts = data
      .filter((a) => a.mock_tests)
      .map((a) => ({ ...a, title: a.mock_tests.title, subject: a.mock_tests.subject }));
    return { attempts };
  },

  // Creating and editing go through ONE database function (save_mock_test), so a
  // save is all-or-nothing: a bad question can no longer leave behind an empty
  // test or wipe an existing test's questions, and unchanged questions keep
  // their ids so students' old results still line up. Needs migration 4.
  async createTest({ subject, exam, title, duration_minutes, min_plan, kind, is_preview, questions }) {
    const id = await saveMockTest(null, withPlan({ subject, exam, title, duration_minutes, min_plan, kind: kind || "full", is_preview }), questions);
    return { id };
  },

  // Admins can read mock_test_questions (including correct_option) directly —
  // this is only ever called from the Admin panel, never during a live attempt.
  async getTest(id) {
    const { data: test, error: tErr } = await supabase.from("mock_tests").select("*").eq("id", id).single();
    if (tErr) throw new Error(tErr.message);
    const { data: questions, error: qErr } = await supabase
      .from("mock_test_questions").select("*").eq("test_id", id).order("order_index");
    if (qErr) throw new Error(qErr.message);
    return { test, questions };
  },

  async updateTest(id, { subject, exam, title, duration_minutes, min_plan, kind, is_preview, questions }) {
    await saveMockTest(id, withPlan({ subject, exam, title, duration_minutes, min_plan, kind: kind || "full", is_preview }), questions);
    return { ok: true };
  },

  // Is the one-time database update (migration 4) installed? Calls the new save
  // function with an empty question list, which it always refuses before
  // writing anything — so this can never change data.
  async databaseStatus() {
    const { error } = await supabase.rpc("save_mock_test", { p_test_id: null, p_test: {}, p_questions: [] });
    const msg = String(error?.message || "");
    if (/save_mock_test/i.test(msg) && /(could not find|does not exist|schema cache)/i.test(msg)) return { state: "missing" };
    if (/at least one question|only admins/i.test(msg)) return { state: "installed" };
    return { state: "unknown", detail: msg };
  },

  // Is migration 5 (plans, papers, downloads, question bank) installed? Calls a
  // read-only function that only exists once it has been run.
  async plansDatabaseStatus() {
    const { error } = await supabase.rpc("list_downloads");
    const msg = String(error?.message || "");
    if (!error) return { state: "installed" };
    if (/list_downloads/i.test(msg) && /(could not find|does not exist|schema cache)/i.test(msg)) return { state: "missing" };
    return { state: "unknown", detail: msg };
  },

  // Is migration 7 (question bank topics) installed? Reads the new column.
  async qbTopicsDatabaseStatus() {
    const { error } = await supabase.from("qb_questions").select("topic").limit(1);
    const msg = String(error?.message || "");
    if (!error) return { state: "installed" };
    if (/topic/i.test(msg) && /(does not exist|could not find|schema cache)/i.test(msg)) return { state: "missing" };
    return { state: "unknown", detail: msg };
  },

  // Is migration 6 (phone number + fixes) installed? Reads the new column.
  async phoneDatabaseStatus() {
    const { error } = await supabase.from("profiles").select("phone").limit(1);
    const msg = String(error?.message || "");
    if (!error) return { state: "installed" };
    if (/phone/i.test(msg) && /(does not exist|could not find|schema cache)/i.test(msg)) return { state: "missing" };
    return { state: "unknown", detail: msg };
  },

  // A student removing one of their own entries from My Results.
  async deleteAttempt(id) {
    const { data, error } = await supabase.from("attempts").delete().eq("id", id).select("id");
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) {
      throw new Error("This entry could not be removed. It needs the one-time database update (Admin → Mock Tests → Database update).");
    }
    return { ok: true };
  },

  async deleteTest(id) {
    // Cascades to that test's questions and any student attempts automatically.
    // select() returns the rows that were really deleted: the API reports success
    // even when a delete matched nothing (e.g. a permission rule), which would
    // otherwise look like it worked.
    const { data, error } = await supabase.from("mock_tests").delete().eq("id", id).select("id");
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) throw new Error("The test could not be deleted (it may already be gone, or your account is not allowed to delete it).");
    return { ok: true };
  },

  // ---- Admin: students and plans ----
  // Includes the phone number once migration 6 has added that column; before
  // that the list still loads, just without phone numbers.
  async listStudents() {
    const base = "id, name, email, role, subject, plan, plan_expires_at, created_at";
    const run = (cols) => supabase.from("profiles").select(cols).order("created_at", { ascending: false });
    let { data, error } = await run(`${base}, phone`);
    if (error && /phone/i.test(error.message)) ({ data, error } = await run(base));
    if (error) throw new Error(error.message);
    return { students: data };
  },

  // Sets a plan for a number of months (renewals of the same plan extend the
  // current expiry). Use plan "free" to revoke.
  async adminGrantPlan(userId, plan, months) {
    const { data, error } = await supabase.rpc("admin_grant_plan", { p_user: userId, p_plan: plan, p_months: months });
    if (error) throw new Error(error.message);
    return { expires: data };
  },

  // ---- Plans and prices ----
  async listPlans() {
    const { data, error } = await supabase.from("plans").select("*").order("rank");
    if (error) throw new Error(error.message);
    return { plans: data };
  },

  async updatePlan(id, payload) {
    const { error } = await supabase.from("plans").update(payload).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  },

  // ---- Subscription requests (manual verification until a gateway is added) ----
  async createSubscriptionRequest({ plan, period, amount, payment_ref }) {
    const authUser = await currentAuthUser();
    const { error } = await supabase.from("subscription_requests").insert({
      user_id: authUser.id, plan, period, amount: amount ?? null, payment_ref: payment_ref || null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  },

  async mySubscriptionRequests() {
    const authUser = await currentAuthUser();
    const { data, error } = await supabase
      .from("subscription_requests").select("*").eq("user_id", authUser.id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { requests: data };
  },

  async listSubscriptionRequests() {
    const { data, error } = await supabase
      .from("subscription_requests").select("*, profiles(name, email)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { requests: data };
  },

  async decideSubscription(id, approve) {
    const { data, error } = await supabase.rpc("admin_decide_subscription", { p_request_id: id, p_approve: approve });
    if (error) throw new Error(error.message);
    return { expires: data };
  },

  // ---- Site settings (contact details, payment instructions, About text) ----
  async getSettings() {
    const { data, error } = await supabase.from("site_settings").select("key, value");
    if (error) throw new Error(error.message);
    return Object.fromEntries(data.map((r) => [r.key, r.value]));
  },

  async saveSettings(values) {
    const rows = Object.entries(values).map(([key, value]) => ({ key, value: value ?? "" }));
    const { error } = await supabase.from("site_settings").upsert(rows, { onConflict: "key" });
    if (error) throw new Error(error.message);
    return { ok: true };
  },

  // ---- Previous-year papers (PDFs on Google Drive) ----
  async listPapers() {
    const { data, error } = await supabase.from("pyq_papers").select("*")
      .order("year", { ascending: false }).order("id", { ascending: false });
    if (error) throw new Error(error.message);
    return { papers: data };
  },
  async getPaper(id) {
    const { data, error } = await supabase.from("pyq_papers").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    return { paper: data };
  },
  async createPaper(payload) {
    const { error } = await supabase.from("pyq_papers").insert(payload);
    if (error) throw new Error(error.message);
    return { ok: true };
  },
  async updatePaper(id, payload) {
    const { error } = await supabase.from("pyq_papers").update(payload).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  },
  async deletePaper(id) {
    const { error } = await supabase.from("pyq_papers").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  },

  // ---- Exam information hub ----
  async listExamInfo() {
    const { data, error } = await supabase.from("exam_info").select("*")
      .order("sort_order").order("id");
    if (error) throw new Error(error.message);
    return { items: data };
  },
  async createExamInfo(payload) {
    const { error } = await supabase.from("exam_info").insert(payload);
    if (error) throw new Error(error.message);
    return { ok: true };
  },
  async updateExamInfo(id, payload) {
    const { error } = await supabase.from("exam_info").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  },
  async deleteExamInfo(id) {
    const { error } = await supabase.from("exam_info").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  },

  // ---- Question bank ----
  async qbTopicSummary() {
    const { data, error } = await supabase.rpc("qb_topic_summary");
    if (error) throw new Error(error.message);
    return { topics: data };
  },

  // Answers are never included here — they come back from checkAnswer() only
  // after the student has answered.
  // `topic`: a topic name, or "" for every question in the unit. (qb_questions
  // holds no answers, so selecting every column is safe; it also keeps working
  // on databases from before migration 7, which have no topic column.)
  async listQuestions({ exam, subject, unit, topic, difficulty, qtype, ids, limit = 10, offset = 0 } = {}) {
    let q = supabase.from("qb_questions")
      .select("*", { count: "exact" })
      .order("id").range(offset, offset + limit - 1);
    if (exam) q = q.eq("exam", exam);
    if (subject) q = q.eq("subject", subject);
    if (unit) q = q.eq("unit", unit);
    if (topic) q = q.eq("topic", topic);
    if (difficulty) q = q.eq("difficulty", difficulty);
    if (qtype) q = q.eq("qtype", qtype);
    if (ids) q = q.in("id", ids.length ? ids : [-1]);
    const { data, error, count } = await q;
    if (error) throw new Error(error.message);
    return { questions: data, count: count ?? data.length };
  },

  async qbProgress(ids) {
    if (!ids.length) return { progress: {} };
    const { data, error } = await supabase.from("qb_progress").select("*").in("question_id", ids);
    if (error) throw new Error(error.message);
    return { progress: Object.fromEntries(data.map((r) => [r.question_id, r])) };
  },

  async qbBookmarkedIds() {
    const authUser = await currentAuthUser();
    const { data, error } = await supabase.from("qb_progress").select("question_id")
      .eq("user_id", authUser.id).eq("bookmarked", true);
    if (error) throw new Error(error.message);
    return { ids: data.map((r) => r.question_id) };
  },

  async checkAnswer(questionId, response) {
    const { data, error } = await supabase.rpc("check_qb_answer", { p_question_id: questionId, p_response: response });
    if (error) throw new Error(error.message);
    return data; // { is_correct, answer_key, explanation }
  },

  async setBookmark(questionId, value) {
    const { error } = await supabase.rpc("toggle_qb_bookmark", { p_question_id: questionId, p_value: value });
    if (error) throw new Error(error.message);
    return { ok: true };
  },

  async qbStats() {
    const { data, error } = await supabase.rpc("qb_stats");
    if (error) throw new Error(error.message);
    return data || { attempted: 0, correct: 0, bookmarked: 0 };
  },

  // Admin: questions together with their answer keys.
  async adminListQuestions({ exam, subject, unit, topic } = {}) {
    let q = supabase.from("qb_questions").select("*, qb_answers(answer_key, nat_tolerance, explanation)")
      .order("id", { ascending: false }).limit(300);
    if (exam) q = q.eq("exam", exam);
    if (subject) q = q.eq("subject", subject);
    if (unit) q = q.eq("unit", unit);
    if (topic) q = q.eq("topic", topic);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    const questions = data.map((r) => {
      const a = Array.isArray(r.qb_answers) ? r.qb_answers[0] : r.qb_answers;
      const { qb_answers, ...rest } = r; // eslint-disable-line no-unused-vars
      return { ...rest, answer: a || null };
    });
    return { questions };
  },

  // `items` come from parseQuestionBank(); `defaults` = { exam, subject, unit, topic, min_plan, is_preview }.
  // A "Topic:" line on a question beats the topic chosen above the box.
  async createQuestions(items, defaults) {
    const premium = (defaults.min_plan || "free") !== "free";
    const topicOf = (it) => (it.topic || defaults.topic || "").trim() || null;
    const withTopics = items.some(topicOf); // only send "topic" when used (needs migration 7)
    const rows = items.map((it) => ({
      exam: defaults.exam, subject: defaults.subject, unit: defaults.unit,
      min_plan: defaults.min_plan || "free", is_preview: premium ? false : !!defaults.is_preview,
      qtype: it.qtype, difficulty: it.difficulty, content: it.content, options: it.options, source: it.source,
      ...(withTopics ? { topic: topicOf(it) } : {}),
    }));
    const { data, error } = await supabase.from("qb_questions").insert(rows).select("id");
    if (error) throw new Error(error.message);
    const answers = data.map((r, i) => ({
      question_id: r.id, answer_key: items[i].answer_key,
      nat_tolerance: items[i].nat_tolerance, explanation: items[i].explanation,
    }));
    const { error: aErr } = await supabase.from("qb_answers").insert(answers);
    if (aErr) {
      // Don't leave questions that have no answer key behind.
      await supabase.from("qb_questions").delete().in("id", data.map((r) => r.id));
      throw new Error(aErr.message);
    }
    return { count: data.length };
  },

  async updateQuestion(id, item, meta) {
    const patch = {
      qtype: item.qtype, difficulty: item.difficulty, content: item.content, options: item.options, source: item.source,
    };
    if (meta) {
      const premium = (meta.min_plan || "free") !== "free";
      Object.assign(patch, { exam: meta.exam, subject: meta.subject, unit: meta.unit, min_plan: meta.min_plan || "free", is_preview: premium ? false : !!meta.is_preview });
      // meta.topic is undefined on databases without the topic column (before migration 7).
      if (meta.topic !== undefined || item.topic) patch.topic = (item.topic || meta.topic || "").trim() || null;
    }
    const { error } = await supabase.from("qb_questions").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    const { error: aErr } = await supabase.from("qb_answers").upsert({
      question_id: id, answer_key: item.answer_key, nat_tolerance: item.nat_tolerance, explanation: item.explanation,
    }, { onConflict: "question_id" });
    if (aErr) throw new Error(aErr.message);
    return { ok: true };
  },

  async deleteQuestion(id) {
    const { error } = await supabase.from("qb_questions").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  },

  // ---- Downloads (Drive links) ----
  // The Drive link only comes back for viewers whose plan allows it.
  async listDownloads() {
    const { data, error } = await supabase.rpc("list_downloads");
    if (error) throw new Error(error.message);
    return { items: data };
  },
  async adminListDownloads() {
    const { data, error } = await supabase.from("downloads").select("*").order("sort_order").order("id", { ascending: false });
    if (error) throw new Error(error.message);
    return { items: data };
  },
  async createDownload(payload) {
    const { error } = await supabase.from("downloads").insert(payload);
    if (error) throw new Error(error.message);
    return { ok: true };
  },
  async updateDownload(id, payload) {
    const { error } = await supabase.from("downloads").update(payload).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  },
  async deleteDownload(id) {
    const { error } = await supabase.from("downloads").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  },

  // Moves every note matching exam / subject / unit to a plan in one go.
  async setNotesPlan({ exam, subject, unit }, plan) {
    let q = supabase.from("notes").update(plan === "free" ? { min_plan: "free" } : { min_plan: plan, is_preview: false });
    if (exam) q = q.eq("exam", exam);
    if (subject) q = q.eq("subject", subject);
    if (unit) q = q.eq("unit", unit);
    const { data, error } = await q.select("id");
    if (error) throw new Error(error.message);
    return { count: data.length };
  },

  // ---- Support / feedback ----
  async createSupportMessage({ name, email, kind, message }) {
    let userId = null;
    try { userId = (await currentAuthUser()).id; } catch { /* guests can write in too */ }
    const { error } = await supabase.from("support_messages").insert({ user_id: userId, name, email, kind, message });
    if (error) throw new Error(error.message);
    return { ok: true };
  },
  async listSupportMessages() {
    const { data, error } = await supabase.from("support_messages").select("*").order("created_at", { ascending: false }).limit(200);
    if (error) throw new Error(error.message);
    return { messages: data };
  },
  async setSupportStatus(id, status) {
    const { error } = await supabase.from("support_messages").update({ status }).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  },
  async deleteSupportMessage(id) {
    const { error } = await supabase.from("support_messages").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  },
};
