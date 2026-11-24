-- =============================================================
-- Migration 094: players who don't give cheers (Neon only)
--
-- Owner, 2026-11-24: a one-time substitute's login (work-work / "workislife99", a moderator already
-- marked is_guest) kept being asked to cheer. The owner chose a per-account switch, not a rule for
-- every guest. Managed on Settings → Cheers ("No cheers"), same shape and rules as
-- cheer_later_players (084): admins manage the list, a player can read only their own row so the app
-- can skip the cheer screen for them.
--
-- Only the asking stops. Cheers the player already gave stay; other players in their games are still
-- asked to cheer them (the "cheer the other three" rule is unchanged for everyone else).
-- =============================================================

CREATE TABLE public.no_cheer_players (
  player_id UUID        PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  added_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  added_by  UUID        REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE public.no_cheer_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "no_cheer_players: admin all"
  ON public.no_cheer_players
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "no_cheer_players: read own row"
  ON public.no_cheer_players
  FOR SELECT
  TO authenticated
  USING (player_id = auth.uid());

GRANT SELECT, INSERT, DELETE ON public.no_cheer_players TO authenticated;
