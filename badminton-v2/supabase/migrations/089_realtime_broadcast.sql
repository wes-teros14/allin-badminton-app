-- 089: Live updates via Realtime Broadcast instead of Postgres Changes.
--
-- Why: on the Free (NANO) instance Realtime's Postgres Changes poll
-- (realtime.list_changes) was 49% of all database time on Nov 15 2026 and is
-- the query that stalls first when memory is swapped (docs/qa-log.html, Live
-- board & performance). Broadcast sends a message only when a row changes and
-- checks access once per channel join, so the poll disappears.
--
-- Design (tasks/todo.md):
--   * Messages say only "this changed" — clients refetch exactly as before.
--     Exceptions: notifications carry their row (the toast needs it; the
--     topic is private to its owner), and match messages carry the new
--     status (cheers only reload when a game completes).
--   * Topics: session:<id>  matches, match_results, sessions,
--                           session_registrations, session_receipts
--             user:<id>     notifications, player_stats, session_registrations
--   * One message per topic+kind per transaction: the generator inserting 40
--     games sends one message, not 40. The guard is a transaction-local
--     setting, so it resets on commit.
--   * Private channels. Anyone (including the logged-out live board) may
--     receive session:*; only the owner may receive user:<id>. No INSERT
--     policy, so no phone can send — fake "changed" messages cannot be used to
--     make every phone refetch.
--
-- Additive: Postgres Changes keeps working until the tables are removed from
-- the supabase_realtime publication in a later migration.

-- ---------------------------------------------------------------------------
-- Sender with a once-per-transaction guard
-- ---------------------------------------------------------------------------
create or replace function public.rt_send_once(p_topic text, p_payload jsonb, p_dedupe_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  guard text := 'rt_sent.k' || md5(p_topic || '|' || p_dedupe_key);
begin
  if current_setting(guard, true) = '1' then
    return;
  end if;
  perform set_config(guard, '1', true);
  perform realtime.send(p_payload, 'changed', p_topic, true);
end;
$$;

revoke all on function public.rt_send_once(text, jsonb, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Per-table triggers (row level; rt_send_once collapses bursts)
-- ---------------------------------------------------------------------------
create or replace function public.rt_matches_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  st text;
begin
  if tg_op = 'DELETE' then r := old; else r := new; st := new.status; end if;
  perform public.rt_send_once(
    'session:' || r.session_id,
    jsonb_build_object('table', 'matches', 'op', tg_op, 'status', st),
    'matches|' || tg_op || '|' || coalesce(st, '')
  );
  return null;
end;
$$;

create or replace function public.rt_match_results_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  sid uuid;
begin
  if tg_op = 'DELETE' then r := old; else r := new; end if;
  select m.session_id into sid from public.matches m where m.id = r.match_id;
  if sid is not null then
    perform public.rt_send_once(
      'session:' || sid,
      jsonb_build_object('table', 'match_results', 'op', tg_op),
      'match_results|' || tg_op
    );
  end if;
  return null;
end;
$$;

create or replace function public.rt_sessions_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  if tg_op = 'DELETE' then r := old; else r := new; end if;
  perform public.rt_send_once(
    'session:' || r.id,
    jsonb_build_object('table', 'sessions', 'op', tg_op),
    'sessions|' || tg_op
  );
  return null;
end;
$$;

create or replace function public.rt_registrations_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  if tg_op = 'DELETE' then r := old; else r := new; end if;
  perform public.rt_send_once(
    'session:' || r.session_id,
    jsonb_build_object('table', 'session_registrations', 'op', tg_op),
    'session_registrations|' || tg_op
  );
  -- The player's own lists (My Sessions, the session card) follow too.
  perform public.rt_send_once(
    'user:' || r.player_id,
    jsonb_build_object('table', 'session_registrations', 'op', tg_op, 'session_id', r.session_id),
    'session_registrations|' || tg_op || '|' || r.session_id
  );
  return null;
end;
$$;

create or replace function public.rt_receipts_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  if tg_op = 'DELETE' then r := old; else r := new; end if;
  perform public.rt_send_once(
    'session:' || r.session_id,
    jsonb_build_object('table', 'session_receipts', 'op', tg_op),
    'session_receipts|' || tg_op
  );
  return null;
end;
$$;

create or replace function public.rt_player_stats_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  if tg_op = 'DELETE' then r := old; else r := new; end if;
  perform public.rt_send_once(
    'user:' || r.player_id,
    jsonb_build_object('table', 'player_stats', 'op', tg_op),
    'player_stats|' || tg_op
  );
  return null;
end;
$$;

-- Notifications carry the row: the toast shows its title and body. Not
-- de-duplicated — each notification is its own toast.
create or replace function public.rt_notification_inserted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send(
    jsonb_build_object('table', 'notifications', 'op', tg_op, 'record', to_jsonb(new)),
    'changed',
    'user:' || new.user_id,
    true
  );
  return null;
end;
$$;

revoke all on function public.rt_matches_changed() from public, anon, authenticated;
revoke all on function public.rt_match_results_changed() from public, anon, authenticated;
revoke all on function public.rt_sessions_changed() from public, anon, authenticated;
revoke all on function public.rt_registrations_changed() from public, anon, authenticated;
revoke all on function public.rt_receipts_changed() from public, anon, authenticated;
revoke all on function public.rt_player_stats_changed() from public, anon, authenticated;
revoke all on function public.rt_notification_inserted() from public, anon, authenticated;

drop trigger if exists rt_broadcast on public.matches;
create trigger rt_broadcast after insert or update or delete on public.matches
  for each row execute function public.rt_matches_changed();

drop trigger if exists rt_broadcast on public.match_results;
create trigger rt_broadcast after insert or update or delete on public.match_results
  for each row execute function public.rt_match_results_changed();

drop trigger if exists rt_broadcast on public.sessions;
create trigger rt_broadcast after insert or update or delete on public.sessions
  for each row execute function public.rt_sessions_changed();

drop trigger if exists rt_broadcast on public.session_registrations;
create trigger rt_broadcast after insert or update or delete on public.session_registrations
  for each row execute function public.rt_registrations_changed();

drop trigger if exists rt_broadcast on public.session_receipts;
create trigger rt_broadcast after insert or update or delete on public.session_receipts
  for each row execute function public.rt_receipts_changed();

drop trigger if exists rt_broadcast on public.player_stats;
create trigger rt_broadcast after insert or update or delete on public.player_stats
  for each row execute function public.rt_player_stats_changed();

drop trigger if exists rt_broadcast on public.notifications;
create trigger rt_broadcast after insert on public.notifications
  for each row execute function public.rt_notification_inserted();

-- ---------------------------------------------------------------------------
-- Who may receive which topic (private channels)
-- ---------------------------------------------------------------------------
drop policy if exists "rt: receive session topics" on realtime.messages;
create policy "rt: receive session topics" on realtime.messages
  for select to anon, authenticated
  using (realtime.messages.extension = 'broadcast' and (select realtime.topic()) like 'session:%');

drop policy if exists "rt: receive own user topic" on realtime.messages;
create policy "rt: receive own user topic" on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and (select realtime.topic()) = 'user:' || (select auth.uid())::text
  );
