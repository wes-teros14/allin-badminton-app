-- =============================================================
-- Migration: 010_realtime_replica_identity
-- Required for Supabase Realtime filtered subscriptions.
-- Without REPLICA IDENTITY FULL, filter: session_id=eq.xxx
-- cannot match against UPDATE/DELETE events.
-- =============================================================

ALTER TABLE public.matches REPLICA IDENTITY FULL;
ALTER TABLE public.sessions REPLICA IDENTITY FULL;

-- Add matches to the Supabase Realtime publication so postgres_changes events are broadcast
ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
