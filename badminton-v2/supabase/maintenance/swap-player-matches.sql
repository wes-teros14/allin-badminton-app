-- =============================================================
-- Maintenance: swap_player_matches(session_id, nickname_from, nickname_to)
--
-- Swaps two players' places in the queued schedule of one session — wherever
-- player A is listed, player B takes the slot, and vice versa. Useful when two
-- players want to trade which games they're in (e.g. one has to leave early
-- and wants the other's earlier slots).
--
-- Run the CREATE OR REPLACE once; call it as many times as you like after
-- that, e.g.:
--   SELECT * FROM public.swap_player_matches(
--     '11111111-1111-1111-1111-111111111111', 'gellie', 'tinv'
--   );
--
-- Name resolution: each name is matched against nickname first, falling back
-- to name_slug, case-insensitively — the same rule the match generator panel
-- uses for typed names (src/components/MatchGeneratorPanel.tsx) — and scoped
-- to players registered in that session, so a name that collides globally
-- (nicknames are not unique, see project_memory.md) almost never collides
-- within one session's roster. If it still does, the function refuses and
-- tells you so; pass name_slug instead to disambiguate.
--
-- Scope: only status = 'queued' matches are touched, deliberately.
-- player_stats is written by a trigger that reads matches.team*_player*_id at
-- the moment a result is inserted (migration 013) — match_results itself never
-- stores who played. Swapping players on a 'playing' or already 'complete'
-- match would leave the schedule showing different players than the stats
-- were attributed to. Use the app's own edit/swap UI for those; it carries
-- the right guards for an in-progress or finished game.
--
-- Safety: swapping two specific ids can never produce a duplicate-player row,
-- however the four slots were arranged before the swap — it only permutes
-- which of the two named players holds which slot, so
-- matches_distinct_players_check (migration 079) can never fire because of
-- this function.
-- =============================================================

CREATE OR REPLACE FUNCTION public.swap_player_matches(
  p_session_id    uuid,
  p_nickname_from text,
  p_nickname_to   text
)
RETURNS TABLE (
  queue_position integer,
  status         text,
  team1_player1  text,
  team1_player2  text,
  team2_player1  text,
  team2_player2  text
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_from_id    uuid;
  v_to_id      uuid;
  v_from_count int;
  v_to_count   int;
  v_touched    int;
BEGIN
  SELECT count(*), max(p.id) INTO v_from_count, v_from_id
  FROM public.session_registrations sr
  JOIN public.profiles p ON p.id = sr.player_id
  WHERE sr.session_id = p_session_id
    AND lower(COALESCE(p.nickname, p.name_slug)) = lower(p_nickname_from);

  IF v_from_count = 0 THEN
    RAISE EXCEPTION 'No player registered in this session matches "%" (tried nickname, then name_slug)', p_nickname_from;
  ELSIF v_from_count > 1 THEN
    RAISE EXCEPTION '"%" matches % different players registered in this session — pass name_slug instead of nickname to pick one', p_nickname_from, v_from_count;
  END IF;

  SELECT count(*), max(p.id) INTO v_to_count, v_to_id
  FROM public.session_registrations sr
  JOIN public.profiles p ON p.id = sr.player_id
  WHERE sr.session_id = p_session_id
    AND lower(COALESCE(p.nickname, p.name_slug)) = lower(p_nickname_to);

  IF v_to_count = 0 THEN
    RAISE EXCEPTION 'No player registered in this session matches "%" (tried nickname, then name_slug)', p_nickname_to;
  ELSIF v_to_count > 1 THEN
    RAISE EXCEPTION '"%" matches % different players registered in this session — pass name_slug instead of nickname to pick one', p_nickname_to, v_to_count;
  END IF;

  IF v_from_id = v_to_id THEN
    RAISE EXCEPTION '"%" and "%" resolved to the same player — nothing to swap', p_nickname_from, p_nickname_to;
  END IF;

  UPDATE public.matches m
     SET team1_player1_id = CASE m.team1_player1_id WHEN v_from_id THEN v_to_id WHEN v_to_id THEN v_from_id ELSE m.team1_player1_id END,
         team1_player2_id = CASE m.team1_player2_id WHEN v_from_id THEN v_to_id WHEN v_to_id THEN v_from_id ELSE m.team1_player2_id END,
         team2_player1_id = CASE m.team2_player1_id WHEN v_from_id THEN v_to_id WHEN v_to_id THEN v_from_id ELSE m.team2_player1_id END,
         team2_player2_id = CASE m.team2_player2_id WHEN v_from_id THEN v_to_id WHEN v_to_id THEN v_from_id ELSE m.team2_player2_id END
   WHERE m.session_id = p_session_id
     AND m.status = 'queued'
     AND (v_from_id IN (m.team1_player1_id, m.team1_player2_id, m.team2_player1_id, m.team2_player2_id)
       OR v_to_id   IN (m.team1_player1_id, m.team1_player2_id, m.team2_player1_id, m.team2_player2_id));

  GET DIAGNOSTICS v_touched = ROW_COUNT;

  IF v_touched = 0 THEN
    RAISE NOTICE 'Neither % nor % is in a queued match in this session — nothing to swap', p_nickname_from, p_nickname_to;
  END IF;

  RETURN QUERY
  SELECT
    m.queue_position,
    m.status::text,
    COALESCE(p1.nickname, p1.name_slug),
    COALESCE(p2.nickname, p2.name_slug),
    COALESCE(p3.nickname, p3.name_slug),
    COALESCE(p4.nickname, p4.name_slug)
  FROM public.matches m
  JOIN public.profiles p1 ON p1.id = m.team1_player1_id
  JOIN public.profiles p2 ON p2.id = m.team1_player2_id
  JOIN public.profiles p3 ON p3.id = m.team2_player1_id
  JOIN public.profiles p4 ON p4.id = m.team2_player2_id
  WHERE m.session_id = p_session_id
    AND (v_from_id IN (m.team1_player1_id, m.team1_player2_id, m.team2_player1_id, m.team2_player2_id)
      OR v_to_id   IN (m.team1_player1_id, m.team1_player2_id, m.team2_player1_id, m.team2_player2_id))
  ORDER BY m.queue_position;
END;
$$;

-- Example — find the session id first, then swap:
--   SELECT id, name, date FROM public.sessions ORDER BY date DESC LIMIT 5;
--
--   SELECT * FROM public.swap_player_matches(
--     '<session-uuid>',  -- 1st param: sessions.id from the query above
--     'gellie',          -- 2nd param: nickname (or name_slug) to swap FROM
--     'tinv'              -- 3rd param: nickname (or name_slug) to swap TO
--   );
--
-- To undo, call it again with the same three values — a swap is its own inverse.
