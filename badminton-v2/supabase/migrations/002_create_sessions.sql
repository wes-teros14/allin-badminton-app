-- =============================================================
-- Migration: 002_create_sessions
-- Creates session_status enum and sessions table.
-- =============================================================

-- Session state machine enum
CREATE TYPE public.session_status AS ENUM (
  'setup',
  'registration_open',
  'registration_closed',
  'schedule_locked',
  'in_progress',
  'complete'
);

-- Sessions table
CREATE TABLE public.sessions (
  id         UUID           NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT           NOT NULL,
  date       DATE           NOT NULL,
  status     session_status NOT NULL DEFAULT 'setup',
  created_by UUID           NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ    NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- Admin can do everything (INSERT + UPDATE + SELECT)
CREATE POLICY "sessions: admin all"
  ON public.sessions
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- All roles can read sessions (kiosk + player views need session info)
CREATE POLICY "sessions: read all"
  ON public.sessions FOR SELECT
  TO anon, authenticated
  USING (true);

-- Table-level grants (required separately from RLS)
GRANT SELECT ON public.sessions TO anon, authenticated;
GRANT INSERT, UPDATE ON public.sessions TO authenticated;
