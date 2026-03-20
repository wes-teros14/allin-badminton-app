-- =============================================================
-- Migration: 014_session_registrations_gender_level_override
-- Adds gender and level override columns to session_registrations.
-- These are session-scoped overrides — null means "use profile value".
-- Profile table is never affected.
-- =============================================================

ALTER TABLE public.session_registrations
  ADD COLUMN IF NOT EXISTS gender TEXT    CHECK (gender IN ('M', 'F')),
  ADD COLUMN IF NOT EXISTS level  INTEGER CHECK (level BETWEEN 1 AND 10);
