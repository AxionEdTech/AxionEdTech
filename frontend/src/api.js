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
    .select("id, name, email, role, subject, plan")
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
    },
    p_questions: questions,
  });
  if (error) {
    if (/save_mock_test/i.test(error.message) && /(could not find|does not exist|schema cache)/i.test(error.message)) {
      throw new Error("The database needs a one-time update before tests can be saved: run supabase/migration_4_hints_and_results_cleanup.sql in the Supabase SQL Editor (in the same project this site uses) and wait for its result row to show true / true / true. If you already did, run:  notify pgrst, 'reload schema';  and try again.");
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

export const api = {
  async register({ name, email, password, subject }) {
    const { data, error } = await supabase.auth.signUp({
      email, password, options: { data: { name, subject } }
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
    const { data, error } = await supabase
      .from("notes")
      .select("id, exam, subject, unit, title, created_at, is_premium, is_preview, position")
      .order("subject").order("unit");
    if (error) throw new Error(error.message);
    return { notes: data };
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
    const { data, error } = await supabase.from("notes").insert(payload).select().single();
    if (error) throw new Error(error.message);
    return { id: data.id };
  },

  async updateNote(id, payload) {
    const { error } = await supabase.from("notes").update(payload).eq("id", id);
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
  async createTest({ subject, exam, title, duration_minutes, is_premium, is_preview, questions }) {
    const id = await saveMockTest(null, { subject, exam, title, duration_minutes, is_premium, is_preview }, questions);
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

  async updateTest(id, { subject, exam, title, duration_minutes, is_premium, is_preview, questions }) {
    await saveMockTest(id, { subject, exam, title, duration_minutes, is_premium, is_preview }, questions);
    return { ok: true };
  },

  async deleteTest(id) {
    // Cascades to that test's questions and any student attempts automatically.
    const { error } = await supabase.from("mock_tests").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  },

  // ---- Admin: manage a student's plan ----
  async listStudents() {
    const { data, error } = await supabase
      .from("profiles").select("id, name, email, role, subject, plan, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { students: data };
  },

  async setPlan(userId, plan) {
    const { error } = await supabase.from("profiles").update({ plan }).eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  }
};
