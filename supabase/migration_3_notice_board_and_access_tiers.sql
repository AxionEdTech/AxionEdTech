-- ============================================================================
<<<<<<< HEAD
-- Migration 3: notice board, guest-preview access tier, PYQ exam sessions,
-- manual note ordering, and a fix so the PYQ admin form matches this table.
=======
-- Migration 3: notice board, guest-preview access tier (Notes, PYQs AND Mock
-- Tests), PYQ exam sessions, manual note ordering, an admin-editable author/
-- footer section, and a fix so the PYQ admin form matches this table.
>>>>>>> eff2ac1 (Notice board, access tiers, PYQ sessions, mock test bulk entry, author footer)
--
-- Safe to run once on your already-deployed database (after schema.sql and
-- migration_2_multi_exam.sql). Paste this whole file into Supabase →
-- SQL Editor → New query → Run. Every statement below is written so it can
<<<<<<< HEAD
-- be re-run without error if you ever need to.
=======
-- be re-run without error if you ever need to — if you already ran an
-- earlier copy of this file, running this one again is safe.
>>>>>>> eff2ac1 (Notice board, access tiers, PYQ sessions, mock test bulk entry, author footer)
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

<<<<<<< HEAD
=======
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

>>>>>>> eff2ac1 (Notice board, access tiers, PYQ sessions, mock test bulk entry, author footer)
-- ============================================================================
-- After this finishes with no errors, deploy the updated frontend code —
-- no other manual database steps are needed.
-- ============================================================================
