-- =============================================================
-- Migration: 034_registration_opens_at_rls
-- Enforce registration_opens_at at DB level for player inserts.
-- Admins are unaffected (covered by the existing admin-all policy).
-- =============================================================

DROP POLICY IF EXISTS "session_registrations: player insert own"
  ON public.session_registrations;

CREATE POLICY "session_registrations: player insert own"
  ON public.session_registrations FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = player_id
    AND (
      SELECT COALESCE(s.registration_opens_at, '-infinity'::timestamptz) <= now()
      FROM public.sessions s
      WHERE s.id = session_id
    )
  );
