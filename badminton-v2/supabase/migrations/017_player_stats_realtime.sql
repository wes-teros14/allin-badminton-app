-- =============================================================
-- Migration: 017_player_stats_realtime
-- Enables Supabase Realtime for player_stats table.
-- Required for TodayView leaderboard to update live as
-- match results are recorded during a session.
-- =============================================================

ALTER TABLE public.player_stats REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.player_stats;
