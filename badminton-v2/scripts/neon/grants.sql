-- scripts/neon/grants.sql — every privilege the Data API roles get. Nothing is inherited.
--
-- Source of truth: prod's table ACLs as of 2026-11-16 (read via Supabase MCP), keeping only
-- SELECT/INSERT/UPDATE/DELETE. Prod's extra anon/authenticated TRUNCATE, REFERENCES, TRIGGER and
-- MAINTAIN (Supabase defaults, never used by the app) are deliberately not carried over.
-- `anon` is `anonymous` here. Behaviour on prod that this keeps on purpose:
--   * anonymous has SELECT only where a logged-out policy exists; elsewhere it gets 42501, as on prod.
--   * anonymous has no UPDATE on matches, so the "kiosk update" policy is unreachable (same on prod).
-- Idempotent: revokes everything first, then grants.

-- ---------------------------------------------------------------------------
-- Reset
-- ---------------------------------------------------------------------------
revoke all on all tables    in schema public from public, anonymous, authenticated;
revoke all on all sequences in schema public from public, anonymous, authenticated;
alter default privileges in schema public revoke all on tables    from anonymous, authenticated;
alter default privileges in schema public revoke all on sequences from anonymous, authenticated;
alter default privileges in schema public revoke all on functions from anonymous, authenticated;

grant usage on schema public to anonymous, authenticated;
grant usage on schema auth   to anonymous, authenticated;
grant execute on function auth.uid(), auth.role(), auth.email(), auth.jwt() to anonymous, authenticated;

-- ---------------------------------------------------------------------------
-- Tables (prod ACL, arwd only)
-- ---------------------------------------------------------------------------
grant select                         on public.announcements          to authenticated;
grant update                         on public.announcements          to authenticated;
grant select                         on public.announcer_clips        to anonymous;
grant select, insert, update, delete on public.announcer_clips        to authenticated;
grant select, insert, delete         on public.cheer_later_players    to authenticated;
grant select                         on public.cheer_types            to authenticated;
grant select, insert                 on public.cheers                 to authenticated;
grant select, insert, update, delete on public.generator_presets      to authenticated;
grant select, insert                 on public.match_results          to anonymous;
grant select, insert                 on public.match_results          to authenticated;
grant select                         on public.matches                to anonymous;
grant select, insert, update, delete on public.matches                to authenticated;
grant select, update                 on public.notifications          to authenticated;
grant select, insert, delete         on public.payment_exempt_players to authenticated;
grant select, update                 on public.payment_settings       to authenticated;
grant select                         on public.player_cheer_stats     to authenticated;
grant select                         on public.player_pair_stats      to authenticated;
grant select                         on public.player_stats           to authenticated;
grant select                         on public.profiles               to anonymous;
grant select, insert, update         on public.profiles               to authenticated;
grant select, insert, update, delete on public.session_finance_notes  to authenticated;
grant select                         on public.session_invitations    to anonymous;
grant select, insert, update         on public.session_invitations    to authenticated;
grant select, insert, update, delete on public.session_receipts       to authenticated;
grant select                         on public.session_registrations  to anonymous;
grant select, insert, update, delete on public.session_registrations  to authenticated;
grant select                         on public.sessions               to anonymous;
grant select, insert, update, delete on public.sessions               to authenticated;
grant select, insert, update, delete on public.shuttle_batches        to authenticated;
grant select, insert, update, delete on public.shuttle_usage          to authenticated;
-- public.live_messages: no grants. Only SECURITY DEFINER triggers write it; Neon Realtime reads it.

-- ---------------------------------------------------------------------------
-- Functions. Postgres gives EXECUTE to PUBLIC by default; for SECURITY DEFINER and trigger
-- functions that means anyone could call them through /rpc (e.g. spoof user:<id> messages
-- via rt_send_once, review B3). Trigger functions need no EXECUTE to fire.
-- ---------------------------------------------------------------------------
do $$
declare
  f regprocedure;
begin
  for f in
    select p.oid::regprocedure
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and (p.prosecdef or p.prorettype = 'trigger'::regtype)
  loop
    execute format('revoke all on function %s from public, anonymous, authenticated', f);
  end loop;
end
$$;

-- RPCs the app calls (src: .rpc('unfinish_match'), .rpc('get_session_finance')).
-- Prod also lets PUBLIC (so logged-out callers) run these; here only signed-in users can.
-- unfinish_match / reverse_session_stats have no admin check inside (SECURITY DEFINER): see report.
grant execute on function public.unfinish_match(uuid)        to authenticated;
grant execute on function public.get_session_finance(uuid)   to authenticated;
grant execute on function public.reverse_session_stats(uuid) to authenticated;
-- Scheduled registration opening (transform.sql, D1): any visitor's app may trigger it, as the hourly
-- job did; it only opens sessions whose admin-set time has passed.
grant execute on function public.open_due_registrations()    to anonymous, authenticated;
