-- Migration: 084_cheer_later_players
-- Players whose cheers wait in a reminder bar instead of the full-page cheers
-- gate, managed on Settings → Cheers ("Cheer later"). Typically whoever runs the
-- night, who loses the Live page to the gate every time one of their own
-- matches is finished.
--
-- Cheering stays compulsory: the bar stays until every cheer is given. Only the
-- moment changes, so the cheer-share boards are unaffected.
-- =============================================================

CREATE TABLE public.cheer_later_players (
  player_id UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  added_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  added_by  UUID        REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.cheer_later_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cheer_later_players: admin all"
  ON public.cheer_later_players
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Unlike payment_exempt_players, the app has to ask "am I on the list?" from
-- the player's own session to decide between the bar and the gate. A player
-- sees only their own row, never the list.
CREATE POLICY "cheer_later_players: read own row"
  ON public.cheer_later_players
  FOR SELECT
  TO authenticated
  USING (player_id = auth.uid());

GRANT SELECT, INSERT, DELETE ON public.cheer_later_players TO authenticated;
