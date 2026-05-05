-- Rename shuttle_usage.tubes_used → shuttles_used
-- Tracking is now in individual shuttles (pieces), not tubes.
-- 1 tube = 12 shuttles; each shuttle_batches row represents 1 tube.
ALTER TABLE shuttle_usage RENAME COLUMN tubes_used TO shuttles_used;
