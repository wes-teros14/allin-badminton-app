-- =============================================================
-- Migration: 064_add_sessions_and_results_to_realtime
-- Ensures existing live board subscriptions receive cross-device
-- events for session metadata and match results.
-- =============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sessions;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'match_results'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.match_results;
  END IF;
END
$$;
