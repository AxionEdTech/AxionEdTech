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
