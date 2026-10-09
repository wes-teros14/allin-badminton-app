-- =============================================================
-- Migration: 086_session_finance_notes
-- A free-text note on the admin's "Your Share" deduction for a session,
-- e.g. "Court booking 300 + 1 tube of shuttles", so the number on the
-- Finance page says what it was for.
--
-- Its own table, not a column on sessions: every column of sessions is
-- readable by anyone with the public key (migration 002, anon +
-- authenticated, USING (true)), and a column-level REVOKE does nothing
-- against that table-wide grant. Admin-only RLS here, like
-- payment_exempt_players (082).
--
-- The amount itself stays in sessions.personal_share_override, which
-- get_session_finance subtracts from profit. The note never touches the
-- maths, so that function is unchanged.
-- =============================================================

CREATE TABLE public.session_finance_notes (
  session_id          UUID        PRIMARY KEY REFERENCES public.sessions(id) ON DELETE CASCADE,
  personal_share_note TEXT        NOT NULL CHECK (char_length(personal_share_note) BETWEEN 1 AND 500),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.session_finance_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "session_finance_notes: admin all"
  ON public.session_finance_notes
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_finance_notes TO authenticated;
