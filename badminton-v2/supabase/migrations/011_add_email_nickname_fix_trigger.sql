-- =============================================================
-- Migration: 011_add_email_nickname_fix_trigger
-- Adds email and nickname columns to profiles (previously only
-- added via ad-hoc SQL) and updates handle_new_user() to include
-- email when creating a profile from the auth trigger.
-- =============================================================

-- Add columns (IF NOT EXISTS handles cases where ad-hoc SQL already added them)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email    TEXT,
  ADD COLUMN IF NOT EXISTS nickname TEXT;

-- Update trigger to populate email from auth.users on sign-up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  base_slug  TEXT;
  final_slug TEXT;
  counter    INT := 1;
BEGIN
  -- Build base slug from Google display name (raw_user_meta_data.name)
  base_slug := lower(
    regexp_replace(
      regexp_replace(
        coalesce(new.raw_user_meta_data ->> 'name', 'user'),
        '[^a-zA-Z0-9 -]', '', 'g'   -- strip non-alphanumeric (keep spaces + hyphens)
      ),
      '\s+', '-', 'g'                -- spaces -> hyphens
    )
  );
  -- Remove leading/trailing hyphens; default to 'user' if blank
  base_slug := trim(both '-' from base_slug);
  IF base_slug = '' THEN
    base_slug := 'user';
  END IF;

  final_slug := base_slug;

  -- Deduplicate: append -2, -3, ... until slug is unique
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE name_slug = final_slug) LOOP
    counter    := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;

  INSERT INTO public.profiles (id, role, name_slug, email)
  VALUES (new.id, 'player', final_slug, new.email);

  RETURN new;
END;
$$;

-- Ensure RLS policies for INSERT and UPDATE exist
-- (These may already exist from ad-hoc SQL; DO nothing on conflict via IF NOT EXISTS pattern)

-- INSERT policy: let authenticated users insert their own profile
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles'
      AND policyname = 'profiles: authenticated insert own'
  ) THEN
    EXECUTE 'CREATE POLICY "profiles: authenticated insert own"
      ON public.profiles FOR INSERT
      TO authenticated
      WITH CHECK (id = auth.uid())';
  END IF;
END $$;

-- UPDATE policy: let authenticated users update their own profile
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles'
      AND policyname = 'profiles: authenticated update own'
  ) THEN
    EXECUTE 'CREATE POLICY "profiles: authenticated update own"
      ON public.profiles FOR UPDATE
      TO authenticated
      USING (id = auth.uid())
      WITH CHECK (id = auth.uid())';
  END IF;
END $$;

-- Table-level grants for INSERT and UPDATE
GRANT INSERT ON public.profiles TO authenticated;
GRANT UPDATE ON public.profiles TO authenticated;
