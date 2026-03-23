-- =============================================================
-- Migration: 019_grant_service_role_seed_access
-- Grants table-level access to the service_role Postgres role.
-- Required for the local dev seed script (npm run seed) to create
-- test users, sessions, registrations, and matches.
-- The service_role key bypasses RLS but still needs explicit GRANTs.
-- =============================================================

GRANT ALL ON public.profiles              TO service_role;
GRANT ALL ON public.sessions              TO service_role;
GRANT ALL ON public.session_registrations TO service_role;
GRANT ALL ON public.matches               TO service_role;
