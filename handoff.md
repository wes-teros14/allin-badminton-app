# Handoff — current snapshot

Updated: 2026-10-09. Overwrite this file on every update; it is never a running history.

## State

- **Prod bug fixed, NOT pushed yet** (branch `032-court-next-preview`): before the first game, both court cards said "Next in queue — Game 1". Idle courts now preview Game 1, Game 2… in court order; busy courts still preview the queue head. Verified on dev; 451 tests pass.
- **Offline backup download** (branch `031-offline-backup`): pushed to `dev` and `main`.
  - Last button on the admin session page (locked and live; moderators too). Admin picks moderator copy (no levels) or admin copy (levels).
- `tsc -b`, build, 448 unit tests pass.
- **Your Share note** (branch `030-share-note`): pushed to `dev` and `main`.
  - Finance → Your Share: "What it was for" text box (max 500), saved with Save Share, cleared with Clear Share, shown under Your Share in the Net Cash Summary.
  - Migration 086 `session_finance_notes` (admin-only) is **on prod**; **not on dev** until the owner pastes `086_session_finance_notes.sql` into the dev SQL editor. Until then dev shows "Couldn't load your saved note".
  - RLS tested on prod in a rolled-back block: admin reads/writes; player sees 0 and cannot write; anon cannot read.
- **Ranked Subs panel + back-to-back fix** (branch `029-subs-ranking`): merged to `dev` and `main` (if the push step succeeded — see git log).
  - Who's out? → ranked list (★ picks → closest level → fewest games → most rest) with reasons and one-tap Sub in.
  - Migration 085 `sessions.sub_picks` applied to **dev and prod** via MCP (prod records a timestamp version, not 085).
- Branch `028-moderator-admin-tab` exists locally at dev's old commit with no commits; origin unclear. Not touched.
- `tsc -b`, build, 440 unit tests pass. Lint: 2 errors in `MatchGeneratorPanel.tsx:162` (`_pinnedGames`, `_wishlistStr` unused) — not from this change, already there.
- Left uncommitted on purpose: `badminton-v2/supabase/.temp/cli-latest`.

## Verified, and how

- Offline backup on dev (real app, Playwright as Admin, 390 px): button last after Unlock Schedule; sheet opens; admin copy 23 KB with levels and 20 games; moderator copy 0 levels, 20 games; toast names the file; the file opens on its own.
- Not seen: opening the file on a real Android phone (owner to try: Files → Downloads → open with Chrome), a moderator account, a live session.
- Share note on dev (table stood in for in the browser only): save → field keeps the 2-line note; reload → still there; Clear → empty, 1 upsert + 1 delete sent. The dev session's real share amount went 120 → cleared (null; it read 0 before, same effect in the maths).
- Not seen: the note inside the Net Cash Summary (the dev session has no shuttle/court cost, so the summary is hidden).
- Dev, in-app browser as Admin at 390 px: court-card panel ranked 3 subs; ★ saved and moved Neil to #1; 3rd star disabled with "Max 2 picks"; Sub in Steph for Cait updated Game 3; queued-game panel full width in light theme. No console errors.
- Dev data put back afterwards: Cait restored, picks cleared, session back to schedule_locked.
- Not seen: a moderator account's view (levels hidden, stars read-only) and anything on prod.

## Immediate next steps

- Before the next session: check Subs on prod once as admin.
- Clean Sweep is still parked (numbers in `project_memory.md`).
- Restart prod 15–30 min before the next session. Afterwards, compare edge-log requests per 30 min with Oct 4.

## Open questions

- The share *amount* (`sessions.personal_share_override`) is readable by anyone with the public key, like every `sessions` column. Move it into the admin-only table too?
- On 2 courts, when a court frees up, the game that starts could be the 1st *or* 2nd queued game; only the 1st is blocked (the rest tiebreak shows "next G…"). Owner agreed to the 1st only; revisit if a sub ends up back-to-back.
- Should the roster also show on locked / live / finished sessions? Unclear.
- Carried over: is the load reduction enough? Prod migration history out of sync (never `db push` to prod); `TodayView` old board; confetti per-frame speed; no UI for abandoning a game; `temp/` at repo root; prod `service_role` key not rotated.
