-- =============================================================
-- Migration: 021_add_sessions_completed_at
-- Adds completed_at timestamp to sessions, auto-set by trigger
-- when status transitions to 'complete'.
-- =============================================================

ALTER TABLE public.sessions
  ADD COLUMN completed_at TIMESTAMPTZ;

-- Trigger function: set completed_at when status → 'complete'
CREATE OR REPLACE FUNCTION public.set_session_completed_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'complete' AND (OLD.status IS DISTINCT FROM 'complete') THEN
    NEW.completed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_session_complete
  BEFORE UPDATE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_session_completed_at();

-- Backfill existing completed sessions (approximate with date at end of day)
UPDATE public.sessions
SET completed_at = (date || ' 23:59:00')::timestamptz
WHERE status = 'complete' AND completed_at IS NULL;
