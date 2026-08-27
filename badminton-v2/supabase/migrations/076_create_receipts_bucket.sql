-- =============================================================
-- Migration: 076_create_receipts_bucket
-- Private storage bucket for payment receipt images.
--
-- THIS IS THE FIRST PRIVATE BUCKET IN THIS SCHEMA. The existing
-- buckets -- `avatars` (069) and `payment-qr` (073) -- are both
-- public = true, so every upload example in this codebase ends with
-- getPublicUrl(). That call is WRONG here: on a private bucket it
-- returns an address that resolves to nothing, and it fails silently
-- rather than throwing. Reads must use createSignedUrl(path, 60),
-- minted at view time from the caller's own JWT (no service-role key
-- is involved, and none may be committed).
--
-- Path layout: {player_id}/{session_id}/{receipt_id}.jpg
-- player_id leads so the ownership predicate stays identical to the
-- one established in 069: (storage.foldername(name))[1] = auth.uid()
-- =============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', false)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------
-- Storage RLS
--
-- Note there is NO public-read policy. That single omission, plus
-- public = false above, is the entire privacy model for this feature.
-- ---------------------------------------------------------------

CREATE POLICY "receipts: owner or admin read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'receipts'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    )
  );

-- Players upload only under their own path. Admins deliberately cannot
-- upload here: uploading a receipt on a player's behalf is out of scope.
CREATE POLICY "receipts: players upload own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- The admin arm of this policy is REQUIRED, not incidental. Two of the
-- three cleanup call sites have an admin deleting ANOTHER player's
-- image files: removing a player from the roster (useRoster.removePlayer)
-- and deleting a session (AdminView). Without it, both leave the images
-- stranded in the bucket -- silently, with no error and no failing test.
CREATE POLICY "receipts: owner or admin delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'receipts'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    )
  );

-- No UPDATE policy: objects are immutable. A correction is a new
-- receipt plus a delete, never an overwrite -- which is also why the
-- client uploads without `upsert`, so an interrupted retry can never
-- clobber an existing receipt.
