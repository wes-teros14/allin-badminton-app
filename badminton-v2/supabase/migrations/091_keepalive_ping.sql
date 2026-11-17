-- 091: keepalive_ping() — the daily database request that keeps the Supabase project awake.
--
-- After the Neon migration, Supabase only serves sign-in and file storage. Free projects pause
-- after 7 days without "sufficient user database activity" (supabase.com/docs/guides/platform/
-- free-project-pausing), and the docs don't say whether Auth or Storage requests count. A Neon
-- Function on a daily schedule (functions/keepalive) calls this through PostgREST with the public
-- key. It reads no app data, so it keeps working if the app's tables are later removed here.
-- Supabase-only: scripts/neon/transform.sql drops it on Neon.

create or replace function public.keepalive_ping()
returns timestamptz
language sql
stable
set search_path = ''
as $$ select now() $$;

revoke all on function public.keepalive_ping() from public;
grant execute on function public.keepalive_ping() to anon;
