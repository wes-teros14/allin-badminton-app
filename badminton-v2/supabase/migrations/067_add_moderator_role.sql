-- =============================================================
-- Migration: 067_add_moderator_role
-- Adds 'moderator' role: can manage live matches (finish,
-- edit, move queue) but cannot access setup/finance/players.
-- =============================================================

-- 1. Extend role CHECK constraint on profiles
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check,
  ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'moderator', 'player'));

-- 2. Allow moderators to UPDATE matches
--    Covers: finish match, edit partners, move queue, swap courts
CREATE POLICY "matches: moderator update"
  ON public.matches FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'moderator')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'moderator')
  );

-- 3. Allow moderators to INSERT match_results (recording winners)
CREATE POLICY "match_results: moderator insert"
  ON public.match_results FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'moderator')
  );
