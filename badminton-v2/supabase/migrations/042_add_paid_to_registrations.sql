-- Migration 042: Add paid column to session_registrations
--
-- Tracks whether a player has paid for the session.
-- Defaults to false (not paid).

ALTER TABLE public.session_registrations
  ADD COLUMN paid BOOLEAN NOT NULL DEFAULT false;
