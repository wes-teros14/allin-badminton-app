-- Migration 035: Add max_players column to session_invitations
--
-- This column was used by the registration limit trigger (migration 020)
-- and app code but was never formally added to the table schema.

ALTER TABLE public.session_invitations
  ADD COLUMN IF NOT EXISTS max_players INT DEFAULT NULL;
