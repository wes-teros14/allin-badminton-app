-- =============================================================
-- Migration: 080_sessions_closed_at
-- Split "the night counts" from "the night is filed away".
--
-- status = 'complete' keeps its meaning: stats committed, leaderboards fed,
-- celebrations fired, sessions_attended incremented (migration 030). It is
-- reached by the new Finish Session button on the Live page.
--
-- closed_at is set by Close on /admin and does nothing but move the session
-- into Past Sessions. It is deliberately a column, not a status value, so no
-- trigger, RPC or "status = 'complete'" read filter has to learn about it.
-- =============================================================

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS closed_at timestamptz NULL;

COMMENT ON COLUMN public.sessions.closed_at IS
  'Set when the admin closes a completed session; moves it to Past Sessions. Orthogonal to status.';

-- Everything already complete was closed by the old one-step button, so it
-- belongs in Past, not in the active list.
UPDATE public.sessions
   SET closed_at = COALESCE(completed_at, now())
 WHERE status = 'complete' AND closed_at IS NULL;
