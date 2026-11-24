-- ============================================================================
-- Migration 7 — topics inside the Question Bank
--
-- Run AFTER migration 6. Paste the whole file into Supabase → SQL Editor →
-- New query → Run. Every statement can be re-run safely.
--
-- When it has worked, the result panel at the bottom shows one row:
--   topic_column_added = true, topic_summary_ready = true
--
-- What it does
--   Questions already belong to an exam, a subject and a unit (e.g. CSIR NET ›
--   Physics › Mathematical Methods of Physics). This adds an optional TOPIC
--   inside the unit (e.g. "Vector Analysis", "Fourier Series"), so students
--   can practise one topic at a time. Existing questions keep working; they
--   simply have no topic until you give them one in Admin → Question Bank.
-- ============================================================================


-- ---------- 1. The topic column ----------
alter table public.qb_questions add column if not exists topic text;
alter table public.qb_questions drop constraint if exists qb_questions_topic_len;
alter table public.qb_questions add constraint qb_questions_topic_len
  check (topic is null or char_length(topic) <= 120);

-- Blank topics are stored as "no topic", and spaces are tidied, so
-- "Vector  Analysis " and "Vector Analysis" count as the same topic.
create or replace function public.qb_tidy_topic()
returns trigger language plpgsql as $$
begin
  new.topic := nullif(regexp_replace(btrim(coalesce(new.topic, '')), '\s+', ' ', 'g'), '');
  return new;
end;
$$;
drop trigger if exists qb_tidy_topic on public.qb_questions;
create trigger qb_tidy_topic before insert or update of topic on public.qb_questions
  for each row execute function public.qb_tidy_topic();

create index if not exists qb_questions_unit_topic_idx on public.qb_questions (exam, subject, unit, topic);


-- ---------- 2. The topic list with each student's progress ----------
-- Same as before, but one row per topic (topic is empty for questions that
-- have none). The result shape changes, so the old version is dropped first.
drop function if exists public.qb_topic_summary();
create function public.qb_topic_summary()
returns table (exam text, subject text, unit text, topic text,
               total bigint, accessible bigint, attempted bigint, correct bigint)
language sql security definer set search_path = public stable as $$
  select q.exam, q.subject, q.unit, coalesce(q.topic, ''),
         count(*)::bigint,
         (count(*) filter (where public.can_view(q.min_plan, q.is_preview)))::bigint,
         (count(*) filter (where p.last_attempted_at is not null))::bigint,
         (count(*) filter (where p.is_correct))::bigint
  from public.qb_questions q
  left join public.qb_progress p on p.question_id = q.id and p.user_id = auth.uid()
  group by q.exam, q.subject, q.unit, coalesce(q.topic, '');
$$;
grant execute on function public.qb_topic_summary() to anon, authenticated;


-- ---------- Make the change visible to the website, and confirm ----------
notify pgrst, 'reload schema';

select
  exists (select 1 from information_schema.columns
          where table_schema = 'public' and table_name = 'qb_questions' and column_name = 'topic') as topic_column_added,
  exists (select 1 from information_schema.routines r
          join information_schema.parameters p on p.specific_name = r.specific_name
          where r.routine_schema = 'public' and r.routine_name = 'qb_topic_summary'
            and p.parameter_mode = 'OUT' and p.parameter_name = 'topic')                    as topic_summary_ready;
