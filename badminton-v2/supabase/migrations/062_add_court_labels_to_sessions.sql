-- =============================================================
-- Migration: 062_add_court_labels_to_sessions
-- Stores per-session court display labels shared by admin and players.
-- =============================================================

ALTER TABLE public.sessions
ADD COLUMN court_1_label TEXT NOT NULL DEFAULT 'Court 1',
ADD COLUMN court_2_label TEXT NOT NULL DEFAULT 'Court 2';

