-- ============================================================================
-- Migration 6 — phone number at sign-up, plus three database fixes
--
-- Run AFTER migration 5. Paste the whole file into Supabase → SQL Editor →
-- New query → Run. Every statement can be re-run safely.
--
-- When it has worked, the result panel at the bottom shows one row:
--   phone_column_added = true, pyq_save_fixed = true, answer_deadline_on = true
--
-- What it does
--   1. Adds an optional "phone" column to student profiles. The sign-up form
--      sends it along with the name; nothing checks or verifies it, it is just
--      extra contact information that admins see in Admin → Students.
--   2. Fixes "Add PYQ (text)" in Admin: the old separate question / option_a..d
--      / correct_option columns were still marked required, so saving a PYQ in
--      the current one-box format was refused by the database.
--   3. A test answer can no longer be saved after that test's time has run out
--      (two minutes of grace for slow connections, same as the auto-close rule).
--      Until now only the countdown in the browser stopped it.
--   4. A student can no longer change the email shown on their own profile
--      from the browser console (plan and role were already protected).
-- ============================================================================


-- ---------- 1. Phone number ----------
alter table public.profiles add column if not exists phone text;
alter table public.profiles drop constraint if exists profiles_phone_len;
alter table public.profiles add constraint profiles_phone_len check (phone is null or char_length(phone) <= 30);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, subject, phone)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data->>'name'), ''), 'Student'),
    new.email,
    coalesce(new.raw_user_meta_data->>'subject', 'General'),
    left(nullif(btrim(new.raw_user_meta_data->>'phone'), ''), 30)
  );
  return new;
end;
$$;

-- Anyone who signed up with the new form before this migration was run:
-- their number was kept with their login, so copy it across.
update public.profiles p
   set phone = left(nullif(btrim(u.raw_user_meta_data->>'phone'), ''), 30)
  from auth.users u
 where u.id = p.id
   and p.phone is null
   and nullif(btrim(u.raw_user_meta_data->>'phone'), '') is not null;


-- ---------- 2. PYQ (text) saving ----------
-- The admin form stores one formatted "content" block per question. Older
-- databases still had the earlier separate columns as NOT NULL.
do $$
declare col text;
begin
  foreach col in array array['question', 'option_a', 'option_b', 'option_c', 'option_d', 'correct_option'] loop
    if exists (select 1 from information_schema.columns
               where table_schema = 'public' and table_name = 'pyqs' and column_name = col
                 and is_nullable = 'NO') then
      execute format('alter table public.pyqs alter column %I drop not null', col);
    end if;
  end loop;
end $$;


-- ---------- 3. No answers after the time is up ----------
create or replace function public.save_answer(p_attempt_id bigint, p_question_id bigint, p_value text)
returns void language plpgsql security definer set search_path = public
as $$
declare
  v_attempt record;
  v_value text := upper(nullif(btrim(p_value), ''));
begin
  select a.id, a.test_id, a.started_at, t.duration_minutes
    into v_attempt
    from public.attempts a
    join public.mock_tests t on t.id = a.test_id
   where a.id = p_attempt_id and a.user_id = auth.uid() and a.submitted_at is null;
  if not found then raise exception 'Attempt not found or already submitted'; end if;

  if now() > v_attempt.started_at + make_interval(mins => v_attempt.duration_minutes) + interval '2 minutes' then
    raise exception 'Time is up for this test';
  end if;

  if not exists (select 1 from public.mock_test_questions where id = p_question_id and test_id = v_attempt.test_id) then
    raise exception 'That question is not part of this test';
  end if;

  if v_value is not null and v_value not in ('A', 'B', 'C', 'D') then
    raise exception 'Answer must be A, B, C or D';
  end if;

  update public.attempts
     set answers = case
       when v_value is null then answers - p_question_id::text
       else jsonb_set(answers, array[p_question_id::text], to_jsonb(v_value))
     end
   where id = p_attempt_id;
end;
$$;
grant execute on function public.save_answer(bigint, bigint, text) to authenticated;


-- ---------- 4. Profile protection now includes email ----------
create or replace function public.protect_profile_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if new.plan is distinct from old.plan
       or new.plan_expires_at is distinct from old.plan_expires_at
       or new.role is distinct from old.role
       or new.email is distinct from old.email then
      raise exception 'Plan, role and email can only be changed by an administrator';
    end if;
  end if;
  return new;
end;
$$;


-- ---------- Make the change visible to the website, and confirm ----------
notify pgrst, 'reload schema';

select
  exists (select 1 from information_schema.columns
          where table_schema = 'public' and table_name = 'profiles' and column_name = 'phone') as phone_column_added,
  not exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'pyqs'
                and column_name in ('question', 'option_a', 'option_b', 'option_c', 'option_d', 'correct_option')
                and is_nullable = 'NO')                                                  as pyq_save_fixed,
  exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.proname = 'save_answer'
            and pg_get_functiondef(p.oid) ilike '%Time is up%')                         as answer_deadline_on;
