-- =============================================================
-- Migration: 071_backfill_sessions_attended
-- Recomputes player_stats.sessions_attended from source-of-truth
-- data (session_registrations joined to completed sessions).
--
-- Migration 030 switched the counter to increment only when a
-- session transitions to status='complete', but never backfilled
-- sessions that were already complete at that point, leaving every
-- player under-counted. This recompute is idempotent and safe to
-- rerun — it always sets sessions_attended to the true count of
-- completed sessions the player registered for.
-- =============================================================

UPDATE public.player_stats ps
SET sessions_attended = counts.attended,
    updated_at         = now()
FROM (
  SELECT p.player_id,
         COUNT(CASE WHEN s.status = 'complete' THEN sr.id END) AS attended
  FROM public.player_stats p
  LEFT JOIN public.session_registrations sr ON sr.player_id = p.player_id
  LEFT JOIN public.sessions s ON s.id = sr.session_id
  GROUP BY p.player_id
) counts
WHERE ps.player_id = counts.player_id
  AND ps.sessions_attended IS DISTINCT FROM counts.attended;
