-- Migration 052: Add started_at to matches
--
-- Records the exact timestamp when a match transitions to 'playing' status.
-- Used to compute remaining time on the current game for accurate wait estimates.

ALTER TABLE public.matches ADD COLUMN started_at TIMESTAMPTZ DEFAULT NULL;
