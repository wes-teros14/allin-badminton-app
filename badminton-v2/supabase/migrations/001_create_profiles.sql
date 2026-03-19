-- =============================================================
-- Migration: 001_create_profiles
-- Creates profiles table, DB trigger for auto-create on OAuth sign-in,
-- and RLS policies for the profiles table.
-- =============================================================

-- Profiles table
CREATE TABLE public.profiles (
  id         UUID        NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT        NOT NULL DEFAULT 'player' CHECK (role IN ('admin', 'player')),
  name_slug  TEXT        NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------
-- Trigger function: auto-create profiles row on first OAuth sign-in
-- SECURITY DEFINER allows the function to write to public.profiles
-- even when called from the auth schema context.
-- ---------------------------------------------------------------
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
      '\s+', '-', 'g'                -- spaces → hyphens
    )
  );
  -- Remove leading/trailing hyphens; default to 'user' if blank
  base_slug := trim(both '-' from base_slug);
  IF base_slug = '' THEN
    base_slug := 'user';
  END IF;

  final_slug := base_slug;

  -- Deduplicate: append -2, -3, … until slug is unique
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE name_slug = final_slug) LOOP
    counter    := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;

  INSERT INTO public.profiles (id, role, name_slug)
  VALUES (new.id, 'player', final_slug);

  RETURN new;
END;
$$;

-- Trigger: fires after every new row in auth.users (i.e. every new OAuth sign-in)
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read their own profile (for useAuth hook)
CREATE POLICY "profiles: authenticated own read"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Anon can read all profiles (for /player/:nameSlug URL resolution in later stories)
CREATE POLICY "profiles: anon read"
  ON public.profiles FOR SELECT
  TO anon
  USING (true);

-- Table-level grants (required separately from RLS policies)
GRANT SELECT ON public.profiles TO anon, authenticated;
