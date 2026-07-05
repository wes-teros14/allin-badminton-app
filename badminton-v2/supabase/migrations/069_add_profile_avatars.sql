-- =============================================================
-- Migration: 069_add_profile_avatars
-- Adds an avatar_url column to profiles, plus a public "avatars"
-- Storage bucket with RLS so each user can only manage their own
-- avatar file, stored at path "{user_id}/avatar".
--
-- avatar_url already becomes readable by all authenticated users via
-- the existing "profiles: authenticated read all" policy
-- (037_profiles_authenticated_read_all.sql) — no new profiles policy
-- needed for reads. Writes to avatar_url reuse the existing own-row
-- update policy (011/043).
-- =============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- ---------------------------------------------------------------
-- Storage bucket (public read so avatars display on the schedule
-- for every teammate, not just the owner)
-- ---------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------
-- Storage RLS: anyone can view, only the owning user can
-- upload/replace/delete their own file (path must start with
-- their own auth.uid() as the first path segment).
-- ---------------------------------------------------------------
CREATE POLICY "avatars: public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "avatars: users upload own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "avatars: users update own"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "avatars: users delete own"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
