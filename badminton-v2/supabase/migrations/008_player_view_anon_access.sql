-- =============================================================
-- Migration: 008_player_view_anon_access
-- Grants anon SELECT on session_registrations so the public
-- /player route can list players without authentication.
-- =============================================================

-- Allow anon to read session_registrations (needed by /player list)
CREATE POLICY "session_registrations: anon read"
  ON public.session_registrations FOR SELECT
  TO anon
  USING (true);

GRANT SELECT ON public.session_registrations TO anon;
