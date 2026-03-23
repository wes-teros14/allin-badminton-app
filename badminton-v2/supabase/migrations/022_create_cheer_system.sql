-- =============================================================
-- Migration: 022_create_cheer_system
-- Creates cheer_types (seeded), cheers, and player_cheer_stats
-- tables with RLS policies and aggregation trigger.
-- =============================================================

-- ---------------------------------------------------------------------------
-- cheer_types: predefined catalog
-- ---------------------------------------------------------------------------
CREATE TABLE public.cheer_types (
  id        UUID    NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  slug      TEXT    NOT NULL UNIQUE,
  name      TEXT    NOT NULL,
  emoji     TEXT    NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true
);

ALTER TABLE public.cheer_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cheer_types: read all authenticated"
  ON public.cheer_types FOR SELECT
  TO authenticated
  USING (true);

GRANT SELECT ON public.cheer_types TO authenticated;

-- Seed the 5 predefined cheer types
INSERT INTO public.cheer_types (slug, name, emoji) VALUES
  ('offense',    'Offense',    '⚔️'),
  ('defense',    'Defense',    '🛡️'),
  ('technique',  'Technique',  '🎯'),
  ('movement',   'Movement',   '💨'),
  ('good_sport', 'Good Sport', '🤝');

-- ---------------------------------------------------------------------------
-- cheers: peer-to-peer awards
-- ---------------------------------------------------------------------------
CREATE TABLE public.cheers (
  id            UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID        NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  giver_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id   UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cheer_type_id UUID        NOT NULL REFERENCES public.cheer_types(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, giver_id, receiver_id),
  CHECK (giver_id <> receiver_id)
);

ALTER TABLE public.cheers ENABLE ROW LEVEL SECURITY;

-- Read: any authenticated user (needed for session cheer summaries + leaderboard)
CREATE POLICY "cheers: read all authenticated"
  ON public.cheers FOR SELECT
  TO authenticated
  USING (true);

-- Insert: giver must be auth.uid(), session must be complete + within 24hr window,
-- both giver and receiver must be registered session participants
CREATE POLICY "cheers: insert own"
  ON public.cheers FOR INSERT
  TO authenticated
  WITH CHECK (
    giver_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = session_id
        AND s.status = 'complete'
        AND s.completed_at IS NOT NULL
        AND s.completed_at + interval '24 hours' > now()
    )
    AND EXISTS (
      SELECT 1 FROM public.session_registrations
      WHERE session_id = cheers.session_id AND player_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.session_registrations
      WHERE session_id = cheers.session_id AND player_id = receiver_id
    )
  );

GRANT SELECT, INSERT ON public.cheers TO authenticated;

-- ---------------------------------------------------------------------------
-- player_cheer_stats: all-time aggregated counts per player
-- ---------------------------------------------------------------------------
CREATE TABLE public.player_cheer_stats (
  player_id           UUID        NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  cheers_received     INT         NOT NULL DEFAULT 0,
  cheers_given        INT         NOT NULL DEFAULT 0,
  offense_received    INT         NOT NULL DEFAULT 0,
  defense_received    INT         NOT NULL DEFAULT 0,
  technique_received  INT         NOT NULL DEFAULT 0,
  movement_received   INT         NOT NULL DEFAULT 0,
  good_sport_received INT         NOT NULL DEFAULT 0,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.player_cheer_stats ENABLE ROW LEVEL SECURITY;

-- Readable by all authenticated users (for profile + leaderboard)
CREATE POLICY "player_cheer_stats: read all authenticated"
  ON public.player_cheer_stats FOR SELECT
  TO authenticated
  USING (true);

-- Writes go through SECURITY DEFINER trigger only
GRANT SELECT ON public.player_cheer_stats TO authenticated;

-- ---------------------------------------------------------------------------
-- Trigger: update player_cheer_stats on cheer INSERT
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_cheer_stats_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slug TEXT;
BEGIN
  SELECT slug INTO v_slug FROM public.cheer_types WHERE id = NEW.cheer_type_id;

  -- Update giver's given count
  INSERT INTO public.player_cheer_stats (player_id, cheers_given)
  VALUES (NEW.giver_id, 1)
  ON CONFLICT (player_id) DO UPDATE SET
    cheers_given = player_cheer_stats.cheers_given + 1,
    updated_at   = now();

  -- Update receiver's received count + type-specific column
  INSERT INTO public.player_cheer_stats (
    player_id, cheers_received,
    offense_received, defense_received, technique_received,
    movement_received, good_sport_received
  )
  VALUES (
    NEW.receiver_id, 1,
    CASE WHEN v_slug = 'offense'    THEN 1 ELSE 0 END,
    CASE WHEN v_slug = 'defense'    THEN 1 ELSE 0 END,
    CASE WHEN v_slug = 'technique'  THEN 1 ELSE 0 END,
    CASE WHEN v_slug = 'movement'   THEN 1 ELSE 0 END,
    CASE WHEN v_slug = 'good_sport' THEN 1 ELSE 0 END
  )
  ON CONFLICT (player_id) DO UPDATE SET
    cheers_received     = player_cheer_stats.cheers_received + 1,
    offense_received    = player_cheer_stats.offense_received    + EXCLUDED.offense_received,
    defense_received    = player_cheer_stats.defense_received    + EXCLUDED.defense_received,
    technique_received  = player_cheer_stats.technique_received  + EXCLUDED.technique_received,
    movement_received   = player_cheer_stats.movement_received   + EXCLUDED.movement_received,
    good_sport_received = player_cheer_stats.good_sport_received + EXCLUDED.good_sport_received,
    updated_at          = now();

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_cheer_insert
  AFTER INSERT ON public.cheers
  FOR EACH ROW EXECUTE FUNCTION public.update_cheer_stats_on_insert();
