-- =============================================================
-- Migration 093: the Gallery stays open until the session is closed (Neon only)
--
-- Owner, 2026-11-22: players may add, replace, re-caption or delete their photo while the session
-- is in progress AND after Finish Session, until the admin closes it (sessions.closed_at set).
-- Replaces 092's window, which ended at Finish Session (status = 'complete').
--
--   open    status = 'in_progress', or status = 'complete' and closed_at is null
--   upload  registered for the session and it is open; admin any time, any session.
--   change  own photo while the session is open (locked once closed); admin any time.
--
-- CREATE OR REPLACE keeps 092's grants (EXECUTE to authenticated only) and the policies that call
-- these functions.
-- =============================================================

CREATE FUNCTION public.gallery_session_open(p_session UUID) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.sessions
    WHERE id = p_session
      AND (status = 'in_progress' OR (status = 'complete' AND closed_at IS NULL))
  );
$$;

REVOKE ALL ON FUNCTION public.gallery_session_open(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gallery_session_open(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.gallery_can_upload(p_session UUID) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.gallery_is_admin() OR (
    public.gallery_session_open(p_session)
    AND EXISTS (SELECT 1 FROM public.session_registrations
                WHERE session_id = p_session AND player_id = auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.gallery_can_change(p_session UUID, p_player UUID) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.gallery_is_admin() OR (
    p_player = auth.uid() AND public.gallery_session_open(p_session)
  );
$$;
