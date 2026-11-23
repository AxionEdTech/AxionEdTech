-- ============================================================================
-- Run this LAST, after tools/reset_before_rebuild.sql and fresh_install_all.sql.
-- Gives every already-registered login a fresh profile row (the reset removed
-- the old, mismatched one), so you don't have to re-register from scratch.
-- ============================================================================

insert into public.profiles (id, name, email, phone)
select id, coalesce(raw_user_meta_data->>'name', split_part(email, '@', 1)), email,
       left(nullif(btrim(raw_user_meta_data->>'phone'), ''), 30)
from auth.users
where id not in (select id from public.profiles);

-- Now make your own account admin again — replace with your real email:
update public.profiles set role = 'admin' where email = 'axionedtech@gmail.com';
