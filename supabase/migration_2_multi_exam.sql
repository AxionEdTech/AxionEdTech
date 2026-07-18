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
