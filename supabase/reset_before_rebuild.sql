-- ============================================================================
-- RESET script — run this FIRST, before schema.sql.
-- Wipes the mismatched tables from the other tool's changes and starts clean.
-- Your actual login accounts (in Supabase's own auth system) are NOT affected —
-- only the extra data tables get removed and rebuilt correctly.
-- ============================================================================

drop trigger if exists on_auth_user_created on auth.users;

drop table if exists public.study_notes cascade;
drop table if exists public.test_results cascade;
drop table if exists public.tests cascade;
drop table if exists public.questions cascade;
drop table if exists public.notes cascade;
drop table if exists public.pyqs cascade;
drop table if exists public.mock_tests cascade;
drop table if exists public.mock_test_questions cascade;
drop table if exists public.attempts cascade;
drop table if exists public.profiles cascade;

drop function if exists public.is_admin() cascade;
drop function if exists public.is_paid() cascade;
drop function if exists public.handle_new_user() cascade;
drop function if exists public.list_mock_tests() cascade;
drop function if exists public.start_test_attempt(bigint) cascade;
drop function if exists public.save_answer(bigint, bigint, text) cascade;
drop function if exists public.toggle_mark(bigint, bigint, boolean) cascade;
drop function if exists public.submit_attempt(bigint) cascade;

-- ============================================================================
-- After this finishes with no errors, run the full schema.sql next.
-- Then run backfill_existing_users.sql (below) to give your already-registered
-- login(s) a working profile row again, since the old one just got removed.
-- ============================================================================
