-- =============================================================
-- Migration: 004_create_session_registrations
-- Creates session_registrations table for player attendance.
-- =============================================================

CREATE TABLE public.session_registrations (
  id            UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID        NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  player_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, player_id)
);

ALTER TABLE public.session_registrations ENABLE ROW LEVEL SECURITY;

-- Admin can do everything
CREATE POLICY "session_registrations: admin all"
  ON public.session_registrations
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Player can insert their own registration
CREATE POLICY "session_registrations: player insert own"
  ON public.session_registrations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = player_id);

-- Player can read their own registration (for duplicate check)
CREATE POLICY "session_registrations: player read own"
  ON public.session_registrations FOR SELECT
  TO authenticated
  USING (auth.uid() = player_id);

-- Table-level grants
GRANT SELECT ON public.session_registrations TO authenticated;
GRANT INSERT ON public.session_registrations TO authenticated;
