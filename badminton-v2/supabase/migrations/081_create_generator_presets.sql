-- =============================================================
-- Migration: 081_create_generator_presets
-- Named Match Generator scoring-weight presets the admin builds up
-- over time (UX review, docs/visual/match-generator-presets-options.html,
-- Option C). Admin-only: MatchGeneratorPanel is only ever rendered from
-- the admin branch of SessionView.tsx -- moderators hit an early return
-- before reaching it, so this mirrors that existing boundary rather than
-- widening it.
-- =============================================================

CREATE TABLE public.generator_presets (
  id         UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  settings   JSONB       NOT NULL,
  created_by UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT generator_presets_name_not_blank CHECK (btrim(name) <> '')
);

ALTER TABLE public.generator_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "generator_presets: admin read"
  ON public.generator_presets FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "generator_presets: admin insert"
  ON public.generator_presets FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "generator_presets: admin update"
  ON public.generator_presets FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "generator_presets: admin delete"
  ON public.generator_presets FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.generator_presets TO authenticated;
