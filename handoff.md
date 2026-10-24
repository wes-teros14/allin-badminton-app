# Handoff — current snapshot

Updated: 2026-10-24. Overwrite this file on every update; it is never a running history.

## State

- **Guest accounts** (branch `038-guest-accounts`, pushed to `dev` and `main` 2026-10-23): `profiles.is_guest` with a Guest toggle on the Players page; guests kept off every all-time board/award/badge; Wins board now uses the shared gate. Migration 087 **applied on prod** (1 guest flagged: nickname "Kel", 1 session). Migration 087 also on **dev** (pasted by the owner, 2026-10-24). 459 tests pass.
- **No-fee banner flash fixed**, pushed to `dev` and `main` (2026-10-23).
- **Early Bird now ranks average points per session**, min. 8 self-registered sessions (branch `036-early-bird-average`, pushed to `dev` and `main`). Expected prod top 5: Anthony 3.69, Ronwald 3.45, AJ 2.29, Jax 2.25, Len 1.73. 456 tests pass.
- **Win Streak now ranks the best run ever** (branch `035-win-streak-best`, pushed to `dev` and `main`): was the current run. Expected prod top 5: 18, 9, 7, 7, 6, 6. 453 tests pass.
- Pushed to `dev` and `main` this session:
  - **Your Share note** (Finance): "What it was for" text; migration 086 `session_finance_notes` (admin-only) on **prod and dev** (dev pasted by the owner, 2026-10-11).
  - **Download offline backup**: last button on the admin session page (locked + live; moderators too). Moderator copy (no levels) / admin copy (levels).
  - **Court preview fix**: before the first game, courts show Game 1 / Game 2 (was Game 1 twice). Confirmed by the owner on prod.
  - **My Games rows** look like All Games rows (you + partner vs opponents, 4 faces).
- `tsc -b`, build, 456 unit tests pass. Lint: no errors in changed files.
- Left uncommitted on purpose: `badminton-v2/supabase/.temp/cli-latest`.

## Verified, and how

- Dev via Playwright as Admin at 390 px, both themes: backup button + both copies; Game 2/Game 3 previews on a locked session; My Games rows with 4 faces. No page errors.
- 086 RLS on prod in a rolled-back block: admin reads/writes; player sees 0, cannot write; anon cannot read.

## Not verified

- Offline backup opened on a real Android phone (owner to try: Files → Downloads → open with Chrome); moderator account; a live session.
- The note inside the Net Cash Summary (dev session has no costs).

## Immediate next steps

- **Today (Oct 11) is a session day:** restart prod 15–30 min before 2 PM; check Subs on prod once as admin; download an offline backup once the schedule is locked and try it on the phone.
- After tonight: compare edge-log requests per 30 min with Oct 4 (~2,300–4,200; target ≤ half).

## Open questions

- Carried over: Clean Sweep parked; load reduction enough?; prod migration history out of sync (never `db push` to prod); `TodayView` old board; confetti per-frame speed; no UI for abandoning a game; `temp/` at repo root; prod `service_role` key not rotated.
