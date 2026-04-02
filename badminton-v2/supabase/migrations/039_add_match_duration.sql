-- Migration 039: Add duration_seconds to matches
--
-- Records how long a match took from first play to finish.
-- Captured by the kiosk or admin when the Finish button is pressed.

ALTER TABLE public.matches ADD COLUMN duration_seconds INT DEFAULT NULL;
