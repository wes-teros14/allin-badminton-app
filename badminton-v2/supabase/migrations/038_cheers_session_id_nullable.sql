-- Migration 038: Make session_id nullable on cheers
--
-- Cheers are now match-scoped (match_id FK). New cheers don't have a session_id.
-- Existing historical cheers retain their session_id value.

ALTER TABLE public.cheers ALTER COLUMN session_id DROP NOT NULL;
