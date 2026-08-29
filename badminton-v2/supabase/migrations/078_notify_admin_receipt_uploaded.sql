-- =============================================================
-- Migration: 078_notify_admin_receipt_uploaded
-- Notifies admins the moment a player uploads a payment receipt,
-- so the receipt shows up as a toast instead of having to be
-- noticed by opening the finance page.
--
-- Mirrors the cheer notification in 029 exactly: a SECURITY DEFINER
-- AFTER INSERT trigger writing into public.notifications, which the
-- client's NotificationContext already listens to over realtime.
--
-- SECURITY DEFINER is required. The uploading player has no RLS
-- policy allowing them to INSERT a notification addressed to
-- somebody else -- the trigger writes on their behalf, exactly as
-- notify_cheer_received() does.
-- =============================================================

-- 1. Widen the type constraint. 029 created it inline as
--    CHECK (type IN ('cheer','award')), which Postgres auto-named
--    notifications_type_check.
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('cheer', 'award', 'receipt'));

-- 2. Trigger function
CREATE OR REPLACE FUNCTION public.notify_receipt_uploaded()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player_name  TEXT;
  v_session_name TEXT;
BEGIN
  SELECT COALESCE(nickname, name_slug) INTO v_player_name
    FROM public.profiles WHERE id = NEW.player_id;

  SELECT name INTO v_session_name
    FROM public.sessions WHERE id = NEW.session_id;

  -- One notification per admin. The uploader is excluded, since an
  -- admin who is also playing does not need telling about their own
  -- upload.
  INSERT INTO public.notifications (user_id, type, title, body, related_id)
  SELECT p.id,
         'receipt',
         COALESCE(v_session_name, 'a session'),
         COALESCE(v_player_name, 'A player'),
         NEW.session_id::TEXT
  FROM   public.profiles p
  WHERE  p.role = 'admin'
    AND  p.id <> NEW.player_id;

  RETURN NEW;
END;
$$;

-- 3. Trigger
DROP TRIGGER IF EXISTS on_receipt_notify ON public.session_receipts;

CREATE TRIGGER on_receipt_notify
  AFTER INSERT ON public.session_receipts
  FOR EACH ROW EXECUTE FUNCTION public.notify_receipt_uploaded();
