-- =============================================================
-- Migration: 068_unfinish_match_fn
-- Creates a helper function to revert one completed match back to
-- 'queued' (appended to the end of the queue), reversing any stat
-- contributions its match_results rows made. This is the inverse of
-- the on_match_result_insert trigger (013_player_stats_tables.sql),
-- since that trigger has no DELETE counterpart.
--
-- Usage (client): supabase.rpc('unfinish_match', { p_match_id: id })
-- =============================================================

CREATE OR REPLACE FUNCTION public.unfinish_match(p_match_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match RECORD;
  v_session_id UUID;
  v_max_pos INT;
  v_result RECORD;
  v_winner1 UUID;
  v_winner2 UUID;
  v_loser1  UUID;
  v_loser2  UUID;
BEGIN
  SELECT id, session_id, status,
         team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id
  INTO v_match
  FROM public.matches
  WHERE id = p_match_id;

  IF NOT FOUND THEN
    RETURN format('No match found with id %s', p_match_id);
  END IF;

  IF v_match.status <> 'complete' THEN
    RETURN format('Match %s is not complete (status=%s) — no changes made', p_match_id, v_match.status);
  END IF;

  v_session_id := v_match.session_id;

  -- ----------------------------------------------------------------
  -- 1. Reverse stats for every recorded result row on this match
  --    (there can be up to 2 rows under split scoring — one per game)
  -- ----------------------------------------------------------------
  FOR v_result IN
    SELECT winning_pair_index FROM public.match_results WHERE match_id = p_match_id
  LOOP
    IF v_result.winning_pair_index = 1 THEN
      v_winner1 := v_match.team1_player1_id;
      v_winner2 := v_match.team1_player2_id;
      v_loser1  := v_match.team2_player1_id;
      v_loser2  := v_match.team2_player2_id;
    ELSE
      v_winner1 := v_match.team2_player1_id;
      v_winner2 := v_match.team2_player2_id;
      v_loser1  := v_match.team1_player1_id;
      v_loser2  := v_match.team1_player2_id;
    END IF;

    UPDATE public.player_stats ps
    SET
      games_played = GREATEST(0, ps.games_played - 1),
      wins         = GREATEST(0, ps.wins - 1),
      updated_at   = now()
    WHERE ps.player_id IN (v_winner1, v_winner2);

    UPDATE public.player_stats ps
    SET
      games_played = GREATEST(0, ps.games_played - 1),
      updated_at   = now()
    WHERE ps.player_id IN (v_loser1, v_loser2);

    UPDATE public.player_pair_stats pps
    SET
      wins_together = GREATEST(0, pps.wins_together - 1),
      updated_at    = now()
    WHERE (pps.player_id = v_winner1 AND pps.other_player_id = v_winner2)
       OR (pps.player_id = v_winner2 AND pps.other_player_id = v_winner1);

    UPDATE public.player_pair_stats pps
    SET
      losses_against = GREATEST(0, pps.losses_against - 1),
      updated_at     = now()
    WHERE (pps.player_id = v_loser1 AND pps.other_player_id IN (v_winner1, v_winner2))
       OR (pps.player_id = v_loser2 AND pps.other_player_id IN (v_winner1, v_winner2));
  END LOOP;

  -- ----------------------------------------------------------------
  -- 2. Delete the recorded result(s)
  -- ----------------------------------------------------------------
  DELETE FROM public.match_results WHERE match_id = p_match_id;

  -- ----------------------------------------------------------------
  -- 3. Reset the match to a clean queued state at the end of the queue
  -- ----------------------------------------------------------------
  SELECT COALESCE(MAX(queue_position), 0)
  INTO v_max_pos
  FROM public.matches
  WHERE session_id = v_session_id AND status = 'queued';

  UPDATE public.matches
  SET
    status           = 'queued',
    court_number      = NULL,
    started_at        = NULL,
    duration_seconds   = NULL,
    queue_position    = v_max_pos + 1
  WHERE id = p_match_id;

  RETURN format('Match %s un-finished and moved to end of queue (position %s)', p_match_id, v_max_pos + 1);
END;
$$;

GRANT EXECUTE ON FUNCTION public.unfinish_match(UUID) TO authenticated;
