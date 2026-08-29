-- =============================================================
-- Migration: 075_create_session_receipts
-- Payment proof uploaded by a player for one session registration.
-- Append-only from the player's side; an admin may dismiss a receipt
-- but never edits its content.
--
-- IMPORTANT: this migration deliberately does NOT touch
-- session_registrations.paid, and does NOT recreate
-- get_session_finance. `paid` keeps its exact current meaning
-- (payment confirmed by an admin) and remains the sole input to
-- revenue. The new middle state ("awaiting confirmation" / orange)
-- is DERIVED in the client as `paid = false AND active receipts > 0`,
-- so no stored value can ever drift from `paid` and finance
-- arithmetic is untouched by construction.
--
-- Storage note: session_receipts rows cascade away with their parent
-- registration or session, but a DB cascade has no reach into
-- storage.objects. The application MUST delete the storage object
-- BEFORE the row at all three call sites (player deletes own,
-- admin removes a player from the roster, admin deletes a session),
-- because storage_path below is the only record of where the image
-- lives. See 076 for the bucket and its policies.
-- =============================================================

CREATE TABLE public.session_receipts (
  id              UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID        NOT NULL REFERENCES public.session_registrations(id) ON DELETE CASCADE,
  session_id      UUID        NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  player_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path    TEXT        NOT NULL,
  note            TEXT        NULL,
  uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  dismissed_at    TIMESTAMPTZ NULL,
  dismissed_by    UUID        NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT session_receipts_note_length CHECK (note IS NULL OR char_length(note) <= 140)
);

-- ---------------------------------------------------------------
-- Indexes
--   session            -> admin payment panel fetch + session cleanup
--   player + session   -> player's own receipts on their session card
--   registration       -> cascade performance + roster-removal cleanup
-- ---------------------------------------------------------------
CREATE INDEX idx_session_receipts_session
  ON public.session_receipts (session_id);

CREATE INDEX idx_session_receipts_player_session
  ON public.session_receipts (player_id, session_id);

CREATE INDEX idx_session_receipts_registration
  ON public.session_receipts (registration_id);

ALTER TABLE public.session_receipts ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------
-- RLS
--
-- Receipts are financial screenshots, so read access is deliberately
-- narrower than any other table in this schema: a player sees only
-- their own, an admin sees all, and MODERATORS MATCH NO POLICY.
-- That last point is the actual enforcement of admin-only review --
-- AdminRoute (src/App.tsx:28) admits moderators to /finance, so the
-- screen-level guard cannot be relied upon.
-- ---------------------------------------------------------------

CREATE POLICY "session_receipts: players read own"
  ON public.session_receipts FOR SELECT
  TO authenticated
  USING (player_id = auth.uid());

CREATE POLICY "session_receipts: admin read all"
  ON public.session_receipts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- The parent-registration `paid = false` subquery is load-bearing, not
-- decorative: it is evaluated at write time, so it is the only thing
-- that stops a player whose upload form was opened BEFORE an admin
-- confirmed their payment from writing a receipt AFTER confirmation.
CREATE POLICY "session_receipts: players insert own while unconfirmed"
  ON public.session_receipts FOR INSERT
  TO authenticated
  WITH CHECK (
    player_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.session_registrations sr
      WHERE sr.id = registration_id
        AND sr.player_id = auth.uid()
        AND sr.paid = false
    )
  );

CREATE POLICY "session_receipts: players delete own while unconfirmed"
  ON public.session_receipts FOR DELETE
  TO authenticated
  USING (
    player_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.session_registrations sr
      WHERE sr.id = registration_id
        AND sr.player_id = auth.uid()
        AND sr.paid = false
    )
  );

-- Admins dismiss (set dismissed_at / dismissed_by); they never edit
-- content. There is deliberately NO admin DELETE policy on this table:
-- confirmed receipts are the session's audit trail and must be
-- retained, so row removal happens only by cascade when the parent
-- registration or session is deleted. The admin DELETE policy on the
-- *bucket* (076) is a separate matter and IS required, since an admin
-- removing a player or a session must remove that player's image files.
CREATE POLICY "session_receipts: admin dismiss"
  ON public.session_receipts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS policies do not grant table privileges; both are required.
-- UPDATE is granted for the admin dismissal policy above.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_receipts TO authenticated;
