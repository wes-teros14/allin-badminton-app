-- =============================================================
-- Migration: 029_create_notifications
-- Creates notifications table and trigger for cheer notifications
-- =============================================================

-- 1. Notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('cheer', 'award')),
  title TEXT NOT NULL,
  body TEXT,
  related_id TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_unread
  ON public.notifications(user_id)
  WHERE read_at IS NULL;

-- 2. RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- 3. Realtime
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- 4. Trigger: create notification when a cheer is received
CREATE OR REPLACE FUNCTION public.notify_cheer_received()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_giver_name TEXT;
  v_cheer_slug TEXT;
BEGIN
  SELECT COALESCE(nickname, name_slug) INTO v_giver_name
    FROM public.profiles WHERE id = NEW.giver_id;

  SELECT slug INTO v_cheer_slug
    FROM public.cheer_types WHERE id = NEW.cheer_type_id;

  INSERT INTO public.notifications (user_id, type, title, body, related_id)
  VALUES (NEW.receiver_id, 'cheer', v_cheer_slug, v_giver_name, NEW.session_id);

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_cheer_notify
  AFTER INSERT ON public.cheers
  FOR EACH ROW EXECUTE FUNCTION public.notify_cheer_received();

-- 5. Grants
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
