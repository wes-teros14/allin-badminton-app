-- =============================================================
-- Migration: 033_create_announcements
-- Single-row bulletin board visible to all authenticated users.
-- Only admins can update the content.
-- =============================================================

CREATE TABLE public.announcements (
  id         INT         NOT NULL PRIMARY KEY DEFAULT 1,
  content    TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT single_row CHECK (id = 1)
);

-- Seed the single row
INSERT INTO public.announcements (id, content) VALUES (1, NULL);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read
CREATE POLICY "announcements: read all authenticated"
  ON public.announcements FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can update
CREATE POLICY "announcements: update admin only"
  ON public.announcements FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

GRANT SELECT, UPDATE ON public.announcements TO authenticated;
