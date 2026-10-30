-- ============================================================================
-- Migration 4 — question hints, safer test saving, results clean-up
--
-- Run this ONCE in Supabase → SQL Editor → New query → Run, BEFORE deploying
-- the front-end build that goes with it. It is additive and safe to run again.
--
-- What it does:
--   1. Adds a "hint" to every mock-test question (shown in the results review).
--   2. Makes sure a student's results are deleted together with their test,
--      and removes any results already left behind by tests that are gone.
--   3. Adds save_mock_test(): creating/editing a test is now one all-or-nothing
--      step (a failed save can no longer leave an empty test or wipe questions),
--      and editing keeps students' old answers attached to the right questions.
--   4. Handles unfinished attempts whose time has run out, so pressing Start on
--      an old, abandoned attempt no longer auto-submits it with a zero score.
--   5. Stops students seeing (or starting) a test that has no questions.
-- ============================================================================


-- ---------- 1. Hints ----------
-- Lives next to correct_option, so it is protected the same way: students never
-- receive it while a test is running (start_test_attempt below builds its
-- question list column by column and does not include it), and the existing
-- mtq_select_admin_or_reviewed policy only lets them read it from the
-- questions table after they have submitted.
alter table public.mock_test_questions add column if not exists hint text;


-- ---------- 2. Results must disappear with their test ----------
-- First remove results that already outlived their test, otherwise the links
-- below could not be (re)created.
delete from public.attempts a
  where not exists (select 1 from public.mock_tests t where t.id = a.test_id);
delete from public.mock_test_questions q
  where not exists (select 1 from public.mock_tests t where t.id = q.test_id);

-- Re-create the links to mock_tests with ON DELETE CASCADE, whatever they were
-- called (or whether they existed at all) in your database.
do $$
declare
  tbl text;
  c record;
begin
  foreach tbl in array array['attempts', 'mock_test_questions'] loop
    for c in
      select con.conname
      from pg_constraint con
      where con.conrelid = ('public.' || tbl)::regclass
        and con.contype = 'f'
        and con.confrelid = 'public.mock_tests'::regclass
    loop
      execute format('alter table public.%I drop constraint %I', tbl, c.conname);
    end loop;
    execute format(
      'alter table public.%I add constraint %I foreign key (test_id) references public.mock_tests(id) on delete cascade',
      tbl, tbl || '_test_id_fkey'
    );
  end loop;
end $$;


-- ---------- 3. Save a test in one all-or-nothing step ----------
-- p_test_id  : null to create a new test, or the id of the test to update
-- p_test     : {exam, subject, title, duration_minutes, is_premium, is_preview}
-- p_questions: [{part, question, option_a..d, correct_option, marks,
--                negative_marks, hint}, ...]
--
-- Everything happens in a single transaction: if anything is wrong the whole
-- save is rolled back. When editing, a question whose text is unchanged keeps
-- its id (so results students already have still show their answers); only
-- questions that were really added, reworded or removed get new/removed rows.
create or replace function public.save_mock_test(p_test_id bigint, p_test jsonb, p_questions jsonb)
returns bigint
language plpgsql security definer set search_path = public
as $$
declare
  v_id bigint;
  v_n int;
  v_old_ids bigint[];
  v_old_texts text[];
  v_old_n int := 0;
  v_used boolean[] := '{}';
  v_match int;
  v_text text;
  q jsonb;
  i int;
  j int;
  v_part text;
  v_correct text;
begin
  if not public.is_admin() then
    raise exception 'Only admins can save mock tests';
  end if;

  if p_questions is null or jsonb_typeof(p_questions) <> 'array' or jsonb_array_length(p_questions) = 0 then
    raise exception 'A mock test needs at least one question';
  end if;
  v_n := jsonb_array_length(p_questions);

  -- Check every question first, with messages an admin can act on.
  for i in 0 .. v_n - 1 loop
    q := p_questions -> i;
    if coalesce(btrim(q ->> 'question'), '') = '' then
      raise exception 'Question %: the question text is empty', i + 1;
    end if;
    for j in 1 .. 4 loop
      if coalesce(btrim(q ->> ('option_' || chr(96 + j))), '') = '' then
        raise exception 'Question %: option % is empty', i + 1, upper(chr(96 + j));
      end if;
    end loop;
    v_correct := upper(coalesce(btrim(q ->> 'correct_option'), ''));
    if v_correct not in ('A', 'B', 'C', 'D') then
      raise exception 'Question %: correct_option must be A, B, C or D', i + 1;
    end if;
    v_part := upper(coalesce(nullif(btrim(q ->> 'part'), ''), 'A'));
    if v_part not in ('A', 'B', 'C') then
      raise exception 'Question %: part must be A, B or C', i + 1;
    end if;
  end loop;

  -- The test itself.
  if p_test_id is null then
    insert into public.mock_tests (exam, subject, title, duration_minutes, is_premium, is_preview)
    values (
      coalesce(nullif(btrim(p_test ->> 'exam'), ''), 'General'),
      p_test ->> 'subject',
      p_test ->> 'title',
      coalesce((p_test ->> 'duration_minutes')::int, 180),
      coalesce((p_test ->> 'is_premium')::boolean, false),
      coalesce((p_test ->> 'is_preview')::boolean, false)
    )
    returning id into v_id;
  else
    update public.mock_tests set
      exam = coalesce(nullif(btrim(p_test ->> 'exam'), ''), exam),
      subject = coalesce(p_test ->> 'subject', subject),
      title = coalesce(p_test ->> 'title', title),
      duration_minutes = coalesce((p_test ->> 'duration_minutes')::int, duration_minutes),
      is_premium = coalesce((p_test ->> 'is_premium')::boolean, is_premium),
      is_preview = coalesce((p_test ->> 'is_preview')::boolean, is_preview)
    where id = p_test_id
    returning id into v_id;
    if v_id is null then
      raise exception 'Test not found';
    end if;
  end if;

  -- Existing questions, so unchanged ones can be kept (same id) instead of replaced.
  select coalesce(array_agg(id order by order_index, id), '{}'),
         coalesce(array_agg(regexp_replace(btrim(question), '\s+', ' ', 'g') order by order_index, id), '{}')
    into v_old_ids, v_old_texts
    from public.mock_test_questions where test_id = v_id;
  v_old_n := coalesce(array_length(v_old_ids, 1), 0);
  for j in 1 .. v_old_n loop
    v_used[j] := false;
  end loop;

  for i in 0 .. v_n - 1 loop
    q := p_questions -> i;
    v_text := regexp_replace(btrim(q ->> 'question'), '\s+', ' ', 'g');
    v_part := upper(coalesce(nullif(btrim(q ->> 'part'), ''), 'A'));
    v_correct := upper(btrim(q ->> 'correct_option'));

    v_match := 0;
    for j in 1 .. v_old_n loop
      if not v_used[j] and v_old_texts[j] = v_text then
        v_match := j;
        exit;
      end if;
    end loop;

    if v_match > 0 then
      v_used[v_match] := true;
      update public.mock_test_questions set
        part = v_part,
        question = btrim(q ->> 'question'),
        option_a = btrim(q ->> 'option_a'), option_b = btrim(q ->> 'option_b'),
        option_c = btrim(q ->> 'option_c'), option_d = btrim(q ->> 'option_d'),
        correct_option = v_correct,
        marks = coalesce((q ->> 'marks')::numeric, 2),
        negative_marks = abs(coalesce((q ->> 'negative_marks')::numeric, 0.5)),
        hint = nullif(btrim(q ->> 'hint'), ''),
        order_index = i
      where id = v_old_ids[v_match];
    else
      insert into public.mock_test_questions
        (test_id, part, question, option_a, option_b, option_c, option_d, correct_option,
         marks, negative_marks, hint, order_index)
      values (
        v_id, v_part, btrim(q ->> 'question'),
        btrim(q ->> 'option_a'), btrim(q ->> 'option_b'), btrim(q ->> 'option_c'), btrim(q ->> 'option_d'),
        v_correct,
        coalesce((q ->> 'marks')::numeric, 2),
        abs(coalesce((q ->> 'negative_marks')::numeric, 0.5)),
        nullif(btrim(q ->> 'hint'), ''),
        i
      );
    end if;
  end loop;

  -- Questions that are no longer in the test.
  for j in 1 .. v_old_n loop
    if not v_used[j] then
      delete from public.mock_test_questions where id = v_old_ids[j];
    end if;
  end loop;

  return v_id;
end;
$$;
revoke all on function public.save_mock_test(bigint, jsonb, jsonb) from public, anon;
grant execute on function public.save_mock_test(bigint, jsonb, jsonb) to authenticated;


-- ---------- 4. Unfinished attempts whose time has run out ----------
-- Closes the signed-in student's unfinished attempts once their time is over
-- (plus two minutes of grace for a slow connection or a page reload):
--   * nothing answered  -> simply discarded
--   * something answered -> graded on what was answered and kept in My Results,
--                           dated at the moment the time ran out
create or replace function public.finalize_expired_attempts()
returns void
language plpgsql security definer set search_path = public
as $$
declare
  a record;
  v_deadline timestamptz;
begin
  if auth.uid() is null then
    return;
  end if;

  for a in
    select at.id, at.answers, at.started_at, t.duration_minutes
    from public.attempts at
    join public.mock_tests t on t.id = at.test_id
    where at.user_id = auth.uid()
      and at.submitted_at is null
      and now() > at.started_at + make_interval(mins => t.duration_minutes) + interval '2 minutes'
  loop
    v_deadline := a.started_at + make_interval(mins => a.duration_minutes);
    if a.answers = '{}'::jsonb then
      delete from public.attempts where id = a.id;
    else
      perform public.submit_attempt(a.id);
      update public.attempts set submitted_at = v_deadline where id = a.id;
    end if;
  end loop;
end;
$$;
revoke all on function public.finalize_expired_attempts() from public, anon;
grant execute on function public.finalize_expired_attempts() to authenticated;


-- ---------- 5. Starting a test, and the test list ----------
create or replace function public.start_test_attempt(p_test_id bigint)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_test record;
  v_attempt record;
begin
  if auth.uid() is null then
    raise exception 'Please log in to start a test';
  end if;

  select * into v_test from public.mock_tests where id = p_test_id;
  if not found then raise exception 'Test not found'; end if;

  if not (public.is_admin() or not v_test.is_premium or public.is_paid()) then
    raise exception 'This test requires a paid plan';
  end if;

  if not exists (select 1 from public.mock_test_questions where test_id = p_test_id) then
    raise exception 'This test has no questions yet';
  end if;

  -- An old unfinished attempt that has run out of time is closed first, so
  -- pressing Start gives a fresh timer instead of resuming a finished one.
  perform public.finalize_expired_attempts();

  select * into v_attempt from public.attempts
    where user_id = auth.uid() and test_id = p_test_id and submitted_at is null
    order by id desc limit 1;

  if not found then
    insert into public.attempts (user_id, test_id) values (auth.uid(), p_test_id)
      returning * into v_attempt;
  end if;

  return jsonb_build_object(
    'attempt', jsonb_build_object(
      'id', v_attempt.id, 'started_at', v_attempt.started_at,
      'answers', v_attempt.answers, 'marked', v_attempt.marked
    ),
    'test', jsonb_build_object(
      'id', v_test.id, 'title', v_test.title, 'subject', v_test.subject,
      'exam', v_test.exam, 'duration_minutes', v_test.duration_minutes
    ),
    -- Deliberately NOT including correct_option or hint while a test is running.
    'questions', (
      select jsonb_agg(jsonb_build_object(
        'id', q.id, 'part', q.part, 'question', q.question,
        'option_a', q.option_a, 'option_b', q.option_b, 'option_c', q.option_c, 'option_d', q.option_d,
        'marks', q.marks, 'negative_marks', q.negative_marks
      ) order by q.order_index, q.id)
      from public.mock_test_questions q where q.test_id = p_test_id
    )
  );
end;
$$;
grant execute on function public.start_test_attempt(bigint) to authenticated;

-- Same visibility rules as before, but a test with no questions is only listed
-- for admins (so they can finish or delete it), never for students or visitors.
create or replace function public.list_mock_tests()
returns setof jsonb language sql security definer set search_path = public stable
as $$
  select jsonb_build_object(
    'id', t.id, 'subject', t.subject, 'exam', t.exam, 'title', t.title,
    'duration_minutes', t.duration_minutes, 'is_premium', t.is_premium, 'is_preview', t.is_preview,
    'created_at', t.created_at,
    'question_count', (select count(*) from public.mock_test_questions q where q.test_id = t.id)
  )
  from public.mock_tests t
  where (
          public.is_admin()
          or public.is_paid()
          or (t.is_preview and not t.is_premium)
          or (not t.is_premium and auth.role() = 'authenticated')
        )
    and (
          public.is_admin()
          or exists (select 1 from public.mock_test_questions q where q.test_id = t.id)
        )
  order by t.created_at desc;
$$;
grant execute on function public.list_mock_tests() to authenticated, anon;
