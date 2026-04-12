-- Migration: 046_trigger_payment_confirmed
-- Fires a payment confirmation email when admin marks a registration as paid.
-- Triggered by: RosterPanel.tsx → useRoster.ts:updatePaid() → UPDATE session_registrations SET paid = true

CREATE OR REPLACE FUNCTION public.notify_payment_confirmed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url    TEXT;
  v_secret TEXT;
BEGIN
  -- Only fire when paid flips false → true
  IF (OLD.paid = false AND NEW.paid = true) THEN
    SELECT value INTO v_url    FROM public.app_config WHERE key = 'email_function_url';
    SELECT value INTO v_secret FROM public.app_config WHERE key = 'function_auth_secret';

    IF v_url IS NULL OR v_secret IS NULL THEN
      RETURN NEW; -- config not set yet, skip silently
    END IF;

    PERFORM net.http_post(
      url     := v_url,
      headers := jsonb_build_object(
                   'Content-Type',  'application/json',
                   'Authorization', 'Bearer ' || v_secret
                 ),
      body    := jsonb_build_object(
                   'type',    'payment_confirmed',
                   'payload', jsonb_build_object(
                     'registration_id', NEW.id,
                     'session_id',      NEW.session_id,
                     'player_id',       NEW.player_id
                   )
                 )
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_payment_confirmed
  AFTER UPDATE OF paid ON public.session_registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_payment_confirmed();
