-- Migration 037: Allow authenticated users to read all profiles
--
-- The existing "profiles: authenticated own read" policy only allows users
-- to read their own profile. This breaks the schedule view, kiosk view, and
-- any feature that needs to resolve player UUIDs to display names.
--
-- anon already has full read access (for the public registration page).
-- authenticated users need the same so they can see each other's names.

CREATE POLICY "profiles: authenticated read all"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);
