-- =============================================================
-- Migration 092: session_photos — the Gallery (Neon only; plan: tasks/todo.md "Photo Gallery")
--
-- One photo per player per session; admins have no limit. The image files live in the
-- private Neon bucket `gallery`, at keys the `gallery` Function derives from the row:
--   <session_id>/<id>/v<version>        the photo (1280 px long edge)
--   <session_id>/<id>/v<version>-thumb  the grid thumbnail
-- Keys are never stored or chosen by the client, so a row can only ever point at its own files.
--
-- Rules (owner, 2026-11-20). Every rule lives here; the Function and the UI only follow them.
--   view    signed in, not a guest, >= 1 completed session; your own photo always; admin all.
--   upload  registered for the session and it is in_progress; admin any time, any session.
--   change  own photo until the session is complete (then locked); admin any time.
-- =============================================================

CREATE TABLE public.session_photos (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID        NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  player_id   UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  caption     TEXT        CHECK (caption IS NULL OR char_length(caption) <= 140),
  -- 0 = nothing uploaded yet. Each upload or replace writes version+1, then sets it here.
  version     INT         NOT NULL DEFAULT 0 CHECK (version >= 0),
  width       INT         CHECK (width IS NULL OR width BETWEEN 1 AND 4096),
  height      INT         CHECK (height IS NULL OR height BETWEEN 1 AND 4096),
  ready       BOOLEAN     NOT NULL DEFAULT false,
  -- Set by trigger from the uploader's role, never by the client. Admin photos are exempt
  -- from one-per-session.
  by_admin    BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (NOT ready OR version > 0)
);

-- One photo per player per session. An index, not a policy check, so two quick taps can't
-- both insert.
CREATE UNIQUE INDEX session_photos_one_per_player
  ON public.session_photos (session_id, player_id) WHERE NOT by_admin;
CREATE INDEX session_photos_session ON public.session_photos (session_id, created_at);

-- ---------------------------------------------------------------
-- Helpers. SECURITY DEFINER so the policies can read profiles / player_stats /
-- registrations / sessions without depending on those tables' own policies.
-- ---------------------------------------------------------------
CREATE FUNCTION public.gallery_is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin');
$$;

-- Not a guest and at least one completed session (sessions_attended only counts completed ones).
CREATE FUNCTION public.gallery_can_view() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.gallery_is_admin() OR (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND NOT coalesce(is_guest, false))
    AND EXISTS (SELECT 1 FROM public.player_stats WHERE player_id = auth.uid() AND sessions_attended >= 1)
  );
$$;

CREATE FUNCTION public.gallery_can_upload(p_session UUID) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.gallery_is_admin() OR (
    EXISTS (SELECT 1 FROM public.sessions WHERE id = p_session AND status = 'in_progress')
    AND EXISTS (SELECT 1 FROM public.session_registrations
                WHERE session_id = p_session AND player_id = auth.uid())
  );
$$;

-- Own photo while its session is not complete; admin always.
CREATE FUNCTION public.gallery_can_change(p_session UUID, p_player UUID) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.gallery_is_admin() OR (
    p_player = auth.uid()
    AND EXISTS (SELECT 1 FROM public.sessions WHERE id = p_session AND status <> 'complete')
  );
$$;

REVOKE ALL ON FUNCTION public.gallery_is_admin(), public.gallery_can_view(),
  public.gallery_can_upload(UUID), public.gallery_can_change(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gallery_is_admin(), public.gallery_can_view(),
  public.gallery_can_upload(UUID), public.gallery_can_change(UUID, UUID) TO authenticated;

-- ---------------------------------------------------------------
-- Trigger: the client can't claim by_admin, move a photo, or take someone else's.
-- ---------------------------------------------------------------
CREATE FUNCTION public.session_photos_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.by_admin := public.gallery_is_admin();
    NEW.version := 0;
    NEW.ready := false;
    NEW.created_at := now();
  ELSE
    NEW.id := OLD.id;
    NEW.session_id := OLD.session_id;
    NEW.player_id := OLD.player_id;
    NEW.by_admin := OLD.by_admin;
    NEW.created_at := OLD.created_at;
    IF NEW.version < OLD.version THEN
      RAISE EXCEPTION 'version can only go up' USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER session_photos_guard
  BEFORE INSERT OR UPDATE ON public.session_photos
  FOR EACH ROW EXECUTE FUNCTION public.session_photos_guard();

-- ---------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------
ALTER TABLE public.session_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "session_photos: view"
  ON public.session_photos FOR SELECT TO authenticated
  USING (player_id = auth.uid() OR public.gallery_is_admin() OR (ready AND public.gallery_can_view()));

CREATE POLICY "session_photos: upload"
  ON public.session_photos FOR INSERT TO authenticated
  WITH CHECK (player_id = auth.uid() AND public.gallery_can_upload(session_id));

CREATE POLICY "session_photos: change"
  ON public.session_photos FOR UPDATE TO authenticated
  USING (public.gallery_can_change(session_id, player_id))
  WITH CHECK (public.gallery_can_change(session_id, player_id));

CREATE POLICY "session_photos: delete"
  ON public.session_photos FOR DELETE TO authenticated
  USING (public.gallery_can_change(session_id, player_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_photos TO authenticated;
