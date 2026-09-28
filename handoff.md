# Handoff — current snapshot

Updated: 2026-09-28. Overwrite this file on every update; it is never a running history.

## State

- `dev` and `main` pushed at session end with the payment-exempt feature.
- Migration 082 is on **both** databases: prod via the Supabase MCP tool (recorded as
  `20260928035840`), dev by the user in the SQL editor (not recorded in dev's history).
- Build (`tsc -b`), lint and all 371 unit tests pass.
- Left uncommitted on purpose: `badminton-v2/supabase/.temp/cli-latest` (CLI's own cache file).

## Done this session

- **Payment-exempt players**: Payment Settings → "Players who don't pay". Exempt players see a one-line
  "No fee"; admin Payment Status lists them last as "No fee"; Finance shows `paid / due · N no fee`.
  Revenue untouched. Design and rejected options in `project_memory.md` → Data conventions.
- POC: `temporary_files/payment-exempt-poc.html`.
- Card now shows a load error instead of "Nobody yet" when its query fails (lesson logged).
- Earlier in the session (already pushed): celebration ordering, summary cheer toast, session
  leaderboard on the shared `RankedBoard`.

## Verified, and how

- Prod: trigger behaviour tested in a rolled-back `DO` block (open session flipped, 0 of 11 completed
  sessions touched, self-insert overridden, removal reverted); confirmed 0 rows left behind.
- Dev, in the running app as Test Admin: add → flag flips on the open session only; session page,
  Payment Status panel and Finance all show the no-fee state; remove → reverts. Test Admin removed again.

## Immediate next steps

- On prod, add yourself (and anyone else who doesn't pay) on Payment Settings — the list starts empty.
- Dev's list currently holds **"Gab"**, added by the user during testing; leave or remove as intended.

## Open questions

- **Prod migration history is out of sync** (records only 001–050 + 082; schema has up to 081). Never
  `db push` to prod. Whether to repair the history table is undecided.
- **The CLI here was logged into a foreign account** (`inkphantom123456@gmail.com`). Worth checking where
  that login came from.
- Carried over: `TodayView` (`/today`, unlinked) still has the old board; confetti is per-frame
  (120 Hz phones run it ~2x fast); no UI for abandoning a game; `temp/` at repo root unresolved.
