-- =============================================================
-- Maintenance: abandon an unfinished match
--
-- Retires a game that was never finished — the night ran out of time, or the
-- court was given up mid-game. The match is marked 'complete' so it stops
-- sitting in the queue forever, but **no match_results row is written**, so it
-- has no winner and contributes nothing to anybody's stats.
--
-- Deliberately a plain UPDATE, not a function: it is a handful of rows, once,
-- and a statement you can read end to end leaves nothing behind in the schema.
--
-- Why "complete with no result" and not DELETE — see the note at the bottom.
-- The short version: deleting a match cascades its cheers away while
-- player_cheer_stats goes on counting them, and that has no cheap repair.
-- =============================================================


-- -------------------------------------------------------------------------
-- STEP 1 — Find the unfinished games. No session id needed.
--
-- Every match that is not complete, across the 5 most recent sessions, with
-- how many result rows and cheers hang off it. Copy the session_id of the row
-- you mean to fix into STEP 2.
--
-- What you want to see for an abandonable game: results = 0. If results > 0
-- the game DID get scored and this is not the right tool — see STEP 2's guard.
-- -------------------------------------------------------------------------

SELECT
  s.date,
  s.name,
  s.status AS session_status,
  m.session_id,
  m.queue_position,
  m.status AS match_status,
  m.court_number,
  m.started_at,
  (SELECT count(*) FROM public.match_results r WHERE r.match_id = m.id) AS results,
  (SELECT count(*) FROM public.cheers        c WHERE c.match_id = m.id) AS cheers
FROM public.matches m
JOIN public.sessions s ON s.id = m.session_id
WHERE m.session_id IN (
  SELECT id FROM public.sessions ORDER BY date DESC LIMIT 5
)
AND m.status <> 'complete'
ORDER BY s.date DESC, m.queue_position;


-- -------------------------------------------------------------------------
-- STEP 2 — Abandon them. Paste the session_id from STEP 1.
--
-- The two guards make this safe to run as-is and safe to run twice:
--   status <> 'complete'   — already-abandoned rows are skipped, not re-touched
--   NOT EXISTS (...)       — a match that already has a result is left alone
--                            entirely. Its stats are counted; stripping those
--                            is unfinish_match()'s job (migration 068), not
--                            this statement's.
--
-- Anything that does NOT come back in the RETURNING output was skipped by a
-- guard. If you expected two rows and got one, go back to STEP 1 and look at
-- why before forcing anything.
--
-- court_number and started_at are left as they are on purpose. If the game was
-- actually sent on and given up, that is true history worth keeping; if it was
-- never started, both are already NULL.
-- -------------------------------------------------------------------------

UPDATE public.matches m
SET status = 'complete'
WHERE m.session_id = '<SESSION_ID>'
  AND m.queue_position IN (23, 24)
  AND m.status <> 'complete'
  AND NOT EXISTS (
    SELECT 1 FROM public.match_results r WHERE r.match_id = m.id
  )
RETURNING m.queue_position, m.status, m.court_number;


-- -------------------------------------------------------------------------
-- STEP 3 — Confirm.
--
-- Re-run STEP 1. Games 23 and 24 should no longer appear at all — the query
-- only lists matches that are not complete.
--
-- Nothing else needs doing. player_stats and player_pair_stats are fed only by
-- the on_match_result_insert trigger (migration 013), and no result row was
-- inserted, so no leaderboard moved. If the session itself is still Live, tap
-- Finish Session on /session/<id> as normal.
-- -------------------------------------------------------------------------


-- =============================================================
-- Why not just DELETE the two matches?
--
-- 1. cheers.match_id is "REFERENCES public.matches(id) ON DELETE CASCADE"
--    (migration 036), but player_cheer_stats is maintained by an INSERT-only
--    trigger (migration 022) with no DELETE counterpart. Deleting a match
--    silently deletes its cheers while the six Cheers leaderboards go on
--    counting them. The two tables never agree again without a full recount of
--    player_cheer_stats from the cheers table.
--
-- 2. The game is gone from the schedule, so the four players in each deleted
--    match show three games where everyone else shows four, and the session
--    reads 22 matches rather than 24. The record stops matching what was
--    actually planned that night.
--
-- Abandoning costs neither. The row survives, so the schedule still reads 24;
-- getMatchOutcome() returns null, so MatchBoard prints the game in "All
-- results" as "A & B vs C & D" — "vs" instead of "beat", neither pair gilded —
-- and the personal list falls through OutcomeChip to a plain done-tick with no
-- Win/Loss/Draw chip.
--
-- One side effect, worth knowing rather than worth avoiding: the cheer INSERT
-- policy requires the match to be 'complete', so abandoning it opens cheering
-- on a game that was never played. That is the price of not leaving it queued,
-- where it would hang in the schedule forever reading as still-to-come.
--
-- If you ever do need the DELETE anyway, check the cheers count in STEP 1
-- first — at zero cheers the cascade has nothing to take and objection 1 does
-- not apply. Objection 2 still does.
-- =============================================================
