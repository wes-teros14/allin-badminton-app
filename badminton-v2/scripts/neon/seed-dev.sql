-- scripts/neon/seed-dev.sql — fresh test data for the Neon `dev` branch (2026-11-19).
--
-- Wipes the app's data and recreates:
--   * the 12 Dev Login accounts (src/components/DevLoginPanel.tsx) with their Supabase DEV user ids,
--     so signing in through the Dev Login button lands on these profiles;
--   * 4 finished sessions (10 games each, results, sessions_attended) so leaderboards, awards,
--     history and finance have data;
--   * 1 session in progress: 4 games done, 2 on court, 6 queued — for the live board, subs and backup.
--
-- Stats are not inserted: the real triggers derive them from match_results and from the
-- session's status moving to 'complete', exactly as in the app.
--
-- DEV ONLY. Run it with the guarded runner, which refuses any endpoint but dev's:
--   NEON_DATABASE_URL="$(neon cs dev)" node scripts/neon/run-dev.mjs scripts/neon/seed-dev.sql
-- and the block below also refuses if any profile looks real (production has real emails).

do $$
begin
  if exists (
    select 1 from public.profiles
    where email is not null and email not like '%@test.local' and email not like '%@parity.test'
  ) then
    raise exception 'refusing: this database has real-looking profiles (is this production?)';
  end if;
end $$;

truncate
  public.announcements, public.announcer_clips, public.cheer_later_players, public.cheers,
  public.live_messages, public.match_results, public.matches, public.no_cheer_players, public.notifications,
  public.payment_exempt_players, public.player_cheer_stats, public.player_pair_stats,
  public.player_stats, public.session_finance_notes, public.session_invitations,
  public.session_receipts, public.session_registrations, public.sessions,
  public.shuttle_batches, public.shuttle_usage, public.profiles
  cascade;

-- Supabase DEV user ids, read by signing in each Dev Login account (ids only, no secrets).
insert into public.profiles (id, email, name_slug, nickname, role, level, gender, is_active) values
  ('d5b89b34-afe0-4b5a-9cba-68aa2756898d', 'admin@test.local',         'dev-admin',     'Admin', 'admin',     5, 'M', true),
  ('2754a4d9-d34a-4327-a30c-04a55cc6e97c', 'multiple-john@test.local', 'multiple-john', 'John',  'moderator', 6, 'M', true),
  ('de296a4b-6446-436d-8ad8-ab712cd190bb', 'multiple-jane@test.local', 'multiple-jane', 'Jane',  'player',    5, 'F', true),
  ('5ea161e2-5575-4cbb-b5f9-d970912babc8', 'multiple-joe@test.local',  'multiple-joe',  'Joe',   'player',    4, 'M', true),
  ('cf792b9c-f7d1-4017-8bf3-e5c824b3f7f9', 's1-alex@test.local',       's1-alex-tan',   'Alex',  'player',    7, 'M', true),
  ('ab924937-cd94-49af-b0f4-a1dfa83fbf65', 's1-jamie@test.local',      's1-jamie-lee',  'Jamie', 'player',    3, 'F', true),
  ('533e5264-cb3c-4202-b500-2f4297192a85', 's1-sam@test.local',        's1-sam-wong',   'Sam',   'player',    5, 'M', true),
  ('41ba4d26-6281-4a15-a021-9346592f4057', 's1-wei@test.local',        's1-wei-chen',   'Wei',   'player',    6, 'F', true),
  ('a9e7de9b-d158-4af7-944f-78d5d0dacc87', 's2-marcus@test.local',     's2-marcus-lim', 'Marcus','player',    8, 'M', true),
  ('3bf1d8d6-003a-4c4b-833b-a45eb10029c7', 's2-dana@test.local',       's2-dana-park',  'Dana',  'player',    4, 'F', true),
  ('a9a094ad-3141-41cf-aab8-264671c7a5e9', 's2-kim@test.local',        's2-kim-soo',    'Kim',   'player',    5, 'F', true),
  ('916208b8-35e0-4fc2-81c6-8dc529fc49cc', 's2-raj@test.local',        's2-raj-patel',  'Raj',   'player',    3, 'M', true);

do $$
declare
  admin_id constant uuid := 'd5b89b34-afe0-4b5a-9cba-68aa2756898d';
  -- The 11 players (everyone but the admin), in a fixed order for rotating games.
  p uuid[] := array(
    select id from public.profiles where role <> 'admin' order by email
  );
  n int := 11;
  s int;
  g int;
  sid uuid;
  mid uuid;
  d date;
  games_done int;
begin
  -- s = 1..4 finished, s = 5 in progress (today).
  for s in 1..5 loop
    sid := ('dddddddd-0000-4000-8000-' || lpad(s::text, 12, '0'))::uuid;
    d := case when s = 5 then date '2026-11-19' else date '2026-10-26' + (s - 1) * 7 end;
    insert into public.sessions (id, name, date, time, venue, court_count, price, status, created_by)
    values (sid, case when s = 5 then 'Dev Live Session' else 'Dev Session ' || s end,
            d, '18:00', 'Dev Hall', 2, 300, 'in_progress', admin_id);

    insert into public.session_registrations (session_id, player_id, registered_at, source)
    select sid, x, d - 2 + (i * interval '1 minute'), 'self'
    from unnest(p) with ordinality as t(x, i);

    games_done := case when s = 5 then 4 else 10 end;
    for g in 1..(case when s = 5 then 12 else 10 end) loop
      mid := gen_random_uuid();
      insert into public.matches (id, session_id, queue_position, court_number, status, started_at,
        team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id)
      values (mid, sid, g,
        case when g <= games_done + 2 then ((g - 1) % 2) + 1 end,
        (case when g <= games_done then 'complete' when g <= games_done + 2 then 'playing' else 'queued' end)::public.match_status,
        case when g <= games_done + 2 then d + time '18:00' + (g * interval '12 minutes') end,
        -- 4 distinct players: consecutive slots of a rotation over 11 (4 < 11, so no repeats).
        p[((4 * g + 0 + s) % n) + 1], p[((4 * g + 1 + s) % n) + 1],
        p[((4 * g + 2 + s) % n) + 1], p[((4 * g + 3 + s) % n) + 1]);
      if g <= games_done then
        insert into public.match_results (match_id, winning_pair_index, game_number)
        values (mid, ((g + s) % 2) + 1, 1);
      end if;
    end loop;

    if s < 5 then
      update public.sessions
      set status = 'complete', completed_at = d + time '21:00', closed_at = d + time '21:30'
      where id = sid;
    end if;
  end loop;
end $$;

-- What was made (printed by the runner).
select
  (select count(*) from public.profiles) as profiles,
  (select count(*) from public.sessions) as sessions,
  (select count(*) from public.matches) as matches,
  (select count(*) from public.match_results) as results,
  (select count(*) from public.player_stats) as player_stats_rows,
  (select sum(sessions_attended) from public.player_stats) as sessions_attended_total;
