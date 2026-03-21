-- =============================================================
-- Migration: 018_reverse_session_stats_fn
-- Creates a helper function to reverse all stat contributions
-- from a specific session. Useful for removing test data without
-- touching prod player stats.
--
-- Usage (Supabase SQL Editor):
--   SELECT reverse_session_stats('your-session-uuid-here');
-- =============================================================

CREATE OR REPLACE FUNCTION public.reverse_session_stats(p_session_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_games_count   INT;
  v_players_count INT;
BEGIN

  -- ----------------------------------------------------------------
  -- 1. Subtract sessions_attended for all registered players
  -- ----------------------------------------------------------------
  UPDATE public.player_stats ps
  SET
    sessions_attended = GREATEST(0, ps.sessions_attended - 1),
    updated_at        = now()
  WHERE ps.player_id IN (
    SELECT player_id FROM public.session_registrations
    WHERE session_id = p_session_id
  );

  GET DIAGNOSTICS v_players_count = ROW_COUNT;

  -- ----------------------------------------------------------------
  -- 2. Subtract games_played + wins from match results in this session
  -- ----------------------------------------------------------------
  WITH session_results AS (
    SELECT
      m.team1_player1_id, m.team1_player2_id,
      m.team2_player1_id, m.team2_player2_id,
      mr.winning_pair_index
    FROM public.matches m
    JOIN public.match_results mr ON mr.match_id = m.id
    WHERE m.session_id = p_session_id
  ),
  player_games AS (
    SELECT team1_player1_id AS player_id,
           1 AS games,
           CASE WHEN winning_pair_index = 1 THEN 1 ELSE 0 END AS wins
    FROM session_results
    UNION ALL
    SELECT team1_player2_id, 1,
           CASE WHEN winning_pair_index = 1 THEN 1 ELSE 0 END
    FROM session_results
    UNION ALL
    SELECT team2_player1_id, 1,
           CASE WHEN winning_pair_index = 2 THEN 1 ELSE 0 END
    FROM session_results
    UNION ALL
    SELECT team2_player2_id, 1,
           CASE WHEN winning_pair_index = 2 THEN 1 ELSE 0 END
    FROM session_results
  ),
  totals AS (
    SELECT player_id, COUNT(*) AS games, SUM(wins) AS wins
    FROM player_games
    GROUP BY player_id
  )
  UPDATE public.player_stats ps
  SET
    games_played = GREATEST(0, ps.games_played - t.games),
    wins         = GREATEST(0, ps.wins - t.wins),
    updated_at   = now()
  FROM totals t
  WHERE ps.player_id = t.player_id;

  GET DIAGNOSTICS v_games_count = ROW_COUNT;

  -- ----------------------------------------------------------------
  -- 3. Subtract player_pair_stats (wins_together + losses_against)
  -- ----------------------------------------------------------------
  WITH session_results AS (
    SELECT
      m.team1_player1_id, m.team1_player2_id,
      m.team2_player1_id, m.team2_player2_id,
      mr.winning_pair_index
    FROM public.matches m
    JOIN public.match_results mr ON mr.match_id = m.id
    WHERE m.session_id = p_session_id
  ),
  -- Winning pairs (both directions)
  winning_pairs AS (
    SELECT team1_player1_id AS p1, team1_player2_id AS p2 FROM session_results WHERE winning_pair_index = 1
    UNION ALL
    SELECT team2_player1_id, team2_player2_id FROM session_results WHERE winning_pair_index = 2
  ),
  partner_wins AS (
    SELECT p1 AS player_id, p2 AS other_player_id FROM winning_pairs
    UNION ALL
    SELECT p2, p1 FROM winning_pairs
  ),
  partner_totals AS (
    SELECT player_id, other_player_id, COUNT(*) AS wins_together
    FROM partner_wins GROUP BY player_id, other_player_id
  )
  UPDATE public.player_pair_stats pps
  SET
    wins_together = GREATEST(0, pps.wins_together - pt.wins_together),
    updated_at    = now()
  FROM partner_totals pt
  WHERE pps.player_id = pt.player_id
    AND pps.other_player_id = pt.other_player_id;

  WITH session_results AS (
    SELECT
      m.team1_player1_id, m.team1_player2_id,
      m.team2_player1_id, m.team2_player2_id,
      mr.winning_pair_index
    FROM public.matches m
    JOIN public.match_results mr ON mr.match_id = m.id
    WHERE m.session_id = p_session_id
  ),
  loser_winner AS (
    SELECT team2_player1_id AS loser, team1_player1_id AS winner FROM session_results WHERE winning_pair_index = 1
    UNION ALL SELECT team2_player1_id, team1_player2_id FROM session_results WHERE winning_pair_index = 1
    UNION ALL SELECT team2_player2_id, team1_player1_id FROM session_results WHERE winning_pair_index = 1
    UNION ALL SELECT team2_player2_id, team1_player2_id FROM session_results WHERE winning_pair_index = 1
    UNION ALL SELECT team1_player1_id, team2_player1_id FROM session_results WHERE winning_pair_index = 2
    UNION ALL SELECT team1_player1_id, team2_player2_id FROM session_results WHERE winning_pair_index = 2
    UNION ALL SELECT team1_player2_id, team2_player1_id FROM session_results WHERE winning_pair_index = 2
    UNION ALL SELECT team1_player2_id, team2_player2_id FROM session_results WHERE winning_pair_index = 2
  ),
  loss_totals AS (
    SELECT loser AS player_id, winner AS other_player_id, COUNT(*) AS losses_against
    FROM loser_winner GROUP BY loser, winner
  )
  UPDATE public.player_pair_stats pps
  SET
    losses_against = GREATEST(0, pps.losses_against - lt.losses_against),
    updated_at     = now()
  FROM loss_totals lt
  WHERE pps.player_id = lt.player_id
    AND pps.other_player_id = lt.other_player_id;

  RETURN format(
    'Done. Reversed stats for session %s: %s player(s) session_attended decremented, %s player(s) games/wins adjusted.',
    p_session_id, v_players_count, v_games_count
  );
END;
$$;

-- Grant execute to authenticated (admins only in practice)
GRANT EXECUTE ON FUNCTION public.reverse_session_stats(UUID) TO authenticated;
