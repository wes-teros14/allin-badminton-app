-- =============================================================
-- Migration: 009_session_registrations_read_all
-- Allow any authenticated user to read all session_registrations
-- so /player list works when the browser has an active auth session.
-- =============================================================

CREATE POLICY "session_registrations: authenticated read all"
  ON public.session_registrations FOR SELECT
  TO authenticated
  USING (true);
