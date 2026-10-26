-- =============================================================
-- Migration: 088_announcer_clips
-- Prerecorded name calls for the court announcer. When a game starts on a
-- court, the live-board tablet plays e.g. "Court … 2 … AJ … and … Jaz …
-- versus … Sim … and … Kurt" from these clips.
--
-- One WAV per key: a player's uuid, or a fixed word
-- ('phrase:court', 'phrase:number-1'..'phrase:number-9', 'phrase:and',
-- 'phrase:versus'; was 'phrase:court-1'..'-4' until 2026-10-26, before any
-- were recorded).
-- The admin records or uploads them (Players page, Settings page).
--
-- Public read: the live board runs without a login, and a clip is only a
-- spoken name. Writes are admin-only, like payment-qr (073).
-- updated_at versions the tablet's offline copy: a re-record changes it,
-- so the tablet downloads the new clip on its next prepare.
-- =============================================================

CREATE TABLE public.announcer_clips (
  key         TEXT        PRIMARY KEY CHECK (char_length(key) BETWEEN 1 AND 64),
  path        TEXT        NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by  UUID        REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE public.announcer_clips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "announcer_clips: public read"
  ON public.announcer_clips FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "announcer_clips: admin all"
  ON public.announcer_clips FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

GRANT SELECT ON public.announcer_clips TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.announcer_clips TO authenticated;

-- ---------------------------------------------------------------
-- Storage bucket
-- ---------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('announcer-clips', 'announcer-clips', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "announcer-clips: public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'announcer-clips');

CREATE POLICY "announcer-clips: admin insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'announcer-clips'
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "announcer-clips: admin update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'announcer-clips'
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "announcer-clips: admin delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'announcer-clips'
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
