-- =============================================================
-- Migration: 025_add_registration_source
-- Adds source column to session_registrations to distinguish
-- self-registered players from admin-added ones.
-- Used for the "Registration Early Bird" award calculation.
-- =============================================================

ALTER TABLE public.session_registrations
  ADD COLUMN source TEXT NOT NULL DEFAULT 'self'
  CHECK (source IN ('self', 'admin'));
