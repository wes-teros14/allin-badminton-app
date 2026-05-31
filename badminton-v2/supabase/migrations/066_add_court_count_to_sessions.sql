-- Migration: 066_add_court_count_to_sessions
-- Adds per-session court count while preserving legacy two-court behavior.

ALTER TABLE public.sessions
ADD COLUMN court_count INTEGER NOT NULL DEFAULT 2;

ALTER TABLE public.sessions
ADD CONSTRAINT sessions_court_count_positive CHECK (court_count >= 1);
