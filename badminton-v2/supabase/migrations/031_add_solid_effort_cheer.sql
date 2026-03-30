-- =============================================================
-- Migration: 031_add_solid_effort_cheer
-- Adds 'Solid Effort' cheer type with stats tracking.
-- =============================================================

-- 1. Seed the new cheer type
INSERT INTO public.cheer_types (slug, name, emoji) VALUES
  ('solid_effort', 'Solid Effort', '💪');

-- 2. Add column to player_cheer_stats
ALTER TABLE public.player_cheer_stats
  ADD COLUMN solid_effort_received INT NOT NULL DEFAULT 0;

-- 3. Replace trigger function to include new slug
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
    movement_received, good_sport_received, solid_effort_received
  )
  VALUES (
    NEW.receiver_id, 1,
    CASE WHEN v_slug = 'offense'      THEN 1 ELSE 0 END,
    CASE WHEN v_slug = 'defense'      THEN 1 ELSE 0 END,
    CASE WHEN v_slug = 'technique'    THEN 1 ELSE 0 END,
    CASE WHEN v_slug = 'movement'     THEN 1 ELSE 0 END,
    CASE WHEN v_slug = 'good_sport'   THEN 1 ELSE 0 END,
    CASE WHEN v_slug = 'solid_effort' THEN 1 ELSE 0 END
  )
  ON CONFLICT (player_id) DO UPDATE SET
    cheers_received        = player_cheer_stats.cheers_received + 1,
    offense_received       = player_cheer_stats.offense_received       + EXCLUDED.offense_received,
    defense_received       = player_cheer_stats.defense_received       + EXCLUDED.defense_received,
    technique_received     = player_cheer_stats.technique_received     + EXCLUDED.technique_received,
    movement_received      = player_cheer_stats.movement_received      + EXCLUDED.movement_received,
    good_sport_received    = player_cheer_stats.good_sport_received    + EXCLUDED.good_sport_received,
    solid_effort_received  = player_cheer_stats.solid_effort_received  + EXCLUDED.solid_effort_received,
    updated_at             = now();

  RETURN NEW;
END;
$$;
