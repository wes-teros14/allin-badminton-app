-- =============================================================
-- Migration: 016_player_stats_leaderboard_read
-- Allows all authenticated users to read all player_stats rows.
-- Required for the Today leaderboard tab where all players'
-- stats need to be visible (win rate, games played, wins).
-- =============================================================

CREATE POLICY "player_stats: read all for leaderboard"
  ON public.player_stats FOR SELECT
  TO authenticated
  USING (true);
