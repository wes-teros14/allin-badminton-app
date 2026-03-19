-- =============================================================
-- Migration: 006_add_player_attributes
-- Adds gender and skill level columns to profiles table.
-- Required for the match generation engine (skill balancing + gender-aware matching).
-- =============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gender TEXT    CHECK (gender IN ('M', 'F')),
  ADD COLUMN IF NOT EXISTS level  INTEGER CHECK (level BETWEEN 1 AND 10) DEFAULT 5;
