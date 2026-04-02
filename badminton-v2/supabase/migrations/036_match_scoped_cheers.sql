-- Migration 036: Match-Scoped Cheers Redesign
--
-- Changes cheers from session-scoped (given after session ends within 24hr window)
-- to match-scoped (given immediately after each match completes, gates schedule view).
--
-- Removes: multiplier, 24hr window RLS policy
-- Adds: match_id FK, per-match unique constraint, match-scoped RLS

-- 1. Add match_id column
ALTER TABLE public.cheers ADD COLUMN match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE;

-- 2. Drop old unique constraint (session_id, giver_id, receiver_id)
ALTER TABLE public.cheers DROP CONSTRAINT IF EXISTS cheers_session_id_giver_id_receiver_id_key;

-- 3. Add new unique constraint
ALTER TABLE public.cheers ADD CONSTRAINT cheers_match_giver_receiver_unique
  UNIQUE (match_id, giver_id, receiver_id);

-- 4. Drop multiplier column
ALTER TABLE public.cheers DROP COLUMN IF EXISTS multiplier;

-- 5. Drop old RLS INSERT policy (session-scoped 24hr window)
DROP POLICY IF EXISTS "cheers: authenticated insert" ON public.cheers;

-- 6. New RLS INSERT policy (match-scoped)
CREATE POLICY "cheers: match-scoped insert" ON public.cheers
  FOR INSERT TO authenticated
  WITH CHECK (
    giver_id = auth.uid()
    AND match_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_id
        AND m.status = 'complete'
        AND (
          m.team1_player1_id = auth.uid() OR m.team1_player2_id = auth.uid()
          OR m.team2_player1_id = auth.uid() OR m.team2_player2_id = auth.uid()
        )
    )
    AND EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_id
        AND (
          m.team1_player1_id = receiver_id OR m.team1_player2_id = receiver_id
          OR m.team2_player1_id = receiver_id OR m.team2_player2_id = receiver_id
        )
    )
  );

-- 7. Create index for query performance
CREATE INDEX IF NOT EXISTS idx_cheers_match_id ON public.cheers(match_id);
CREATE INDEX IF NOT EXISTS idx_cheers_giver_match ON public.cheers(giver_id, match_id);

-- 8. Replace trigger: remove multiplier, just +1
CREATE OR REPLACE FUNCTION update_cheer_stats_on_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_slug TEXT;
BEGIN
  SELECT slug INTO v_slug FROM public.cheer_types WHERE id = NEW.cheer_type_id;

  -- Upsert giver stats
  INSERT INTO public.player_cheer_stats (player_id, cheers_given)
  VALUES (NEW.giver_id, 1)
  ON CONFLICT (player_id)
  DO UPDATE SET cheers_given = player_cheer_stats.cheers_given + 1,
                updated_at = now();

  -- Upsert receiver stats
  INSERT INTO public.player_cheer_stats (
    player_id, cheers_received,
    offense_received, defense_received, technique_received,
    movement_received, good_sport_received, solid_effort_received
  ) VALUES (
    NEW.receiver_id, 1,
    CASE WHEN v_slug = 'offense' THEN 1 ELSE 0 END,
    CASE WHEN v_slug = 'defense' THEN 1 ELSE 0 END,
    CASE WHEN v_slug = 'technique' THEN 1 ELSE 0 END,
    CASE WHEN v_slug = 'movement' THEN 1 ELSE 0 END,
    CASE WHEN v_slug = 'good_sport' THEN 1 ELSE 0 END,
    CASE WHEN v_slug = 'solid_effort' THEN 1 ELSE 0 END
  )
  ON CONFLICT (player_id)
  DO UPDATE SET
    cheers_received = player_cheer_stats.cheers_received + 1,
    offense_received = player_cheer_stats.offense_received + CASE WHEN v_slug = 'offense' THEN 1 ELSE 0 END,
    defense_received = player_cheer_stats.defense_received + CASE WHEN v_slug = 'defense' THEN 1 ELSE 0 END,
    technique_received = player_cheer_stats.technique_received + CASE WHEN v_slug = 'technique' THEN 1 ELSE 0 END,
    movement_received = player_cheer_stats.movement_received + CASE WHEN v_slug = 'movement' THEN 1 ELSE 0 END,
    good_sport_received = player_cheer_stats.good_sport_received + CASE WHEN v_slug = 'good_sport' THEN 1 ELSE 0 END,
    solid_effort_received = player_cheer_stats.solid_effort_received + CASE WHEN v_slug = 'solid_effort' THEN 1 ELSE 0 END,
    updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
