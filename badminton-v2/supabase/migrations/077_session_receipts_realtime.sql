-- =============================================================
-- Migration: 077_session_receipts_realtime
-- Enables Supabase Realtime for session_receipts.
--
-- useRoster subscribes to postgres_changes on session_receipts (added
-- alongside its existing session_registrations listener on the same
-- roster:{sessionId} channel) so the admin payment panel updates the
-- moment a player uploads, without a manual refresh.
--
-- Mirrors 072_session_registrations_realtime.sql, whose header
-- documents exactly what goes wrong without the publication entry:
-- the subscription is silently inert and the bug presents as
-- "only updates after a full page refresh".
--
-- Realtime applies RLS, so admins receive every change event while
-- players receive only their own rows.
-- =============================================================

ALTER TABLE public.session_receipts REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'session_receipts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.session_receipts;
  END IF;
END
$$;
