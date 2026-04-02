-- Migration 041: Add notifications table to Supabase Realtime publication
--
-- notifications has REPLICA IDENTITY FULL (set in 029) but was never added
-- to the publication, so postgres_changes events were never broadcast.

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
