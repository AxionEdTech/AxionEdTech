-- ============================================================================
-- RESET EVERYTHING — wipes all of Axion EdTech's data and rules from Supabase.
--
-- WHAT IT DELETES: every table, function, rule and row in the "public" part of
-- your database — notes, tests, questions, papers, plans, subscriptions,
-- students' profiles and results, everything the website stores.
--
-- WHAT IT KEEPS: your login accounts (Supabase → Authentication → Users), your
-- project URL, your API keys and your Vercel settings. Nothing outside "public"
-- is touched.
--
-- THIS CANNOT BE UNDONE. Only run it if you are sure.
--
-- Afterwards run, in this order:
--   1. fresh_install_all.sql           (rebuilds everything, empty)
--   2. backfill_existing_users.sql     (profiles for existing logins + your admin)
-- ============================================================================

drop schema if exists public cascade;
create schema public;

-- Give Supabase's standard roles access to the new, empty schema.
grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on schema public to postgres, service_role;
alter default privileges in schema public grant all on tables to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to postgres, anon, authenticated, service_role;

-- The "new account -> profile" trigger lived on Supabase's auth table and is
-- re-created by fresh_install_all.sql; drop any leftover first.
drop trigger if exists on_auth_user_created on auth.users;

notify pgrst, 'reload schema';

select
  (select count(*) from information_schema.tables where table_schema = 'public') as tables_left_in_public,
  (select count(*) from auth.users) as login_accounts_kept;
-- Expected: tables_left_in_public = 0, and login_accounts_kept = your number of accounts.
