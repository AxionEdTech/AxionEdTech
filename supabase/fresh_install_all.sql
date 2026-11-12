-- ============================================================================
-- FRESH INSTALL — builds the whole Axion EdTech database in one go, on an EMPTY
-- database (a new Supabase project, or after reset_before_rebuild.sql).
--
-- It is simply these five files, in order, pasted together:
--   1. schema.sql                      base tables and rules (+ a few sample rows)
--   2. migration_2_multi_exam.sql      multiple exams
--   3. migration_3_notice_board_and_access_tiers.sql
--   4. migration_4_hints_and_results_cleanup.sql
--   5. migration_5_plans_papers_exam_hub_question_bank.sql
--
-- Paste all of it into Supabase -> SQL Editor -> New query -> Run. If Supabase
-- warns about "destructive operations", choose "Run this query" (it only drops
-- rules it is about to re-create). The last result shows true, true, true.
-- Then run backfill_existing_users.sql.
-- ============================================================================

-- ############################################################################
-- ## schema.sql
-- ############################################################################

-- ============================================================================
-- Prayas CSIR NET Portal — Supabase schema
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- Safe to run once on a fresh project. Re-running will error on "already exists"
-- (that's fine — it means it already worked).
-- ============================================================================

-- ---------- PROFILES (one row per signed-up user) ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  role text not null default 'student' check (role in ('student','admin')),
  subject text default 'General',
  plan text not null default 'free' check (plan in ('free','paid')),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- Runs as the table owner, so it can safely check "is this user an admin"
-- from inside other policies without causing infinite recursion.
create or replace function public.is_admin()
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.is_paid()
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and plan = 'paid');
$$;

create policy "profiles_select_own_or_admin" on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid());
-- Lets an admin change another user's plan (free/paid) or role from the Admin panel.
create policy "profiles_admin_update_any" on public.profiles
  for update using (public.is_admin());

-- Auto-create a profile row the moment someone signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, subject)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', 'Student'),
    new.email,
    coalesce(new.raw_user_meta_data->>'subject', 'General')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------- NOTES ----------
create table public.notes (
  id bigint generated always as identity primary key,
  exam text not null default 'General',
  subject text not null,
  unit text not null,
  title text not null,
  content text not null,
  is_premium boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.notes enable row level security;

create policy "notes_select" on public.notes
  for select using (public.is_admin() or not is_premium or public.is_paid());
create policy "notes_admin_insert" on public.notes for insert with check (public.is_admin());
create policy "notes_admin_update" on public.notes for update using (public.is_admin());
create policy "notes_admin_delete" on public.notes for delete using (public.is_admin());

-- ---------- PREVIOUS YEAR QUESTIONS ----------
create table public.pyqs (
  id bigint generated always as identity primary key,
  exam text not null default 'General',
  subject text not null,
  year int not null,
  part text not null,
  question text not null,
  option_a text not null,
  option_b text not null,
  option_c text not null,
  option_d text not null,
  correct_option text not null,
  explanation text default '',
  is_premium boolean not null default false
);
alter table public.pyqs enable row level security;

create policy "pyqs_select" on public.pyqs
  for select using (public.is_admin() or not is_premium or public.is_paid());
create policy "pyqs_admin_insert" on public.pyqs for insert with check (public.is_admin());
create policy "pyqs_admin_update" on public.pyqs for update using (public.is_admin());
create policy "pyqs_admin_delete" on public.pyqs for delete using (public.is_admin());

-- ---------- MOCK TESTS ----------
create table public.mock_tests (
  id bigint generated always as identity primary key,
  exam text not null default 'General',
  subject text not null,
  title text not null,
  duration_minutes int not null default 180,
  is_premium boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.mock_tests enable row level security;

create policy "mock_tests_select" on public.mock_tests
  for select using (public.is_admin() or not is_premium or public.is_paid());
create policy "mock_tests_admin_insert" on public.mock_tests for insert with check (public.is_admin());
create policy "mock_tests_admin_update" on public.mock_tests for update using (public.is_admin());
create policy "mock_tests_admin_delete" on public.mock_tests for delete using (public.is_admin());

-- ---------- MOCK TEST QUESTIONS ----------
-- IMPORTANT: correct_option lives here. Students never query this table directly —
-- they call start_test_attempt() below, which returns questions WITHOUT the answer.
-- Direct SELECT on this table is only allowed for admins, or for a student's own
-- test *after* they've submitted it (so the review screen can show correct answers).
create table public.mock_test_questions (
  id bigint generated always as identity primary key,
  test_id bigint not null references public.mock_tests(id) on delete cascade,
  part text not null default 'A',
  question text not null,
  option_a text not null,
  option_b text not null,
  option_c text not null,
  option_d text not null,
  correct_option text not null,
  marks numeric not null default 2,
  negative_marks numeric not null default 0.5,
  order_index int not null default 0
);
alter table public.mock_test_questions enable row level security;

create policy "mtq_admin_insert" on public.mock_test_questions for insert with check (public.is_admin());
create policy "mtq_admin_update" on public.mock_test_questions for update using (public.is_admin());
create policy "mtq_admin_delete" on public.mock_test_questions for delete using (public.is_admin());

-- ---------- ATTEMPTS ----------
create table public.attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  test_id bigint not null references public.mock_tests(id) on delete cascade,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  answers jsonb not null default '{}'::jsonb,
  marked jsonb not null default '[]'::jsonb,
  score numeric,
  max_score numeric,
  correct_count int,
  wrong_count int,
  unattempted_count int
);
alter table public.attempts enable row level security;

create policy "attempts_select_own_or_admin" on public.attempts
  for select using (user_id = auth.uid() or public.is_admin());
create policy "attempts_insert_own" on public.attempts
  for insert with check (user_id = auth.uid());
create policy "attempts_update_own_unsubmitted" on public.attempts
  for update using (user_id = auth.uid() and submitted_at is null);

-- This policy needs the attempts table above to exist first, which is why it's
-- defined here rather than alongside the other mock_test_questions policies.
create policy "mtq_select_admin_or_reviewed" on public.mock_test_questions
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.attempts a
      where a.test_id = mock_test_questions.test_id
        and a.user_id = auth.uid()
        and a.submitted_at is not null
    )
  );

-- Returns the test list with question counts. A plain client-side join can't
-- compute this count for students, because RLS on mock_test_questions hides
-- the rows themselves — this function runs with owner privileges so counting
-- doesn't require exposing the questions.
create or replace function public.list_mock_tests()
returns setof jsonb language sql security definer set search_path = public stable
as $$
  select jsonb_build_object(
    'id', t.id, 'subject', t.subject, 'exam', t.exam, 'title', t.title,
    'duration_minutes', t.duration_minutes, 'is_premium', t.is_premium,
    'created_at', t.created_at,
    'question_count', (select count(*) from public.mock_test_questions q where q.test_id = t.id)
  )
  from public.mock_tests t
  where public.is_admin() or not t.is_premium or public.is_paid()
  order by t.created_at desc;
$$;
grant execute on function public.list_mock_tests() to authenticated;

-- ---------- SECURE FUNCTIONS ----------
-- These run server-side inside Postgres, so the answer key never has to leave
-- the database until a student has actually submitted their attempt.

create or replace function public.start_test_attempt(p_test_id bigint)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_test record;
  v_attempt record;
begin
  select * into v_test from public.mock_tests where id = p_test_id;
  if not found then raise exception 'Test not found'; end if;

  if not (public.is_admin() or not v_test.is_premium or public.is_paid()) then
    raise exception 'This test requires a paid plan';
  end if;

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
      'id', v_test.id, 'title', v_test.title, 'subject', v_test.subject, 'exam', v_test.exam,
      'duration_minutes', v_test.duration_minutes
    ),
    'questions', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', q.id, 'part', q.part, 'question', q.question,
        'option_a', q.option_a, 'option_b', q.option_b,
        'option_c', q.option_c, 'option_d', q.option_d,
        'marks', q.marks, 'negative_marks', q.negative_marks, 'order_index', q.order_index
      ) order by q.order_index, q.id), '[]'::jsonb)
      from public.mock_test_questions q where q.test_id = p_test_id
    )
  );
end;
$$;
grant execute on function public.start_test_attempt(bigint) to authenticated;

create or replace function public.save_answer(p_attempt_id bigint, p_question_id bigint, p_value text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  update public.attempts
    set answers = case
      when p_value is null then answers - p_question_id::text
      else jsonb_set(answers, array[p_question_id::text], to_jsonb(p_value))
    end
    where id = p_attempt_id and user_id = auth.uid() and submitted_at is null;
  if not found then raise exception 'Attempt not found or already submitted'; end if;
end;
$$;
grant execute on function public.save_answer(bigint, bigint, text) to authenticated;

create or replace function public.toggle_mark(p_attempt_id bigint, p_question_id bigint, p_marked boolean)
returns void language plpgsql security definer set search_path = public
as $$
declare
  v_marked jsonb;
begin
  select marked into v_marked from public.attempts
    where id = p_attempt_id and user_id = auth.uid() and submitted_at is null;
  if not found then raise exception 'Attempt not found or already submitted'; end if;

  if p_marked then
    if not (v_marked @> to_jsonb(p_question_id)) then
      v_marked := v_marked || to_jsonb(p_question_id);
    end if;
  else
    select coalesce(jsonb_agg(x), '[]'::jsonb) into v_marked
      from jsonb_array_elements(v_marked) x where x::text <> p_question_id::text;
  end if;

  update public.attempts set marked = v_marked where id = p_attempt_id;
end;
$$;
grant execute on function public.toggle_mark(bigint, bigint, boolean) to authenticated;

create or replace function public.submit_attempt(p_attempt_id bigint)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_attempt record;
  v_score numeric := 0;
  v_max numeric := 0;
  v_correct int := 0;
  v_wrong int := 0;
  v_unattempted int := 0;
  q record;
  v_given text;
begin
  select * into v_attempt from public.attempts where id = p_attempt_id and user_id = auth.uid();
  if not found then raise exception 'Attempt not found'; end if;
  if v_attempt.submitted_at is not null then raise exception 'Already submitted'; end if;

  for q in select * from public.mock_test_questions where test_id = v_attempt.test_id loop
    v_max := v_max + q.marks;
    v_given := v_attempt.answers ->> q.id::text;
    if v_given is null then
      v_unattempted := v_unattempted + 1;
    elsif v_given = q.correct_option then
      v_score := v_score + q.marks;
      v_correct := v_correct + 1;
    else
      v_score := v_score - q.negative_marks;
      v_wrong := v_wrong + 1;
    end if;
  end loop;

  update public.attempts set
    submitted_at = now(), score = v_score, max_score = v_max,
    correct_count = v_correct, wrong_count = v_wrong, unattempted_count = v_unattempted
  where id = p_attempt_id;

  return jsonb_build_object('score', v_score, 'max_score', v_max);
end;
$$;
grant execute on function public.submit_attempt(bigint) to authenticated;

-- ============================================================================
-- OPTIONAL: sample content so you have something to click through immediately.
-- Delete this block if you'd rather start empty.
-- ============================================================================
insert into public.notes (exam, subject, unit, title, content, is_premium) values
('CSIR NET', 'Life Science', 'Unit 1 - Molecules and their Interaction', 'Structure of Proteins',
 'Proteins are polymers of amino acids linked by peptide bonds.

Primary structure: linear sequence of amino acids.
Secondary structure: alpha helix and beta sheet.
Tertiary structure: overall 3D folding of a single polypeptide.
Quaternary structure: assembly of multiple polypeptide subunits.', false),
('CSIR NET', 'Life Science', 'Unit 2 - Cellular Organization', 'Cell Cycle and its Regulation',
 'The cell cycle has four phases: G1, S, G2, and M.

Cyclins and CDKs drive progression through checkpoints, and p53 is a key
tumor suppressor that halts the cycle on DNA damage.', true);

insert into public.pyqs (exam, subject, year, part, question, option_a, option_b, option_c, option_d, correct_option, explanation, is_premium) values
('CSIR NET', 'Life Science', 2023, 'B', 'Which organelle is the primary site of ATP synthesis via oxidative phosphorylation?',
 'Golgi apparatus', 'Mitochondrion', 'Peroxisome', 'Lysosome', 'B',
 'The inner mitochondrial membrane houses the electron transport chain and ATP synthase.', false);

with t as (
  insert into public.mock_tests (exam, subject, title, duration_minutes, is_premium)
  values ('CSIR NET', 'Life Science', 'CSIR NET Life Science - Full Mock Test 1', 180, false)
  returning id
)
insert into public.mock_test_questions (test_id, part, question, option_a, option_b, option_c, option_d, correct_option, marks, negative_marks, order_index)
select t.id, v.part, v.question, v.option_a, v.option_b, v.option_c, v.option_d, v.correct_option, 2, 0.5, v.order_index
from t, (values
  ('A', 'The next term in the series 2, 6, 12, 20, 30, ? is:', '36', '40', '42', '44', 'C', 0),
  ('A', 'If the ratio of two numbers is 3:4 and their sum is 63, the larger number is:', '27', '36', '32', '31', 'B', 1),
  ('B', 'Which enzyme unwinds DNA during replication?', 'DNA polymerase', 'Primase', 'Helicase', 'Ligase', 'C', 2),
  ('B', 'PCR relies primarily on which enzyme?', 'Reverse transcriptase', 'Taq polymerase', 'Restriction endonuclease', 'RNA polymerase', 'B', 3),
  ('C', 'In Hardy-Weinberg equilibrium with q = 0.2, what fraction is heterozygous?', '0.04', '0.32', '0.64', '0.16', 'B', 4)
) as v(part, question, option_a, option_b, option_c, option_d, correct_option, order_index);


-- ============================================================================
-- LAST STEP (do this manually, after you've signed up in the app once):
-- Run this to make your own account an admin. Replace the email.
--
--   update public.profiles set role = 'admin' where email = 'you@example.com';
--
-- And to give someone a paid plan (until you wire up real payments):
--
--   update public.profiles set plan = 'paid' where email = 'student@example.com';
-- ============================================================================

-- ############################################################################
-- ## migration_2_multi_exam.sql
-- ############################################################################

-- ============================================================================
-- Migration: multi-exam support (run this in Supabase → SQL Editor)
-- Safe to run once on your already-deployed database from the earlier schema.sql.
-- ============================================================================

-- Add an "exam" tag (CSIR NET, GATE, DU, HCU, ...) alongside the existing subject.
alter table public.notes add column if not exists exam text not null default 'General';
alter table public.pyqs add column if not exists exam text not null default 'General';
alter table public.mock_tests add column if not exists exam text not null default 'General';

-- New signups no longer get asked for a subject, so stop defaulting to a
-- CSIR-NET-specific one. Existing users keep whatever they already have.
alter table public.profiles alter column subject drop default;
alter table public.profiles alter column subject set default 'General';

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, subject)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', 'Student'),
    new.email,
    coalesce(new.raw_user_meta_data->>'subject', 'General')
  );
  return new;
end;
$$;

-- Include exam in the test list and the live-attempt payload.
create or replace function public.list_mock_tests()
returns setof jsonb language sql security definer set search_path = public stable
as $$
  select jsonb_build_object(
    'id', t.id, 'subject', t.subject, 'exam', t.exam, 'title', t.title,
    'duration_minutes', t.duration_minutes, 'is_premium', t.is_premium,
    'created_at', t.created_at,
    'question_count', (select count(*) from public.mock_test_questions q where q.test_id = t.id)
  )
  from public.mock_tests t
  where public.is_admin() or not t.is_premium or public.is_paid()
  order by t.created_at desc;
$$;
grant execute on function public.list_mock_tests() to authenticated;

create or replace function public.start_test_attempt(p_test_id bigint)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_test record;
  v_attempt record;
begin
  select * into v_test from public.mock_tests where id = p_test_id;
  if not found then raise exception 'Test not found'; end if;

  if not (public.is_admin() or not v_test.is_premium or public.is_paid()) then
    raise exception 'This test requires a paid plan';
  end if;

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
      'id', v_test.id, 'title', v_test.title, 'subject', v_test.subject, 'exam', v_test.exam,
      'duration_minutes', v_test.duration_minutes
    ),
    'questions', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', q.id, 'part', q.part, 'question', q.question,
        'option_a', q.option_a, 'option_b', q.option_b,
        'option_c', q.option_c, 'option_d', q.option_d,
        'marks', q.marks, 'negative_marks', q.negative_marks, 'order_index', q.order_index
      ) order by q.order_index, q.id), '[]'::jsonb)
      from public.mock_test_questions q where q.test_id = p_test_id
    )
  );
end;
$$;
grant execute on function public.start_test_attempt(bigint) to authenticated;

-- Tag your existing sample content so it doesn't just say "General" forever.
update public.notes set exam = 'CSIR NET' where exam = 'General';
update public.pyqs set exam = 'CSIR NET' where exam = 'General';
update public.mock_tests set exam = 'CSIR NET' where exam = 'General';

-- ############################################################################
-- ## migration_3_notice_board_and_access_tiers.sql
-- ############################################################################

-- ============================================================================
-- Migration 3: notice board, guest-preview access tier (Notes, PYQs AND Mock
-- Tests), PYQ exam sessions, manual note ordering, an admin-editable author/
-- footer section, and a fix so the PYQ admin form matches this table.
--
-- Safe to run once on your already-deployed database (after schema.sql and
-- migration_2_multi_exam.sql). Paste this whole file into Supabase →
-- SQL Editor → New query → Run. Every statement below is written so it can
-- be re-run without error if you ever need to — if you already ran an
-- earlier copy of this file, running this one again is safe.
-- ============================================================================

-- ---------- 1. Notice board ----------
create table if not exists public.announcements (
  id bigint generated always as identity primary key,
  title text not null,
  body text not null,
  is_pinned boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null
);
alter table public.announcements enable row level security;

drop policy if exists "announcements_select" on public.announcements;
create policy "announcements_select" on public.announcements
  for select using (is_active or public.is_admin());

drop policy if exists "announcements_admin_insert" on public.announcements;
create policy "announcements_admin_insert" on public.announcements for insert with check (public.is_admin());
drop policy if exists "announcements_admin_update" on public.announcements;
create policy "announcements_admin_update" on public.announcements for update using (public.is_admin());
drop policy if exists "announcements_admin_delete" on public.announcements;
create policy "announcements_admin_delete" on public.announcements for delete using (public.is_admin());

grant select on public.announcements to anon, authenticated;

-- ---------- 2. Guest-preview tier for Notes and PYQs ----------
-- is_preview: visible even to visitors who aren't logged in at all (a
-- curated free sample). A row can never be both "Paid plan only" and a
-- guest preview — the check constraints below enforce that at the database
-- level regardless of what the admin form sends.
alter table public.notes add column if not exists is_preview boolean not null default false;
alter table public.pyqs  add column if not exists is_preview boolean not null default false;

alter table public.notes drop constraint if exists notes_preview_not_premium;
alter table public.notes add constraint notes_preview_not_premium check (not (is_preview and is_premium));
alter table public.pyqs drop constraint if exists pyqs_preview_not_premium;
alter table public.pyqs add constraint pyqs_preview_not_premium check (not (is_preview and is_premium));

-- Previously ANY visitor (logged in or not) could see non-premium rows.
-- From now on: admins and paid users see everything; a logged-in free
-- account sees all non-premium content; a signed-out visitor only sees rows
-- explicitly marked is_preview.
drop policy if exists "notes_select" on public.notes;
create policy "notes_select" on public.notes
  for select using (
    public.is_admin()
    or public.is_paid()
    or (is_preview and not is_premium)
    or (not is_premium and auth.role() = 'authenticated')
  );

drop policy if exists "pyqs_select" on public.pyqs;
create policy "pyqs_select" on public.pyqs
  for select using (
    public.is_admin()
    or public.is_paid()
    or (is_preview and not is_premium)
    or (not is_premium and auth.role() = 'authenticated')
  );

grant select on public.notes to anon, authenticated;
grant select on public.pyqs to anon, authenticated;

-- ---------- 3. Manual ordering for Notes ----------
-- Lower numbers show first (set from the admin panel's "Reorder notes"
-- screen). NULL falls back automatically to the existing syllabus order.
alter table public.notes add column if not exists position integer;

-- ---------- 4. PYQ: exam sessions (e.g. CSIR NET runs in June AND December) ----------
alter table public.pyqs add column if not exists session text;

-- ---------- 5. PYQ: add the "content" column the current admin form needs ----------
-- At some point the PYQ editor was changed to store one formatted block
-- (question + options + answer) per entry, in a "content" column — but no
-- migration ever added that column here, so saving a PYQ has likely been
-- failing. This adds it, and — only if this table still has the older
-- separate question/option_a../correct_option columns from before that
-- change — best-effort combines them into "content" so existing questions
-- aren't lost. Safe to run whether or not those older columns still exist.
alter table public.pyqs add column if not exists content text;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pyqs' and column_name = 'question'
  ) then
    update public.pyqs set content = concat_ws(
      E'\n\n',
      question,
      concat_ws(E'\n', 'A) ' || option_a, 'B) ' || option_b, 'C) ' || option_c, 'D) ' || option_d),
      '**Answer: ' || correct_option || '**',
      nullif(explanation, '')
    )
    where content is null and question is not null;
  end if;
end $$;

-- ---------- 6. Guest-preview tier for Mock Tests ----------
-- Mock tests were the one section with no guest tier at all — the test
-- *catalog* (title, exam, subject, duration, question count — never the
-- actual questions) can now optionally be shown to signed-out visitors too,
-- same is_preview control as Notes and PYQs. Starting a test still always
-- requires an account, since a score has to belong to somebody.
alter table public.mock_tests add column if not exists is_preview boolean not null default false;
alter table public.mock_tests drop constraint if exists mock_tests_preview_not_premium;
alter table public.mock_tests add constraint mock_tests_preview_not_premium check (not (is_preview and is_premium));

drop policy if exists "mock_tests_select" on public.mock_tests;
create policy "mock_tests_select" on public.mock_tests
  for select using (
    public.is_admin()
    or public.is_paid()
    or (is_preview and not is_premium)
    or (not is_premium and auth.role() = 'authenticated')
  );

-- The test list actually reaches students through list_mock_tests() (it also
-- computes each test's question count), so update that function to match,
-- and extend its grant to signed-out visitors too.
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
  where public.is_admin()
    or public.is_paid()
    or (t.is_preview and not t.is_premium)
    or (not t.is_premium and auth.role() = 'authenticated')
  order by t.created_at desc;
$$;
grant execute on function public.list_mock_tests() to authenticated, anon;

-- Starting an attempt already requires auth.uid() (it's a foreign key on
-- attempts), so a signed-out call would previously fail with a generic
-- database error. This gives it a clear message instead — belt-and-braces,
-- since the frontend won't offer a signed-out visitor a "Start" button at all.
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
    'questions', (
      select jsonb_agg(jsonb_build_object(
        'id', q.id, 'part', q.part, 'question', q.question,
        'option_a', q.option_a, 'option_b', q.option_b, 'option_c', q.option_c, 'option_d', q.option_d,
        'marks', q.marks, 'negative_marks', q.negative_marks
      ) order by q.order_index)
      from public.mock_test_questions q where q.test_id = p_test_id
    )
  );
end;
$$;
grant execute on function public.start_test_attempt(bigint) to authenticated;

-- ---------- 7. Author / About information (site footer) ----------
-- Powers a small "About the creator" block shown in the footer on every page
-- (name, photo, short bio, email/Instagram/YouTube/website) — editable from
-- Admin → Author without a redeploy. Supports more than one entry in case a
-- co-author or team member is added later; each can be hidden independently.
create table if not exists public.authors (
  id bigint generated always as identity primary key,
  name text not null,
  photo_url text,
  bio text,
  email text,
  instagram_url text,
  youtube_url text,
  website_url text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.authors enable row level security;

drop policy if exists "authors_select" on public.authors;
create policy "authors_select" on public.authors
  for select using (is_active or public.is_admin());

drop policy if exists "authors_admin_insert" on public.authors;
create policy "authors_admin_insert" on public.authors for insert with check (public.is_admin());
drop policy if exists "authors_admin_update" on public.authors;
create policy "authors_admin_update" on public.authors for update using (public.is_admin());
drop policy if exists "authors_admin_delete" on public.authors;
create policy "authors_admin_delete" on public.authors for delete using (public.is_admin());

grant select on public.authors to anon, authenticated;

-- ============================================================================
-- After this finishes with no errors, deploy the updated frontend code —
-- no other manual database steps are needed.
-- ============================================================================

-- ############################################################################
-- ## migration_4_hints_and_results_cleanup.sql
-- ############################################################################

-- ============================================================================
-- Migration 4 — question hints, safer test saving, results clean-up
--
-- Run this ONCE in Supabase → SQL Editor → New query → Run, BEFORE deploying
-- the front-end build that goes with it. It is additive and safe to run again.
--
-- Supabase may pop up "Potential issue: query has destructive operations"
-- (it contains DELETE / DROP CONSTRAINT, which remove results of tests that no
-- longer exist and re-create the links). Click "Run this query" — cancelling
-- the pop-up means nothing was installed.
--
-- When it has worked, the result panel at the bottom shows one row with
-- save_mock_test_installed = true and hint_column_added = true. Make sure you
-- are in the SAME Supabase project that your website is connected to.
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
--   6. Lets a student remove their own entries from My Results (the "Remove"
--      button); until now the database refused every such delete.
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


-- Students can remove their own entries from My Results.
drop policy if exists "attempts_delete_own" on public.attempts;
create policy "attempts_delete_own" on public.attempts
  for delete using (user_id = auth.uid());


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
drop function if exists public.start_test_attempt(bigint);
create function public.start_test_attempt(p_test_id bigint)
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
drop function if exists public.list_mock_tests();
create function public.list_mock_tests()
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


-- ---------- 6. Make the change visible to the website, and confirm ----------
-- Supabase's API keeps a list of database functions; this tells it to re-read
-- the list now (otherwise a new function can stay "not found" for a while).
notify pgrst, 'reload schema';

select
  exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.proname = 'save_mock_test')           as save_mock_test_installed,
  exists (select 1 from information_schema.columns
          where table_schema = 'public' and table_name = 'mock_test_questions'
            and column_name = 'hint')                                            as hint_column_added,
  exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.proname = 'finalize_expired_attempts') as expired_attempts_handled;

-- ############################################################################
-- ## migration_5_plans_papers_exam_hub_question_bank.sql
-- ############################################################################

-- ============================================================================
-- Migration 5 — overlapping subscription plans, PDF papers, exam information
-- hub, practice question bank, updates centre, support inbox.
--
-- Run AFTER migration 4 (hints_and_results_cleanup). It rebuilds three of that
-- migration's functions with its behaviour kept, so it must come second. Paste the whole file into
-- Supabase → SQL Editor → New query → Run. Every statement is written to be
-- re-runnable, so running it twice is harmless.
--
-- What it does, in order
--   1. SECURITY FIX: students could previously change their own `plan` (and
--      even `role`) from the browser console, because the "update own profile"
--      rule had no column limits. A trigger now blocks that for non-admins.
--   2. Four overlapping plans: free < mock < notes_mock < complete, with an
--      expiry date. Existing 'paid' users become 'complete' (no expiry), so
--      nobody loses access.
--   3. One access rule (can_view) used by every protected table, enforced in
--      the database — hiding things in the UI is never what protects content.
--   4. New tables: plans (prices), pyq_papers (Drive PDFs), downloads, exam_info,
--      qb_questions / qb_answers / qb_progress (question bank),
--      subscription_requests, support_messages, site_settings.
--   5. Updates centre: categories + event dates on announcements.
-- ============================================================================


-- ---------- 1. Plan ranking helper ----------
create or replace function public.plan_rank(p text)
returns int language sql immutable as $$
  select case p when 'complete' then 3 when 'notes_mock' then 2 when 'mock' then 1 else 0 end;
$$;


-- ---------- 2. Profiles: new plan values + expiry ----------
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.profiles'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%plan%'
  loop
    execute format('alter table public.profiles drop constraint %I', c.conname);
  end loop;
end $$;

update public.profiles set plan = 'complete' where plan = 'paid';

alter table public.profiles
  add constraint profiles_plan_check check (plan in ('free', 'mock', 'notes_mock', 'complete'));
alter table public.profiles add column if not exists plan_expires_at timestamptz;

-- THE SECURITY FIX. A student may still edit harmless fields (name, subject),
-- but plan / plan_expires_at / role can only be changed by an admin, or by
-- trusted server-side code (SQL editor, service role, the grant_plan function
-- below), where auth.uid() is null.
create or replace function public.protect_profile_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if new.plan is distinct from old.plan
       or new.plan_expires_at is distinct from old.plan_expires_at
       or new.role is distinct from old.role then
      raise exception 'Plan and role can only be changed by an administrator';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists protect_profile_columns on public.profiles;
create trigger protect_profile_columns
  before update on public.profiles
  for each row execute procedure public.protect_profile_columns();


-- ---------- 3. Access helpers ----------
-- The plan that actually applies right now: admins get everything, an expired
-- subscription falls back to 'free', signed-out visitors are 'free'.
create or replace function public.current_plan()
returns text language sql security definer set search_path = public stable as $$
  select coalesce((
    select case
      when p.role = 'admin' then 'complete'
      when p.plan <> 'free' and (p.plan_expires_at is null or p.plan_expires_at > now()) then p.plan
      else 'free'
    end
    from public.profiles p where p.id = auth.uid()
  ), 'free');
$$;

create or replace function public.has_plan(p_min text)
returns boolean language sql security definer set search_path = public stable as $$
  select public.plan_rank(public.current_plan()) >= public.plan_rank(p_min);
$$;

-- One rule for "may this viewer read this row?":
--   admin, OR a signed-in student whose plan is high enough,
--   OR anyone (even signed-out) if the row is a free guest preview.
create or replace function public.can_view(p_min text, p_preview boolean)
returns boolean language sql security definer set search_path = public stable as $$
  select public.is_admin()
      or (auth.uid() is not null and public.has_plan(p_min))
      or (coalesce(p_preview, false) and p_min = 'free');
$$;

-- Kept for older policies (text PYQs): true for any active paid plan.
create or replace function public.is_paid()
returns boolean language sql security definer set search_path = public stable as $$
  select public.current_plan() <> 'free';
$$;

grant execute on function public.plan_rank(text) to anon, authenticated;
grant execute on function public.current_plan() to anon, authenticated;
grant execute on function public.has_plan(text) to anon, authenticated;
grant execute on function public.can_view(text, boolean) to anon, authenticated;


-- ---------- 4. Plans (prices are editable from Admin → Plans) ----------
create table if not exists public.plans (
  id text primary key check (id in ('free', 'mock', 'notes_mock', 'complete')),
  name text not null,
  rank int not null,
  price_monthly numeric,
  price_quarterly numeric,
  price_half_yearly numeric,
  price_yearly numeric,
  is_popular boolean not null default false,
  is_active boolean not null default true
);
alter table public.plans enable row level security;
drop policy if exists "plans_select" on public.plans;
create policy "plans_select" on public.plans for select using (true);
drop policy if exists "plans_admin_update" on public.plans;
create policy "plans_admin_update" on public.plans for update using (public.is_admin());
grant select on public.plans to anon, authenticated;

-- Prices are deliberately left empty: set them in Admin → Plans.
insert into public.plans (id, name, rank, is_popular) values
  ('free', 'Free', 0, false),
  ('mock', 'Mock Test', 1, false),
  ('notes_mock', 'Notes + Mock', 2, true),
  ('complete', 'Complete', 3, false)
on conflict (id) do nothing;


-- ---------- 5. Site settings (contact + payment instructions) ----------
create table if not exists public.site_settings (
  key text primary key,
  value text not null default ''
);
alter table public.site_settings enable row level security;
drop policy if exists "site_settings_select" on public.site_settings;
create policy "site_settings_select" on public.site_settings for select using (true);
drop policy if exists "site_settings_admin_write" on public.site_settings;
create policy "site_settings_admin_write" on public.site_settings for all
  using (public.is_admin()) with check (public.is_admin());
grant select on public.site_settings to anon, authenticated;


-- ---------- 6. Notes and mock tests: required plan per item ----------
alter table public.notes add column if not exists min_plan text not null default 'free';
alter table public.mock_tests add column if not exists min_plan text not null default 'free';

alter table public.notes drop constraint if exists notes_min_plan_check;
alter table public.notes add constraint notes_min_plan_check
  check (min_plan in ('free', 'mock', 'notes_mock', 'complete'));
alter table public.mock_tests drop constraint if exists mock_tests_min_plan_check;
alter table public.mock_tests add constraint mock_tests_min_plan_check
  check (min_plan in ('free', 'mock', 'notes_mock', 'complete'));

-- What kind of test it is, so students can filter Full-length / Subject-wise /
-- Topic-wise / PYQ-style. Existing tests are treated as full-length.
alter table public.mock_tests add column if not exists kind text not null default 'full';
alter table public.mock_tests drop constraint if exists mock_tests_kind_check;
alter table public.mock_tests add constraint mock_tests_kind_check
  check (kind in ('full', 'subject', 'topic', 'pyq_style'));

-- Existing "Paid plan only" items map onto the plan that sells them.
update public.notes set min_plan = 'notes_mock' where is_premium and min_plan = 'free';
update public.mock_tests set min_plan = 'mock' where is_premium and min_plan = 'free';

-- Keeps the old is_premium flag and the new min_plan in step, so the old
-- admin form (or any old client) can never leave them disagreeing.
create or replace function public.sync_min_plan()
returns trigger language plpgsql as $$
declare v_default text := coalesce(tg_argv[0], 'notes_mock');
begin
  if new.min_plan = 'free' and new.is_premium and (tg_op = 'INSERT' or not old.is_premium) then
    new.min_plan := v_default;
  end if;
  new.is_premium := (new.min_plan <> 'free');
  if new.is_premium then new.is_preview := false; end if;
  return new;
end;
$$;
drop trigger if exists notes_sync_min_plan on public.notes;
create trigger notes_sync_min_plan before insert or update on public.notes
  for each row execute procedure public.sync_min_plan('notes_mock');
drop trigger if exists mock_tests_sync_min_plan on public.mock_tests;
create trigger mock_tests_sync_min_plan before insert or update on public.mock_tests
  for each row execute procedure public.sync_min_plan('mock');

drop policy if exists "notes_select" on public.notes;
create policy "notes_select" on public.notes
  for select using (public.can_view(min_plan, is_preview));

drop policy if exists "mock_tests_select" on public.mock_tests;
create policy "mock_tests_select" on public.mock_tests
  for select using (public.can_view(min_plan, is_preview));

-- The notes catalog: titles are visible to everybody (so locked notes can be
-- shown with a lock and an upgrade prompt); the note TEXT is still protected
-- by the policy above and is only returned to viewers who may read it.
create or replace function public.list_notes_catalog()
returns table (
  id bigint, exam text, subject text, unit text, title text, created_at timestamptz,
  min_plan text, is_preview boolean, "position" integer, has_access boolean
)
language sql security definer set search_path = public stable as $$
  select n.id, n.exam, n.subject, n.unit, n.title, n.created_at,
         n.min_plan, n.is_preview, n."position",
         public.can_view(n.min_plan, n.is_preview)
  from public.notes n
  order by n.subject, n.unit;
$$;
grant execute on function public.list_notes_catalog() to anon, authenticated;

-- ---- Mock tests: saving, listing and starting ----
-- These three functions were last defined in migration 4 (hints, safe saving,
-- expired-attempt clean-up). They are re-created here with migration 4's behaviour
-- kept exactly as it was, plus the plan check and the new plan / kind fields.
-- That is why migration 4 must be installed first.

-- Saving: migration 4's save_mock_test, now also storing min_plan and kind.
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
    insert into public.mock_tests (exam, subject, title, duration_minutes, is_premium, is_preview, min_plan, kind)
    values (
      coalesce(nullif(btrim(p_test ->> 'exam'), ''), 'General'),
      p_test ->> 'subject',
      p_test ->> 'title',
      coalesce((p_test ->> 'duration_minutes')::int, 180),
      coalesce((p_test ->> 'is_premium')::boolean, false),
      coalesce((p_test ->> 'is_preview')::boolean, false),
      coalesce(nullif(btrim(p_test ->> 'min_plan'), ''), 'free'),
      coalesce(nullif(btrim(p_test ->> 'kind'), ''), 'full')
    )
    returning id into v_id;
  else
    update public.mock_tests set
      exam = coalesce(nullif(btrim(p_test ->> 'exam'), ''), exam),
      subject = coalesce(p_test ->> 'subject', subject),
      title = coalesce(p_test ->> 'title', title),
      duration_minutes = coalesce((p_test ->> 'duration_minutes')::int, duration_minutes),
      is_premium = coalesce((p_test ->> 'is_premium')::boolean, is_premium),
      is_preview = coalesce((p_test ->> 'is_preview')::boolean, is_preview),
      min_plan = coalesce(nullif(btrim(p_test ->> 'min_plan'), ''), min_plan),
      kind = coalesce(nullif(btrim(p_test ->> 'kind'), ''), kind)
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

-- Listing: every test is listed (locked ones too, flagged has_access) so students
-- can see what a higher plan unlocks. The questions never leave the database.
create or replace function public.list_mock_tests()
returns setof jsonb language sql security definer set search_path = public stable
as $$
  select jsonb_build_object(
    'id', t.id, 'subject', t.subject, 'exam', t.exam, 'title', t.title,
    'duration_minutes', t.duration_minutes, 'is_premium', t.is_premium, 'is_preview', t.is_preview,
    'min_plan', t.min_plan, 'kind', t.kind,
    'has_access', (auth.uid() is not null and public.has_plan(t.min_plan)),
    'created_at', t.created_at,
    'question_count', (select count(*) from public.mock_test_questions q where q.test_id = t.id)
  )
  from public.mock_tests t
  -- As in migration 4: a test with no questions is only listed for admins.
  where public.is_admin()
     or exists (select 1 from public.mock_test_questions q where q.test_id = t.id)
  order by t.created_at desc;
$$;
grant execute on function public.list_mock_tests() to authenticated, anon;

-- Starting: migration 4's version, with the plan check using the new plans.
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

  if not public.has_plan(v_test.min_plan) then
    raise exception 'This test is part of a higher plan';
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


-- ---------- 7. Previous-year papers: PDFs hosted on Google Drive ----------
-- Always free and public. paper_url / key_url are Drive "share" links; the
-- site turns them into an embedded viewer. The files must be shared as
-- "Anyone with the link can view".
create table if not exists public.pyq_papers (
  id bigint generated always as identity primary key,
  exam text not null,
  year int not null,
  session text,
  subject text not null default 'Physics',
  title text,
  paper_url text not null,
  key_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.pyq_papers enable row level security;
drop policy if exists "pyq_papers_select" on public.pyq_papers;
create policy "pyq_papers_select" on public.pyq_papers for select using (is_active or public.is_admin());
drop policy if exists "pyq_papers_admin_insert" on public.pyq_papers;
create policy "pyq_papers_admin_insert" on public.pyq_papers for insert with check (public.is_admin());
drop policy if exists "pyq_papers_admin_update" on public.pyq_papers;
create policy "pyq_papers_admin_update" on public.pyq_papers for update using (public.is_admin());
drop policy if exists "pyq_papers_admin_delete" on public.pyq_papers;
create policy "pyq_papers_admin_delete" on public.pyq_papers for delete using (public.is_admin());
grant select on public.pyq_papers to anon, authenticated;


-- ---------- 8. Exam information hub ----------
-- One row per card/section entry. 'syllabus' and 'faq' rows render as
-- expandable items; everything else renders as a card. Body supports the same
-- Markdown + LaTeX + tables as notes.
create table if not exists public.exam_info (
  id bigint generated always as identity primary key,
  exam text not null,
  section text not null check (section in
    ('overview', 'pattern', 'syllabus', 'eligibility', 'cutoffs', 'calendar', 'strategy', 'faq')),
  title text not null,
  body text not null default '',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.exam_info enable row level security;
drop policy if exists "exam_info_select" on public.exam_info;
create policy "exam_info_select" on public.exam_info for select using (is_active or public.is_admin());
drop policy if exists "exam_info_admin_insert" on public.exam_info;
create policy "exam_info_admin_insert" on public.exam_info for insert with check (public.is_admin());
drop policy if exists "exam_info_admin_update" on public.exam_info;
create policy "exam_info_admin_update" on public.exam_info for update using (public.is_admin());
drop policy if exists "exam_info_admin_delete" on public.exam_info;
create policy "exam_info_admin_delete" on public.exam_info for delete using (public.is_admin());
grant select on public.exam_info to anon, authenticated;


-- ---------- 9. Updates centre (replaces the plain notice board) ----------
alter table public.announcements add column if not exists category text not null default 'general';
alter table public.announcements add column if not exists event_date date;
alter table public.announcements add column if not exists link_url text;
alter table public.announcements drop constraint if exists announcements_category_check;
alter table public.announcements add constraint announcements_category_check
  check (category in ('general', 'exam_notice', 'deadline', 'admit_card', 'new_material', 'new_test'));


-- ---------- 10. Practice question bank ----------
create table if not exists public.qb_questions (
  id bigint generated always as identity primary key,
  exam text not null,
  subject text not null,
  unit text not null,
  qtype text not null check (qtype in ('mcq', 'msq', 'nat')),
  difficulty text not null default 'medium' check (difficulty in ('easy', 'medium', 'hard')),
  content text not null,                -- the question text, Markdown/LaTeX (options are kept separately)
  options jsonb not null default '[]'::jsonb,   -- ["option A text", "option B text", ...]; empty for numerical questions
  source text,                          -- e.g. "CSIR NET Dec 2022"
  min_plan text not null default 'notes_mock'
    check (min_plan in ('free', 'mock', 'notes_mock', 'complete')),
  is_preview boolean not null default false,
  created_at timestamptz not null default now(),
  constraint qb_preview_only_free check (not (is_preview and min_plan <> 'free'))
);
create index if not exists qb_questions_topic_idx on public.qb_questions (exam, subject, unit);
alter table public.qb_questions enable row level security;
drop policy if exists "qb_questions_select" on public.qb_questions;
create policy "qb_questions_select" on public.qb_questions
  for select using (public.can_view(min_plan, is_preview));
drop policy if exists "qb_questions_admin_insert" on public.qb_questions;
create policy "qb_questions_admin_insert" on public.qb_questions for insert with check (public.is_admin());
drop policy if exists "qb_questions_admin_update" on public.qb_questions;
create policy "qb_questions_admin_update" on public.qb_questions for update using (public.is_admin());
drop policy if exists "qb_questions_admin_delete" on public.qb_questions;
create policy "qb_questions_admin_delete" on public.qb_questions for delete using (public.is_admin());
grant select on public.qb_questions to anon, authenticated;

-- Answers live in their own table that only admins can read, so a student can
-- never pull the answer key out of the API. Checking goes through
-- check_qb_answer() below, which only reveals the answer after an attempt.
create table if not exists public.qb_answers (
  question_id bigint primary key references public.qb_questions(id) on delete cascade,
  answer_key text not null,             -- mcq: B   msq: A,C   nat: 3.14
  nat_tolerance numeric not null default 0,
  explanation text not null default ''
);
alter table public.qb_answers enable row level security;
drop policy if exists "qb_answers_admin_all" on public.qb_answers;
create policy "qb_answers_admin_all" on public.qb_answers for all
  using (public.is_admin()) with check (public.is_admin());

create table if not exists public.qb_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id bigint not null references public.qb_questions(id) on delete cascade,
  attempts integer not null default 0,
  is_correct boolean,
  last_response text,
  last_attempted_at timestamptz,
  bookmarked boolean not null default false,
  primary key (user_id, question_id)
);
alter table public.qb_progress enable row level security;
-- Read-only for the owner. Writes happen only inside the functions below, so
-- nobody can mark themselves "correct" by calling the API directly.
drop policy if exists "qb_progress_select_own" on public.qb_progress;
create policy "qb_progress_select_own" on public.qb_progress for select using (user_id = auth.uid());

create or replace function public.check_qb_answer(p_question_id bigint, p_response text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  q record;
  a record;
  v_ok boolean := false;
  v_resp text := btrim(coalesce(p_response, ''));
begin
  if auth.uid() is null then raise exception 'Please log in to practise'; end if;
  if v_resp = '' then raise exception 'Choose or enter an answer first'; end if;

  select * into q from public.qb_questions where id = p_question_id;
  if not found then raise exception 'Question not found'; end if;
  if not public.has_plan(q.min_plan) then raise exception 'This question is part of a higher plan'; end if;

  select * into a from public.qb_answers where question_id = p_question_id;
  if not found then raise exception 'No answer key has been set for this question yet'; end if;

  if q.qtype = 'nat' then
    begin
      v_ok := abs(v_resp::numeric - a.answer_key::numeric) <= coalesce(a.nat_tolerance, 0);
    exception when others then
      v_ok := false;
    end;
  elsif q.qtype = 'msq' then
    v_ok := (
      select coalesce(string_agg(x, ',' order by x), '')
      from unnest(string_to_array(upper(regexp_replace(v_resp, '\s', '', 'g')), ',')) x
    ) = (
      select coalesce(string_agg(x, ',' order by x), '')
      from unnest(string_to_array(upper(regexp_replace(a.answer_key, '\s', '', 'g')), ',')) x
    );
  else
    v_ok := upper(v_resp) = upper(btrim(a.answer_key));
  end if;

  insert into public.qb_progress (user_id, question_id, attempts, is_correct, last_response, last_attempted_at)
  values (auth.uid(), p_question_id, 1, v_ok, v_resp, now())
  on conflict (user_id, question_id) do update
    set attempts = public.qb_progress.attempts + 1,
        is_correct = v_ok, last_response = v_resp, last_attempted_at = now();

  return jsonb_build_object(
    'is_correct', v_ok, 'answer_key', a.answer_key,
    'explanation', coalesce(a.explanation, '')
  );
end;
$$;
grant execute on function public.check_qb_answer(bigint, text) to authenticated;

create or replace function public.toggle_qb_bookmark(p_question_id bigint, p_value boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Please log in to save questions'; end if;
  if not exists (select 1 from public.qb_questions where id = p_question_id) then
    raise exception 'Question not found';
  end if;
  insert into public.qb_progress (user_id, question_id, attempts, bookmarked)
  values (auth.uid(), p_question_id, 0, p_value)
  on conflict (user_id, question_id) do update set bookmarked = p_value;
end;
$$;
grant execute on function public.toggle_qb_bookmark(bigint, boolean) to authenticated;

-- Topic grid for the question bank: totals, what this viewer can open, and
-- (for signed-in students) their own progress per topic.
create or replace function public.qb_topic_summary()
returns table (exam text, subject text, unit text, total bigint, accessible bigint, attempted bigint, correct bigint)
language sql security definer set search_path = public stable as $$
  select q.exam, q.subject, q.unit,
         count(*)::bigint,
         (count(*) filter (where public.can_view(q.min_plan, q.is_preview)))::bigint,
         (count(*) filter (where p.last_attempted_at is not null))::bigint,
         (count(*) filter (where p.is_correct))::bigint
  from public.qb_questions q
  left join public.qb_progress p on p.question_id = q.id and p.user_id = auth.uid()
  group by q.exam, q.subject, q.unit;
$$;
grant execute on function public.qb_topic_summary() to anon, authenticated;

create or replace function public.qb_stats()
returns jsonb language sql security definer set search_path = public stable as $$
  select jsonb_build_object(
    'attempted', count(*) filter (where last_attempted_at is not null),
    'correct', count(*) filter (where is_correct),
    'bookmarked', count(*) filter (where bookmarked)
  )
  from public.qb_progress where user_id = auth.uid();
$$;
grant execute on function public.qb_stats() to authenticated;


-- ---------- 11. Subscriptions: requests + admin activation ----------
create table if not exists public.subscription_requests (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan text not null check (plan in ('mock', 'notes_mock', 'complete')),
  period text not null check (period in ('monthly', 'quarterly', 'half_yearly', 'yearly')),
  amount numeric,                        -- what the student saw; informational only
  payment_ref text,                      -- UPI transaction id / note from the student
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
alter table public.subscription_requests enable row level security;
drop policy if exists "sub_requests_select" on public.subscription_requests;
create policy "sub_requests_select" on public.subscription_requests
  for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists "sub_requests_insert_own" on public.subscription_requests;
create policy "sub_requests_insert_own" on public.subscription_requests
  for insert with check (user_id = auth.uid() and status = 'pending');

-- Extends the same plan if it is still active (renewal), otherwise starts now
-- (new plan or upgrade). Not callable from the browser; the admin_* wrappers
-- below check is_admin(), and a future payment webhook can call it with the
-- service-role key.
create or replace function public.grant_plan(p_user uuid, p_plan text, p_months int)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare
  v_cur record;
  v_start timestamptz := now();
  v_expiry timestamptz;
begin
  if p_plan not in ('free', 'mock', 'notes_mock', 'complete') then
    raise exception 'Unknown plan';
  end if;
  if p_plan = 'free' then
    update public.profiles set plan = 'free', plan_expires_at = null where id = p_user;
    return null;
  end if;
  if p_months is null or p_months < 1 then raise exception 'Duration must be at least 1 month'; end if;

  select plan, plan_expires_at into v_cur from public.profiles where id = p_user;
  if v_cur.plan = p_plan and v_cur.plan_expires_at is not null and v_cur.plan_expires_at > now() then
    v_start := v_cur.plan_expires_at;
  end if;
  v_expiry := v_start + make_interval(months => p_months);

  update public.profiles set plan = p_plan, plan_expires_at = v_expiry where id = p_user;
  return v_expiry;
end;
$$;
revoke execute on function public.grant_plan(uuid, text, int) from public, anon, authenticated;

create or replace function public.admin_grant_plan(p_user uuid, p_plan text, p_months int)
returns timestamptz language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  return public.grant_plan(p_user, p_plan, p_months);
end;
$$;
grant execute on function public.admin_grant_plan(uuid, text, int) to authenticated;

create or replace function public.admin_decide_subscription(p_request_id bigint, p_approve boolean)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_months int;
  v_expiry timestamptz;
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  select * into r from public.subscription_requests where id = p_request_id;
  if not found then raise exception 'Request not found'; end if;
  if r.status <> 'pending' then raise exception 'This request was already decided'; end if;

  if p_approve then
    v_months := case r.period when 'monthly' then 1 when 'quarterly' then 3 when 'half_yearly' then 6 else 12 end;
    v_expiry := public.grant_plan(r.user_id, r.plan, v_months);
    update public.subscription_requests set status = 'approved', decided_at = now() where id = p_request_id;
  else
    update public.subscription_requests set status = 'rejected', decided_at = now() where id = p_request_id;
  end if;
  return v_expiry;
end;
$$;
grant execute on function public.admin_decide_subscription(bigint, boolean) to authenticated;


-- ---------- 12. Support / feedback inbox ----------
create table if not exists public.support_messages (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  email text not null,
  kind text not null default 'query' check (kind in ('query', 'feedback', 'technical')),
  message text not null,
  status text not null default 'new' check (status in ('new', 'resolved')),
  created_at timestamptz not null default now(),
  constraint support_message_len check (char_length(message) between 5 and 4000),
  constraint support_email_len check (char_length(email) between 5 and 200),
  constraint support_name_len check (char_length(name) between 1 and 120)
);
alter table public.support_messages enable row level security;
drop policy if exists "support_insert_anyone" on public.support_messages;
create policy "support_insert_anyone" on public.support_messages
  for insert with check (user_id is null or user_id = auth.uid());
drop policy if exists "support_admin_select" on public.support_messages;
create policy "support_admin_select" on public.support_messages for select using (public.is_admin());
drop policy if exists "support_admin_update" on public.support_messages;
create policy "support_admin_update" on public.support_messages for update using (public.is_admin());
drop policy if exists "support_admin_delete" on public.support_messages;
create policy "support_admin_delete" on public.support_messages for delete using (public.is_admin());
grant insert on public.support_messages to anon, authenticated;


-- ---------- 13. Downloads: Drive links to papers, sample material, cheat sheets ----------
-- Anything you want students to open or save from Google Drive. The category is
-- free text (pick an existing one or type a new one), so new kinds of material
-- need no code change. Each item can be free or tied to a plan; the Drive link is
-- only released to viewers whose plan allows it, locked items show their title only.
create table if not exists public.downloads (
  id bigint generated always as identity primary key,
  title text not null,
  description text,
  category text not null default 'Other',
  exam text,
  link_url text not null,
  min_plan text not null default 'free' check (min_plan in ('free', 'mock', 'notes_mock', 'complete')),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.downloads enable row level security;
-- Direct table access is for admins only; students read through list_downloads().
drop policy if exists "downloads_admin_select" on public.downloads;
create policy "downloads_admin_select" on public.downloads for select using (public.is_admin());
drop policy if exists "downloads_admin_insert" on public.downloads;
create policy "downloads_admin_insert" on public.downloads for insert with check (public.is_admin());
drop policy if exists "downloads_admin_update" on public.downloads;
create policy "downloads_admin_update" on public.downloads for update using (public.is_admin());
drop policy if exists "downloads_admin_delete" on public.downloads;
create policy "downloads_admin_delete" on public.downloads for delete using (public.is_admin());

create or replace function public.list_downloads()
returns table (
  id bigint, title text, description text, category text, exam text, min_plan text,
  sort_order integer, created_at timestamptz, has_access boolean, link_url text
)
language sql security definer set search_path = public stable as $$
  select d.id, d.title, d.description, d.category, d.exam, d.min_plan, d.sort_order, d.created_at,
         public.can_view(d.min_plan, true),
         case when public.can_view(d.min_plan, true) then d.link_url else null end
  from public.downloads d
  where d.is_active
  order by d.sort_order, d.id desc;
$$;
grant execute on function public.list_downloads() to anon, authenticated;


-- ---------- Make the change visible to the website, and confirm ----------
notify pgrst, 'reload schema';

select
  exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.proname = 'list_downloads')          as downloads_installed,
  exists (select 1 from information_schema.tables
          where table_schema = 'public' and table_name = 'plans')               as plans_installed,
  exists (select 1 from pg_trigger where tgname = 'protect_profile_columns')    as plan_protection_on;

-- ============================================================================
-- Done. Next: deploy the new frontend, then in the app open Admin → Plans & Prices
-- to set prices and Admin → Settings & Social to add your contact, payment and
-- social-media details.
-- ============================================================================
