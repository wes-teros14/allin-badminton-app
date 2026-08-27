-- =============================================================
-- MAINTENANCE — payment receipt storage cleanup
--
-- ⚠️  THIS IS NOT A MIGRATION. Never move this file into
--     supabase/migrations/. Everything in that folder gets applied
--     automatically against any database, and the DELETE statements
--     below would eventually run somewhere you did not intend.
--
-- Run these by hand in Supabase Dashboard → SQL Editor, or save them
-- as snippets there. The canonical copy lives here in git.
--
-- ---------------------------------------------------------------
-- READ THIS FIRST — why cleanup takes two steps
-- ---------------------------------------------------------------
-- A receipt exists in TWO places:
--   1. the image file, in the `receipts` storage bucket
--   2. a row in public.session_receipts holding the note, the
--      timestamp, and storage_path — the only record of where the
--      image lives
--
-- SQL can reliably delete (2) but NOT (1). Deleting from
-- storage.objects removes the metadata row and leaves the physical
-- file behind in the backing store — untracked rather than
-- reclaimed, with no error to tell you. There is no SQL function
-- that deletes the real object.
--
-- So the order is always:
--   step 1 → query E to get the paths
--   step 2 → delete those paths in Dashboard → Storage → receipts
--   step 3 → query F to delete the matching rows
--
-- Between steps 2 and 3 the app will show receipts whose image is
-- gone. That window is expected; query G finds anything left behind
-- if you get interrupted.
--
-- ---------------------------------------------------------------
-- What is safe to delete
-- ---------------------------------------------------------------
-- Deleting a receipt does NOT delete the payment record. Who paid
-- lives in session_registrations.paid, a boolean on a different
-- table that none of this touches. Finance totals, history and the
-- paid/unpaid state are all unaffected — you lose the photo, not
-- the fact.
-- =============================================================


-- =============================================================
-- A. INVENTORY — every receipt, in readable terms
--
-- The Storage browser shows folders named
-- {player_id}/{session_id}/{receipt_id}.jpg — all UUIDs, so you
-- cannot tell what you are looking at there. This maps them to
-- session names and players.
--
-- image_size NULL means the file is already gone but the row
-- remains (see G).
-- =============================================================
SELECT s.name                                   AS session,
       s.date,
       s.status,
       COALESCE(p.nickname, p.name_slug)        AS player,
       r.note,
       r.uploaded_at,
       r.dismissed_at,
       pg_size_pretty((o.metadata->>'size')::BIGINT) AS image_size,
       r.storage_path
FROM   public.session_receipts r
JOIN   public.sessions  s ON s.id = r.session_id
JOIN   public.profiles  p ON p.id = r.player_id
LEFT   JOIN storage.objects o
       ON o.bucket_id = 'receipts' AND o.name = r.storage_path
ORDER  BY s.date DESC, player;


-- =============================================================
-- B. TOTAL USAGE — how much the bucket is actually holding
-- =============================================================
SELECT COUNT(*)                                        AS files,
       pg_size_pretty(SUM((metadata->>'size')::BIGINT)) AS total_size
FROM   storage.objects
WHERE  bucket_id = 'receipts';


-- =============================================================
-- C. USAGE BY SESSION — what each session is costing you
-- =============================================================
SELECT s.id                                            AS session_id,
       s.name                                          AS session,
       s.date,
       s.status,
       COUNT(r.id)                                     AS receipts,
       pg_size_pretty(COALESCE(SUM((o.metadata->>'size')::BIGINT), 0)) AS size
FROM   public.sessions s
JOIN   public.session_receipts r ON r.session_id = s.id
LEFT   JOIN storage.objects o
       ON o.bucket_id = 'receipts' AND o.name = r.storage_path
GROUP  BY s.id, s.name, s.date, s.status
ORDER  BY s.date DESC;


-- =============================================================
-- D. CLEANUP CANDIDATES — completed sessions older than 6 months
--
-- Adjust the interval to taste. Six months covers any realistic
-- payment dispute; nobody queries a July session the following
-- March. Only `complete` sessions are listed, so an active or
-- upcoming session can never appear here.
-- =============================================================
SELECT s.id                                            AS session_id,
       s.name                                          AS session,
       s.date,
       COUNT(r.id)                                     AS receipts,
       pg_size_pretty(COALESCE(SUM((o.metadata->>'size')::BIGINT), 0)) AS reclaimable
FROM   public.sessions s
JOIN   public.session_receipts r ON r.session_id = s.id
LEFT   JOIN storage.objects o
       ON o.bucket_id = 'receipts' AND o.name = r.storage_path
WHERE  s.status = 'complete'
  AND  s.date < CURRENT_DATE - INTERVAL '6 months'
GROUP  BY s.id, s.name, s.date
ORDER  BY s.date;


-- =============================================================
-- E. STEP 1 — paths to delete for ONE session
--
-- Replace the UUID with a session_id from C or D, run it, then copy
-- the results into Dashboard → Storage → receipts and delete those
-- files. Do this BEFORE running F.
-- =============================================================
SELECT r.storage_path
FROM   public.session_receipts r
WHERE  r.session_id = '00000000-0000-0000-0000-000000000000'  -- ← session_id here
ORDER  BY r.storage_path;


-- =============================================================
-- F. STEP 3 — delete the rows, AFTER the files are gone
--
-- Scoped to one session on purpose. There is deliberately no
-- "delete everything" statement in this file: a bare
-- DELETE FROM session_receipts is one stray click away from wiping
-- every receipt you have, including this week's unconfirmed ones.
--
-- Run E first and delete the files, or you will orphan them —
-- once these rows are gone, storage_path is gone with them and
-- nothing can tell you which files belonged to this session.
-- =============================================================
-- DELETE FROM public.session_receipts
-- WHERE  session_id = '00000000-0000-0000-0000-000000000000';  -- ← session_id here


-- =============================================================
-- G. HALF-DONE CLEANUP — rows whose image is already deleted
--
-- These render as broken thumbnails in the app and still count
-- toward a player's receipt total. Expected briefly between steps
-- 2 and 3; anything lingering here means a cleanup was interrupted.
-- Safe to delete — the file is already gone.
-- =============================================================
SELECT r.id                              AS receipt_id,
       s.name                            AS session,
       COALESCE(p.nickname, p.name_slug) AS player,
       r.uploaded_at,
       r.storage_path
FROM   public.session_receipts r
JOIN   public.sessions s ON s.id = r.session_id
JOIN   public.profiles p ON p.id = r.player_id
LEFT   JOIN storage.objects o
       ON o.bucket_id = 'receipts' AND o.name = r.storage_path
WHERE  o.id IS NULL
ORDER  BY r.uploaded_at;

-- Cleanup for the above (rows only — the files are already gone):
-- DELETE FROM public.session_receipts r
-- WHERE  NOT EXISTS (
--          SELECT 1 FROM storage.objects o
--          WHERE  o.bucket_id = 'receipts' AND o.name = r.storage_path
--        );


-- =============================================================
-- H. ORPHANED FILES — images no row points at
--
-- Pure waste: unreachable through the app and invisible to every
-- query above except this one. Delete these in Dashboard → Storage
-- → receipts. Always safe — "nothing references them" is a fact
-- here, not a judgement.
--
-- Should normally return zero rows. The app deletes the storage
-- object before the row at all three call sites (player deletes own,
-- admin removes a player from the roster, admin deletes a session),
-- so anything here means a delete failed halfway.
-- =============================================================
SELECT o.name                                       AS orphaned_file,
       pg_size_pretty((o.metadata->>'size')::BIGINT) AS size,
       o.created_at
FROM   storage.objects o
LEFT   JOIN public.session_receipts r ON r.storage_path = o.name
WHERE  o.bucket_id = 'receipts'
  AND  r.id IS NULL
ORDER  BY o.created_at;
