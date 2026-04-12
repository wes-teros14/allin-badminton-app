-- Migration: 047_trigger_session_events
-- Two event-driven email triggers:
--   1. session_full   — fires when a registration INSERT fills a session to max_players
--   2. schedule_ready — fires when session.status transitions to 'schedule_locked'

-- ───────────────────────────────────────────────────────────────────
-- Trigger 1: session_full
-- Compares current registration count to session_invitations.max_players.
-- When equal, POSTs to the edge function to email ALL registered players.
-- ───────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_session_full()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max_players   INT;
  v_current_count INT;
  v_url           TEXT;
  v_secret        TEXT;
BEGIN
  -- Get the capacity for this session (from the active invitation)
  SELECT max_players INTO v_max_players
    FROM public.session_invitations
    WHERE session_id = NEW.session_id
      AND is_active = true
    LIMIT 1;

  -- No capacity limit set — nothing to do
  IF v_max_players IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_current_count
    FROM public.session_registrations
    WHERE session_id = NEW.session_id;

  -- Session just became full
  IF v_current_count = v_max_players THEN
    SELECT value INTO v_url    FROM public.app_config WHERE key = 'email_function_url';
    SELECT value INTO v_secret FROM public.app_config WHERE key = 'function_auth_secret';

    IF v_url IS NULL OR v_secret IS NULL THEN
      RETURN NEW;
    END IF;

    PERFORM net.http_post(
      url     := v_url,
      headers := jsonb_build_object(
                   'Content-Type',  'application/json',
                   'Authorization', 'Bearer ' || v_secret
                 ),
      body    := jsonb_build_object(
                   'type',    'session_full',
                   'payload', jsonb_build_object(
                     'session_id', NEW.session_id
                   )
                 )
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_session_full
  AFTER INSERT ON public.session_registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_session_full();


-- ───────────────────────────────────────────────────────────────────
-- Trigger 2: schedule_ready
-- Detects session.status transition → 'schedule_locked'.
-- POSTs to the edge function to email ALL registered players.
-- ───────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_schedule_ready()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url    TEXT;
  v_secret TEXT;
BEGIN
  IF (NEW.status = 'schedule_locked' AND OLD.status <> 'schedule_locked') THEN
    SELECT value INTO v_url    FROM public.app_config WHERE key = 'email_function_url';
    SELECT value INTO v_secret FROM public.app_config WHERE key = 'function_auth_secret';

    IF v_url IS NULL OR v_secret IS NULL THEN
      RETURN NEW;
    END IF;

    PERFORM net.http_post(
      url     := v_url,
      headers := jsonb_build_object(
                   'Content-Type',  'application/json',
                   'Authorization', 'Bearer ' || v_secret
                 ),
      body    := jsonb_build_object(
                   'type',    'schedule_ready',
                   'payload', jsonb_build_object(
                     'session_id', NEW.id
                   )
                 )
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_schedule_ready
  AFTER UPDATE OF status ON public.sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_schedule_ready();
