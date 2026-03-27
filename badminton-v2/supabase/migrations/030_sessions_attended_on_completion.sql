-- =============================================================
-- Migration: 030_sessions_attended_on_completion
-- Change sessions_attended to only increment when a session is
-- marked complete, not when a player registers.
-- =============================================================

-- 1. Drop the old trigger that fires on registration insert
DROP TRIGGER IF EXISTS on_session_registration_insert ON public.session_registrations;
DROP FUNCTION IF EXISTS public.update_sessions_attended_on_registration();

-- 2. New trigger function: fires when session status transitions → 'complete'
CREATE OR REPLACE FUNCTION public.increment_sessions_attended_on_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM 'complete' AND NEW.status = 'complete' THEN
    INSERT INTO public.player_stats (player_id, sessions_attended)
    SELECT player_id, 1
    FROM public.session_registrations
    WHERE session_id = NEW.id
    ON CONFLICT (player_id) DO UPDATE SET
      sessions_attended = player_stats.sessions_attended + 1,
      updated_at        = now();
  END IF;
  RETURN NEW;
END;
$$;

-- 3. Attach to sessions table
DROP TRIGGER IF EXISTS on_session_complete ON public.sessions;
CREATE TRIGGER on_session_complete
  AFTER UPDATE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.increment_sessions_attended_on_complete();
