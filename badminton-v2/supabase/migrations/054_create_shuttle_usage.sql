-- =============================================================
-- Migration: 054_create_shuttle_usage
-- Creates shuttle_usage table for logging per-session shuttle consumption.
-- One row per batch per session; update tubes_used if more consumed.
-- Admin-only: players have no access to usage or cost data.
-- =============================================================

CREATE TABLE public.shuttle_usage (
  id          UUID         NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID         NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  batch_id    UUID         NOT NULL REFERENCES public.shuttle_batches(id),
  tubes_used  NUMERIC(4,1) NOT NULL CHECK (tubes_used > 0),
  recorded_by UUID         NOT NULL REFERENCES auth.users(id),
  recorded_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (session_id, batch_id)
);

-- NUMERIC(4,1) for tubes_used supports partial tracking (e.g. 0.5, 1.5).
-- UNIQUE (session_id, batch_id): one row per batch per session.
-- To record more usage from the same batch: UPDATE tubes_used, not INSERT.

ALTER TABLE public.shuttle_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shuttle_usage: admin all"
  ON public.shuttle_usage
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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shuttle_usage TO authenticated;
-- No anon grant — finance data is admin-only.
