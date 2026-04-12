-- =============================================================
-- Migration: 043_admin_update_profiles
-- Allows admins to update any player's profile (gender, level, nickname, role).
-- =============================================================

CREATE POLICY "profiles: admin update any"
  ON public.profiles FOR UPDATE
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
