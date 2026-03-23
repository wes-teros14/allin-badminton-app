-- =============================================================
-- Migration: 028_add_session_duration
-- Adds a free-text duration column to sessions (e.g. "2 hrs")
-- =============================================================

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS duration TEXT DEFAULT NULL;
