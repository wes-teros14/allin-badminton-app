-- =============================================================
-- Migration: 027_revert_cheers_given_count
-- Reverts 026: cheers_given should also be multiplied to stay
-- balanced with cheers_received (what you give = what they get).
-- =============================================================

-- Restore original trigger: both sides use multiplier
CREATE OR REPLACE FUNCTION public.update_cheer_stats_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slug TEXT;
  v_mult INT;
BEGIN
  SELECT slug INTO v_slug FROM public.cheer_types WHERE id = NEW.cheer_type_id;
  v_mult := COALESCE(NEW.multiplier, 1);

  -- Giver's given count weighted by multiplier (balances receiver's received count)
  INSERT INTO public.player_cheer_stats (player_id, cheers_given)
  VALUES (NEW.giver_id, v_mult)
  ON CONFLICT (player_id) DO UPDATE SET
    cheers_given = player_cheer_stats.cheers_given + v_mult,
    updated_at   = now();

  -- Receiver's counts weighted by multiplier
  INSERT INTO public.player_cheer_stats (
    player_id, cheers_received,
    offense_received, defense_received, technique_received,
    movement_received, good_sport_received
  )
  VALUES (
    NEW.receiver_id, v_mult,
    CASE WHEN v_slug = 'offense'    THEN v_mult ELSE 0 END,
    CASE WHEN v_slug = 'defense'    THEN v_mult ELSE 0 END,
    CASE WHEN v_slug = 'technique'  THEN v_mult ELSE 0 END,
    CASE WHEN v_slug = 'movement'   THEN v_mult ELSE 0 END,
    CASE WHEN v_slug = 'good_sport' THEN v_mult ELSE 0 END
  )
  ON CONFLICT (player_id) DO UPDATE SET
    cheers_received     = player_cheer_stats.cheers_received     + v_mult,
    offense_received    = player_cheer_stats.offense_received    + EXCLUDED.offense_received,
    defense_received    = player_cheer_stats.defense_received    + EXCLUDED.defense_received,
    technique_received  = player_cheer_stats.technique_received  + EXCLUDED.technique_received,
    movement_received   = player_cheer_stats.movement_received   + EXCLUDED.movement_received,
    good_sport_received = player_cheer_stats.good_sport_received + EXCLUDED.good_sport_received,
    updated_at          = now();

  RETURN NEW;
END;
$$;

-- Recalculate cheers_given back to multiplied values
UPDATE public.player_cheer_stats pcs
SET
  cheers_given = (
    SELECT COALESCE(SUM(multiplier), 0)
    FROM public.cheers
    WHERE giver_id = pcs.player_id
  ),
  updated_at = now();
