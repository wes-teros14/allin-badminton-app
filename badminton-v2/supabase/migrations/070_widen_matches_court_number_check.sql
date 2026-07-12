-- Migration: 070_widen_matches_court_number_check
-- The original court_number CHECK (migration 007) hardcoded a 2-court limit
-- before sessions.court_count made court count configurable (migration 066).
-- That stale constraint silently blocked assigning matches to court 3+.

ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_court_number_check;

ALTER TABLE public.matches
ADD CONSTRAINT matches_court_number_check CHECK (court_number IS NULL OR court_number >= 1);
