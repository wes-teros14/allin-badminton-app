-- =============================================================
-- Migration: 061_add_shuttles_per_tube_to_shuttle_batches
-- Allows admins to record partially filled tubes in inventory.
-- =============================================================

ALTER TABLE public.shuttle_batches
ADD COLUMN shuttles_per_tube INT NOT NULL DEFAULT 12
CHECK (shuttles_per_tube >= 1 AND shuttles_per_tube <= 12);
