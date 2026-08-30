-- =============================================================
-- Migration: 079_matches_distinct_players
-- A match is 2v2, so the four player slots must hold four different players.
-- Nothing enforced that until now: the two manual edit forms (admin court view
-- and generator panel) are four independent dropdowns over the whole roster,
-- so a mis-tap could save the same player into two slots. It happened in a
-- live session — one team showed as "Alexis & Alexis".
--
-- The generator itself cannot produce a repeat (it picks 4 distinct ids and its
-- SA mutation rejects any swap that would collide), so this closes the manual
-- paths and anything writing to the table from outside the app.
--
-- If this migration fails, a row already violates the rule. Run
-- supabase/maintenance/duplicate-match-players-scan.sql to find and fix it first.
-- =============================================================

DO $$
DECLARE
  v_offenders TEXT;
BEGIN
  SELECT string_agg(
           format('match %s (session %s, game %s)', id, session_id, queue_position),
           E'\n  '
         )
    INTO v_offenders
  FROM public.matches
  WHERE team1_player1_id IN (team1_player2_id, team2_player1_id, team2_player2_id)
     OR team1_player2_id IN (team2_player1_id, team2_player2_id)
     OR team2_player1_id = team2_player2_id;

  IF v_offenders IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot add matches_distinct_players_check — these matches repeat a player: %',
      E'\n  ' || v_offenders;
  END IF;
END $$;

ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_distinct_players_check;

ALTER TABLE public.matches
ADD CONSTRAINT matches_distinct_players_check CHECK (
  team1_player1_id <> team1_player2_id
  AND team1_player1_id <> team2_player1_id
  AND team1_player1_id <> team2_player2_id
  AND team1_player2_id <> team2_player1_id
  AND team1_player2_id <> team2_player2_id
  AND team2_player1_id <> team2_player2_id
);
