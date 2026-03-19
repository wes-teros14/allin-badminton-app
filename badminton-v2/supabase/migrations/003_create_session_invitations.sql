-- =============================================================
-- Migration: 003_create_session_invitations
-- Creates session_invitations table for registration URL tokens.
-- =============================================================

CREATE TABLE public.session_invitations (
  id         UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID        NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  is_active  BOOLEAN     NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.session_invitations ENABLE ROW LEVEL SECURITY;

-- Admin can do everything
CREATE POLICY "session_invitations: admin all"
  ON public.session_invitations
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Anon can read (for token validation on registration page in Story 2.3)
CREATE POLICY "session_invitations: anon read"
  ON public.session_invitations FOR SELECT
  TO anon
  USING (true);

-- Table-level grants
GRANT SELECT ON public.session_invitations TO anon, authenticated;
GRANT INSERT, UPDATE ON public.session_invitations TO authenticated;
