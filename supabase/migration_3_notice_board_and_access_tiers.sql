-- ============================================================================
-- Migration 3: notice board, guest-preview access tier, PYQ exam sessions,
-- manual note ordering, and a fix so the PYQ admin form matches this table.
--
-- Safe to run once on your already-deployed database (after schema.sql and
-- migration_2_multi_exam.sql). Paste this whole file into Supabase →
-- SQL Editor → New query → Run. Every statement below is written so it can
-- be re-run without error if you ever need to.
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

-- ============================================================================
-- After this finishes with no errors, deploy the updated frontend code —
-- no other manual database steps are needed.
-- ============================================================================
