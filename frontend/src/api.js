import { supabase } from "./supabaseClient.js";

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

export const api = {
  async register({ name, email, password, subject }) {
    const { data, error } = await supabase.auth.signUp({
      email, password, options: { data: { name, subject } }
    });
    if (error) throw new Error(error.message);
    if (!data.session) {
      // Email confirmation is required by this Supabase project's settings.
      return { user: null, needsEmailConfirm: true };
    }
    const user = await fetchProfile(data.user.id);
    return { user, needsEmailConfirm: false };
  },

  async login({ email, password }) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    const user = await fetchProfile(data.user.id);
    return { user };
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
      .select("id, exam, subject, unit, title, created_at, is_premium")
      .order("subject").order("unit");
    if (error) throw new Error(error.message);
    return { notes: data };
  },

  async getNote(id) {
    const { data: note, error } = await supabase.from("notes").select("*").eq("id", id).single();
    if (error) throw new Error(error.message);
    const authUser = await currentAuthUser();
    const profile = await fetchProfile(authUser.id);
    const watermark = `${profile.name} · ${profile.email} · ${new Date().toISOString()}`;
    return { note, watermark };
  },

  async createNote(payload) {
    const { data, error } = await supabase.from("notes").insert(payload).select().single();
    if (error) throw new Error(error.message);
    return { id: data.id };
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
    const { data: attempt, error: aErr } = await supabase.from("attempts").select("*").eq("id", attemptId).single();
    if (aErr) throw new Error(aErr.message);
    const { data: test, error: tErr } = await supabase
      .from("mock_tests").select("id, title, subject").eq("id", attempt.test_id).single();
    if (tErr) throw new Error(tErr.message);
    const { data: questions, error: qErr } = await supabase
      .from("mock_test_questions").select("*").eq("test_id", attempt.test_id).order("order_index");
    if (qErr) throw new Error(qErr.message);
    return { attempt, test, questions };
  },

  async myAttempts() {
    const authUser = await currentAuthUser();
    const { data, error } = await supabase
      .from("attempts")
      .select("id, test_id, started_at, submitted_at, score, max_score, correct_count, wrong_count, unattempted_count, mock_tests(title, subject)")
      .eq("user_id", authUser.id)
      .order("id", { ascending: false });
    if (error) throw new Error(error.message);
    const attempts = data.map((a) => ({
      ...a, title: a.mock_tests?.title, subject: a.mock_tests?.subject
    }));
    return { attempts };
  },

  async createTest({ subject, exam, title, duration_minutes, is_premium, questions }) {
    const { data: test, error: tErr } = await supabase
      .from("mock_tests")
      .insert({ subject, exam, title, duration_minutes, is_premium: !!is_premium })
      .select().single();
    if (tErr) throw new Error(tErr.message);

    const rows = questions.map((q, i) => ({
      test_id: test.id,
      part: q.part || "A",
      question: q.question,
      option_a: q.option_a, option_b: q.option_b, option_c: q.option_c, option_d: q.option_d,
      correct_option: q.correct_option,
      marks: q.marks ?? 2,
      negative_marks: q.negative_marks ?? 0.5,
      order_index: i
    }));
    const { error: qErr } = await supabase.from("mock_test_questions").insert(rows);
    if (qErr) throw new Error(qErr.message);
    return { id: test.id };
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
