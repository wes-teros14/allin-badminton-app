-- =============================================================
-- Migration: 013_player_stats_tables
-- Creates player_stats and player_pair_stats tables with triggers
-- to keep stats updated in real-time as match results are recorded.
-- Stats survive session/match archiving since they live independently.
-- =============================================================

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE public.player_stats (
  player_id         UUID        NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  sessions_attended INT         NOT NULL DEFAULT 0,
  games_played      INT         NOT NULL DEFAULT 0,
  wins              INT         NOT NULL DEFAULT 0,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.player_pair_stats (
  player_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  other_player_id UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wins_together   INT         NOT NULL DEFAULT 0,
  losses_against  INT         NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, other_player_id),
  CHECK (player_id <> other_player_id)
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.player_stats      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_pair_stats ENABLE ROW LEVEL SECURITY;

-- Players read their own stats
CREATE POLICY "player_stats: read own"
  ON public.player_stats FOR SELECT
  TO authenticated
  USING (player_id = auth.uid());

CREATE POLICY "player_pair_stats: read own"
  ON public.player_pair_stats FOR SELECT
  TO authenticated
  USING (player_id = auth.uid());

-- Admins read all
CREATE POLICY "player_stats: admin read all"
  ON public.player_stats FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "player_pair_stats: admin read all"
  ON public.player_pair_stats FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Table-level grants (read only — writes go through SECURITY DEFINER triggers)
GRANT SELECT ON public.player_stats      TO authenticated;
GRANT SELECT ON public.player_pair_stats TO authenticated;

-- ---------------------------------------------------------------------------
-- Trigger: update stats when a match result is inserted
-- Fires on match_results INSERT (kiosk records winner)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_player_stats_on_result()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match RECORD;
  v_winner1 UUID;
  v_winner2 UUID;
  v_loser1  UUID;
  v_loser2  UUID;
BEGIN
  SELECT team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id
  INTO v_match
  FROM public.matches
  WHERE id = NEW.match_id;

  IF NEW.winning_pair_index = 1 THEN
    v_winner1 := v_match.team1_player1_id;
    v_winner2 := v_match.team1_player2_id;
    v_loser1  := v_match.team2_player1_id;
    v_loser2  := v_match.team2_player2_id;
  ELSE
    v_winner1 := v_match.team2_player1_id;
    v_winner2 := v_match.team2_player2_id;
    v_loser1  := v_match.team1_player1_id;
    v_loser2  := v_match.team1_player2_id;
  END IF;

  -- Update games_played + wins for all 4 players
  INSERT INTO public.player_stats (player_id, games_played, wins)
  VALUES
    (v_winner1, 1, 1),
    (v_winner2, 1, 1),
    (v_loser1,  1, 0),
    (v_loser2,  1, 0)
  ON CONFLICT (player_id) DO UPDATE SET
    games_played = player_stats.games_played + EXCLUDED.games_played,
    wins         = player_stats.wins         + EXCLUDED.wins,
    updated_at   = now();

  -- Update wins_together for the winning pair (both directions)
  INSERT INTO public.player_pair_stats (player_id, other_player_id, wins_together)
  VALUES
    (v_winner1, v_winner2, 1),
    (v_winner2, v_winner1, 1)
  ON CONFLICT (player_id, other_player_id) DO UPDATE SET
    wins_together = player_pair_stats.wins_together + 1,
    updated_at    = now();

  -- Update losses_against for each loser vs each winner (both losers, both winners)
  INSERT INTO public.player_pair_stats (player_id, other_player_id, losses_against)
  VALUES
    (v_loser1, v_winner1, 1),
    (v_loser1, v_winner2, 1),
    (v_loser2, v_winner1, 1),
    (v_loser2, v_winner2, 1)
  ON CONFLICT (player_id, other_player_id) DO UPDATE SET
    losses_against = player_pair_stats.losses_against + 1,
    updated_at     = now();

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_match_result_insert
  AFTER INSERT ON public.match_results
  FOR EACH ROW EXECUTE FUNCTION public.update_player_stats_on_result();

-- ---------------------------------------------------------------------------
-- Trigger: increment sessions_attended when a player registers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_sessions_attended_on_registration()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.player_stats (player_id, sessions_attended)
  VALUES (NEW.player_id, 1)
  ON CONFLICT (player_id) DO UPDATE SET
    sessions_attended = player_stats.sessions_attended + 1,
    updated_at        = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_session_registration_insert
  AFTER INSERT ON public.session_registrations
  FOR EACH ROW EXECUTE FUNCTION public.update_sessions_attended_on_registration();

-- ---------------------------------------------------------------------------
-- Backfill existing data
-- ---------------------------------------------------------------------------

-- Sessions attended
INSERT INTO public.player_stats (player_id, sessions_attended)
SELECT player_id, COUNT(*) AS sessions_attended
FROM public.session_registrations
GROUP BY player_id
ON CONFLICT (player_id) DO UPDATE SET
  sessions_attended = EXCLUDED.sessions_attended,
  updated_at        = now();

-- games_played + wins
WITH match_data AS (
  SELECT
    m.team1_player1_id, m.team1_player2_id,
    m.team2_player1_id, m.team2_player2_id,
    mr.winning_pair_index
  FROM public.matches m
  JOIN public.match_results mr ON mr.match_id = m.id
),
player_games AS (
  SELECT team1_player1_id AS player_id, 1 AS won FROM match_data WHERE winning_pair_index = 1
  UNION ALL
  SELECT team1_player2_id, 1 FROM match_data WHERE winning_pair_index = 1
  UNION ALL
  SELECT team2_player1_id, 1 FROM match_data WHERE winning_pair_index = 2
  UNION ALL
  SELECT team2_player2_id, 1 FROM match_data WHERE winning_pair_index = 2
  UNION ALL
  SELECT team2_player1_id, 0 FROM match_data WHERE winning_pair_index = 1
  UNION ALL
  SELECT team2_player2_id, 0 FROM match_data WHERE winning_pair_index = 1
  UNION ALL
  SELECT team1_player1_id, 0 FROM match_data WHERE winning_pair_index = 2
  UNION ALL
  SELECT team1_player2_id, 0 FROM match_data WHERE winning_pair_index = 2
)
INSERT INTO public.player_stats (player_id, games_played, wins)
SELECT player_id, COUNT(*) AS games_played, SUM(won) AS wins
FROM player_games
GROUP BY player_id
ON CONFLICT (player_id) DO UPDATE SET
  games_played = player_stats.games_played + EXCLUDED.games_played,
  wins         = player_stats.wins         + EXCLUDED.wins,
  updated_at   = now();

-- wins_together (both directions)
WITH match_data AS (
  SELECT
    m.team1_player1_id, m.team1_player2_id,
    m.team2_player1_id, m.team2_player2_id,
    mr.winning_pair_index
  FROM public.matches m
  JOIN public.match_results mr ON mr.match_id = m.id
),
winning_pairs AS (
  SELECT team1_player1_id AS w1, team1_player2_id AS w2 FROM match_data WHERE winning_pair_index = 1
  UNION ALL
  SELECT team2_player1_id, team2_player2_id FROM match_data WHERE winning_pair_index = 2
),
partner_wins AS (
  SELECT w1 AS player_id, w2 AS other_player_id FROM winning_pairs
  UNION ALL
  SELECT w2, w1 FROM winning_pairs
)
INSERT INTO public.player_pair_stats (player_id, other_player_id, wins_together)
SELECT player_id, other_player_id, COUNT(*) AS wins_together
FROM partner_wins
GROUP BY player_id, other_player_id
ON CONFLICT (player_id, other_player_id) DO UPDATE SET
  wins_together = EXCLUDED.wins_together,
  updated_at    = now();

-- losses_against
WITH match_data AS (
  SELECT
    m.team1_player1_id, m.team1_player2_id,
    m.team2_player1_id, m.team2_player2_id,
    mr.winning_pair_index
  FROM public.matches m
  JOIN public.match_results mr ON mr.match_id = m.id
),
loser_winner AS (
  -- pair2 lost to pair1
  SELECT team2_player1_id AS loser, team1_player1_id AS winner FROM match_data WHERE winning_pair_index = 1
  UNION ALL
  SELECT team2_player1_id, team1_player2_id FROM match_data WHERE winning_pair_index = 1
  UNION ALL
  SELECT team2_player2_id, team1_player1_id FROM match_data WHERE winning_pair_index = 1
  UNION ALL
  SELECT team2_player2_id, team1_player2_id FROM match_data WHERE winning_pair_index = 1
  -- pair1 lost to pair2
  UNION ALL
  SELECT team1_player1_id, team2_player1_id FROM match_data WHERE winning_pair_index = 2
  UNION ALL
  SELECT team1_player1_id, team2_player2_id FROM match_data WHERE winning_pair_index = 2
  UNION ALL
  SELECT team1_player2_id, team2_player1_id FROM match_data WHERE winning_pair_index = 2
  UNION ALL
  SELECT team1_player2_id, team2_player2_id FROM match_data WHERE winning_pair_index = 2
)
INSERT INTO public.player_pair_stats (player_id, other_player_id, losses_against)
SELECT loser AS player_id, winner AS other_player_id, COUNT(*) AS losses_against
FROM loser_winner
GROUP BY loser, winner
ON CONFLICT (player_id, other_player_id) DO UPDATE SET
  losses_against = player_pair_stats.losses_against + EXCLUDED.losses_against,
  updated_at     = now();
