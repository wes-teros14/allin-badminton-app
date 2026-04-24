-- =============================================================
-- Migration: 051_add_is_active_to_profiles
-- Adds is_active flag to profiles for soft-deactivation.
-- Inactive players cannot log in (enforced at app layer) and
-- are hidden from all player-facing lists and leaderboards.
-- =============================================================

ALTER TABLE public.profiles
  ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
