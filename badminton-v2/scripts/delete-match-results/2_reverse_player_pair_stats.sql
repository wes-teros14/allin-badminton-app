-- Step 2: Reverse wins_together + losses_against in player_pair_stats
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
winning_pairs AS (
  SELECT team1_player1_id AS p1, team1_player2_id AS p2 FROM session_results WHERE winning_pair_index = 1
  UNION ALL SELECT team2_player1_id, team2_player2_id FROM session_results WHERE winning_pair_index = 2
),
partner_totals AS (
  SELECT player_id, other_player_id, COUNT(*) AS wins_together FROM (
    SELECT p1 AS player_id, p2 AS other_player_id FROM winning_pairs
    UNION ALL SELECT p2, p1 FROM winning_pairs
  ) t GROUP BY player_id, other_player_id
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
),
combined AS (
  SELECT
    COALESCE(pt.player_id, lt.player_id) AS player_id,
    COALESCE(pt.other_player_id, lt.other_player_id) AS other_player_id,
    COALESCE(pt.wins_together, 0) AS wins_together,
    COALESCE(lt.losses_against, 0) AS losses_against
  FROM partner_totals pt
  FULL OUTER JOIN loss_totals lt
    ON pt.player_id = lt.player_id AND pt.other_player_id = lt.other_player_id
)
UPDATE public.player_pair_stats pps
SET
  wins_together  = GREATEST(0, pps.wins_together - c.wins_together),
  losses_against = GREATEST(0, pps.losses_against - c.losses_against),
  updated_at     = now()
FROM combined c
WHERE pps.player_id = c.player_id
  AND pps.other_player_id = c.other_player_id;
