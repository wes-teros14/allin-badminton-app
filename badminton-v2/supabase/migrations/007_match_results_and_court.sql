-- =============================================================
-- Migration: 007_match_results_and_court
-- Adds court_number to matches and creates match_results table.
-- Also adds anon RLS policies so the live board (unauthenticated) can
-- update match status and record results.
-- NOTE: Run each ALTER TABLE statement separately in Supabase Dashboard.
-- =============================================================

-- Add court_number to matches (1 or 2)
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS court_number INTEGER CHECK (court_number IN (1, 2));

-- Allow live board (anon) to update matches (status + court_number)
CREATE POLICY "matches: live-board update"
  ON public.matches FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- Create match_results table
CREATE TABLE public.match_results (
  id                 UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id           UUID        NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  winning_pair_index INTEGER     NOT NULL CHECK (winning_pair_index IN (1, 2)),
  completed_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.match_results ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "match_results: admin all"
  ON public.match_results
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- All can read
CREATE POLICY "match_results: read all"
  ON public.match_results FOR SELECT
  TO anon, authenticated
  USING (true);

-- Live board (anon) can insert results
CREATE POLICY "match_results: live-board insert"
  ON public.match_results FOR INSERT
  TO anon
  WITH CHECK (true);

-- Table-level grants
GRANT SELECT ON public.match_results TO anon, authenticated;
GRANT INSERT ON public.match_results TO authenticated, anon;
