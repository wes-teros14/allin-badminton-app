-- =============================================================
-- Migration: 085_sessions_sub_picks
-- The admin's preferred substitutes for one session (max 2).
--
-- The Subs panel on the live court screen ranks these players first.
-- Stored on the session, not on profiles, because a pick means "my sub
-- for tonight" and must not carry over to the next session. Shared in
-- the database (not localStorage) so every admin/moderator phone shows
-- the same stars. Written by admins only: the existing
-- "sessions: admin all" policy covers it, and moderators have no
-- UPDATE on sessions, so they see the stars read-only.
-- =============================================================

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS sub_picks uuid[] NOT NULL DEFAULT '{}';

ALTER TABLE public.sessions
  DROP CONSTRAINT IF EXISTS sessions_sub_picks_max_two,
  ADD CONSTRAINT sessions_sub_picks_max_two CHECK (cardinality(sub_picks) <= 2);

COMMENT ON COLUMN public.sessions.sub_picks IS
  'Admin''s preferred substitutes for this session (max 2), ranked first in the Subs panel.';
