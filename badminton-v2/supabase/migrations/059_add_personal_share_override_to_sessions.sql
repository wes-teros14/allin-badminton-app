-- =============================================================
-- Migration: 059_add_personal_share_override_to_sessions
-- Stores an optional manual override for the organizer's own share
-- in session-level P&L calculations.
-- =============================================================

ALTER TABLE public.sessions
  ADD COLUMN personal_share_override NUMERIC(10,2);
