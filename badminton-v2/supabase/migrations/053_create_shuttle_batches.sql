-- =============================================================
-- Migration: 053_create_shuttle_batches
-- Creates shuttle_batches table for tracking inventory purchases.
-- Admin-only: players have no access to cost or stock data.
-- =============================================================

CREATE TABLE public.shuttle_batches (
  id            UUID         NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  purchased_at  DATE         NOT NULL DEFAULT current_date,
  brand         TEXT         NOT NULL,
  tube_count    INT          NOT NULL CHECK (tube_count > 0),
  cost_per_tube NUMERIC(8,2) NOT NULL CHECK (cost_per_tube > 0),
  notes         TEXT,
  created_by    UUID         NOT NULL REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- No total_cost column — always computed as tube_count * cost_per_tube on read.
-- Storing it would create a sync hazard with no benefit.

ALTER TABLE public.shuttle_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shuttle_batches: admin all"
  ON public.shuttle_batches
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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shuttle_batches TO authenticated;
-- No anon grant — finance data is admin-only.
