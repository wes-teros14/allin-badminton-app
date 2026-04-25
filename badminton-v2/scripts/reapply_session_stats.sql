-- Reapply session stats for 6cfc300d-7fee-4c19-97bb-95337e206734 (Lets Play! 2026-04-19)
-- Run after reverse_session_stats + match corrections

-- 1. games_played + wins
WITH session_results AS (
  SELECT m.team1_player1_id, m.team1_player2_id, m.team2_player1_id, m.team2_player2_id, mr.winning_pair_index
  FROM public.matches m JOIN public.match_results mr ON mr.match_id = m.id
  WHERE m.session_id = '6cfc300d-7fee-4c19-97bb-95337e206734'
),
player_games AS (
  SELECT team1_player1_id AS player_id, 1 AS games, CASE WHEN winning_pair_index = 1 THEN 1 ELSE 0 END AS wins FROM session_results
  UNION ALL SELECT team1_player2_id, 1, CASE WHEN winning_pair_index = 1 THEN 1 ELSE 0 END FROM session_results
  UNION ALL SELECT team2_player1_id, 1, CASE WHEN winning_pair_index = 2 THEN 1 ELSE 0 END FROM session_results
  UNION ALL SELECT team2_player2_id, 1, CASE WHEN winning_pair_index = 2 THEN 1 ELSE 0 END FROM session_results
),
totals AS (SELECT player_id, COUNT(*) AS games, SUM(wins) AS wins FROM player_games GROUP BY player_id)
UPDATE public.player_stats ps
SET games_played = ps.games_played + t.games, wins = ps.wins + t.wins, updated_at = now()
FROM totals t WHERE ps.player_id = t.player_id;

-- 2. sessions_attended
UPDATE public.player_stats ps
SET sessions_attended = ps.sessions_attended + 1, updated_at = now()
WHERE ps.player_id IN (SELECT player_id FROM public.session_registrations WHERE session_id = '6cfc300d-7fee-4c19-97bb-95337e206734');

-- 3. wins_together (player_pair_stats)
WITH session_results AS (
  SELECT m.team1_player1_id, m.team1_player2_id, m.team2_player1_id, m.team2_player2_id, mr.winning_pair_index
  FROM public.matches m JOIN public.match_results mr ON mr.match_id = m.id
  WHERE m.session_id = '6cfc300d-7fee-4c19-97bb-95337e206734'
),
winning_pairs AS (
  SELECT team1_player1_id AS w1, team1_player2_id AS w2 FROM session_results WHERE winning_pair_index = 1
  UNION ALL SELECT team2_player1_id, team2_player2_id FROM session_results WHERE winning_pair_index = 2
),
partner_wins AS (
  SELECT w1 AS player_id, w2 AS other_player_id FROM winning_pairs
  UNION ALL SELECT w2, w1 FROM winning_pairs
),
partner_totals AS (SELECT player_id, other_player_id, COUNT(*) AS wins_together FROM partner_wins GROUP BY player_id, other_player_id)
INSERT INTO public.player_pair_stats (player_id, other_player_id, wins_together)
SELECT player_id, other_player_id, wins_together FROM partner_totals
ON CONFLICT (player_id, other_player_id) DO UPDATE SET
  wins_together = player_pair_stats.wins_together + EXCLUDED.wins_together, updated_at = now();

-- 4. losses_against (player_pair_stats)
WITH session_results AS (
  SELECT m.team1_player1_id, m.team1_player2_id, m.team2_player1_id, m.team2_player2_id, mr.winning_pair_index
  FROM public.matches m JOIN public.match_results mr ON mr.match_id = m.id
  WHERE m.session_id = '6cfc300d-7fee-4c19-97bb-95337e206734'
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
loss_totals AS (SELECT loser AS player_id, winner AS other_player_id, COUNT(*) AS losses_against FROM loser_winner GROUP BY loser, winner)
INSERT INTO public.player_pair_stats (player_id, other_player_id, losses_against)
SELECT player_id, other_player_id, losses_against FROM loss_totals
ON CONFLICT (player_id, other_player_id) DO UPDATE SET
  losses_against = player_pair_stats.losses_against + EXCLUDED.losses_against, updated_at = now();
