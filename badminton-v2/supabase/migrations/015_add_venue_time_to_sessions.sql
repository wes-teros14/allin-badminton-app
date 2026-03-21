-- =============================================================
-- Migration: 015_add_venue_time_to_sessions
-- Adds optional venue and time fields to sessions table.
-- =============================================================

ALTER TABLE public.sessions
  ADD COLUMN venue TEXT,
  ADD COLUMN time  TEXT;
