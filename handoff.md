# Handoff — current snapshot

Updated: 2026-09-30. Overwrite this file on every update; it is never a running history.

## State

- **"Who's going" row (option B)** is live on `/sessions` open-registration cards: faces + "9 of 14 going", which expands into name chips. It replaced the separate count line and the first-draft "See who's going" toggle.
- `dev` and `main` pushed at session end.
- Build (`tsc -b`), lint and all 376 unit tests pass.
- Left uncommitted on purpose: `badminton-v2/supabase/.temp/cli-latest` (CLI's own cache file).

## Done this session

- Two POC rounds in `temporary_files/`; user picked B from `whos-going-declutter-options.html`.
- `usePlayerSessions` loads `registrants` per open session (`buildRegistrantsBySession`, tested); `MySessionsView` has `RegistrantsRow` and `registrantsCountLabel` (tested).
- Lessons added to `CLAUDE.md` (window-global names in POC scripts, load bencium before UI work, theme colour on the wrapper) and `tasks/lessons.md`.

## Verified, and how

- Playwright against the dev app as Admin at 390 px, dark mode. `sessions` responses were rewritten closed → open in the browser only (no data changed). No page errors; the old count line was gone; the row and the admin button were both at y = 309.5, 44 px tall; the list opened in place with 14 names, "You" first.
- Not seen live: "N of M going" and "spots left", because the dev session has no limit. Covered by unit tests only.

## Immediate next steps

- Check on a phone against a real prod session that has a max.
- The list only refreshes when *your own* registration changes (same as the old count). Others' sign-ups show on reload.

## Open questions

- Carried over: prod migration history out of sync (never `db push` to prod); CLI was logged into a foreign account (`inkphantom123456@gmail.com`); `TodayView` old board; confetti per-frame speed; no UI for abandoning a game; `temp/` at repo root unresolved.
