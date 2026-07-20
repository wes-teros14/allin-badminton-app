-- =============================================================
-- Migration: 070_session_registrations_realtime
-- Enables Supabase Realtime for session_registrations table.
--
-- useRoster and useRegisteredPlayers both subscribe to
-- postgres_changes on session_registrations (roster edits, level
-- overrides, added/removed players), but the table was never added
-- to the publication, so those events were never broadcast. Each
-- hook held its own local snapshot fetched once on mount, so a
-- level-override edit or a newly added player only reached the
-- match generator after a full page refresh re-fetched the data.
-- =============================================================

ALTER TABLE public.session_registrations REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'session_registrations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.session_registrations;
  END IF;
END
$$;
