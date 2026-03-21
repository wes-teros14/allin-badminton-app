-- =============================================================
-- Migration: 005_create_matches
-- Creates match_status enum and matches table for the session queue.
-- =============================================================

CREATE TYPE public.match_status AS ENUM ('queued', 'playing', 'complete');

CREATE TABLE public.matches (
  id                UUID         NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        UUID         NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  queue_position    INTEGER      NOT NULL,
  team1_player1_id  UUID         NOT NULL REFERENCES auth.users(id),
  team1_player2_id  UUID         NOT NULL REFERENCES auth.users(id),
  team2_player1_id  UUID         NOT NULL REFERENCES auth.users(id),
  team2_player2_id  UUID         NOT NULL REFERENCES auth.users(id),
  status            match_status NOT NULL DEFAULT 'queued',
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (session_id, queue_position)
);

ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

-- Admin can do everything
CREATE POLICY "matches: admin all"
  ON public.matches
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- All roles can read matches (live board + player views need them)
CREATE POLICY "matches: read all"
  ON public.matches FOR SELECT
  TO anon, authenticated
  USING (true);

-- Table-level grants
GRANT SELECT ON public.matches TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.matches TO authenticated;
