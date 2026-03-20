-- =============================================================
-- Migration: 012_session_registrations_update_delete_grant
-- Grants UPDATE and DELETE on session_registrations to authenticated
-- so admins can override player gender/level and remove players.
-- =============================================================

GRANT UPDATE ON public.session_registrations TO authenticated;
GRANT DELETE ON public.session_registrations TO authenticated;
