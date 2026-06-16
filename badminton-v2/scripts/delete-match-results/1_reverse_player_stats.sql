-- Step 1: Reverse games_played + wins in player_stats
-- Run this BEFORE deleting match_results
-- Session: d37974e0-90a8-4233-b7c0-8a4cdce3bb24

WITH session_results AS (
  SELECT m.team1_player1_id, m.team1_player2_id,
         m.team2_player1_id, m.team2_player2_id,
         mr.winning_pair_index
  FROM public.matches m
  JOIN public.match_results mr ON mr.match_id = m.id
  WHERE m.session_id = 'd37974e0-90a8-4233-b7c0-8a4cdce3bb24'
),
player_games AS (
  SELECT team1_player1_id AS player_id, 1 AS games, CASE WHEN winning_pair_index = 1 THEN 1 ELSE 0 END AS wins FROM session_results
  UNION ALL SELECT team1_player2_id, 1, CASE WHEN winning_pair_index = 1 THEN 1 ELSE 0 END FROM session_results
  UNION ALL SELECT team2_player1_id, 1, CASE WHEN winning_pair_index = 2 THEN 1 ELSE 0 END FROM session_results
  UNION ALL SELECT team2_player2_id, 1, CASE WHEN winning_pair_index = 2 THEN 1 ELSE 0 END FROM session_results
),
totals AS (
  SELECT player_id, COUNT(*) AS games, SUM(wins) AS wins
  FROM player_games GROUP BY player_id
)
UPDATE public.player_stats ps
SET
  games_played = GREATEST(0, ps.games_played - t.games),
  wins         = GREATEST(0, ps.wins - t.wins),
  updated_at   = now()
FROM totals t
WHERE ps.player_id = t.player_id;
