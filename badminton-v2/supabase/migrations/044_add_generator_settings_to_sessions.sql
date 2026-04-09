-- =============================================================
-- Migration: 044_add_generator_settings_to_sessions
-- Stores the match generator settings used when locking a schedule,
-- so they can be restored when viewing the locked stage.
-- =============================================================

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS generator_settings JSONB;
