-- =============================================================
-- Migration: 057_add_is_archived_to_shuttle_batches
-- Adds soft-archive support for depleted shuttle tubes so they can
-- be hidden from inventory without losing finance history.
-- =============================================================

ALTER TABLE public.shuttle_batches
ADD COLUMN is_archived BOOLEAN NOT NULL DEFAULT false;
