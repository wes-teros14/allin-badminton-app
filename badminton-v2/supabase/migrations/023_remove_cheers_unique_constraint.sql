-- =============================================================
-- Migration: 023_remove_cheers_unique_constraint
-- Allows multiple cheers per giver-receiver pair per session,
-- proportional to games played together.
-- Previously: UNIQUE (session_id, giver_id, receiver_id)
-- Now:        Client enforces limit = games played together
-- =============================================================

ALTER TABLE public.cheers
  DROP CONSTRAINT cheers_session_id_giver_id_receiver_id_key;
