# Handoff — current snapshot

Updated: 2026-11-23 Manila. Overwrite this file on every update; it is never a running history.

## Done this session
- Season reset built on branch `claude/094-season-reset-ab612d` (commits a99010e..a2a4d10 plus docs). **Not merged, not deployed.**
  - Seasons 2026 / 2027 in `lib/season.ts`; every board and profile number tallied at read time from raw rows.
  - Counter tables unread (one exception: gallery access gate). Per-season floors, 12-month window.
  - Leaderboard season switcher, between-seasons card, My Profile season-only, "Your 2026 season" page, celebration rollover, badge hold.
  - Owner rulings: game-less completed session (Nov 22 Xmas Party) ignored everywhere; parity check skipped.
- Docs updated: `project_memory.md` Leaderboards, `badminton-v2/docs/qa-log.html`, `specs/009-season-reset/design.md`, `tasks/lessons.md`.

## Current state
- Verified: 700 unit tests passing; live check on Neon dev (2026-11-23) covering all tabs x seasons, error state, between-seasons card, light theme, My Profile + year page as test player Dana.
- NOT verified: parity vs the old counters (8 players ±1 win; March cheers weighted 6,249 vs counter 6,243) — skipped by the owner, so the new code never re-measured them.
- Neon dev has test cheers given as Dana; reset with `scripts/neon/seed-dev.sql` if needed.
- Supabase DEV looked paused earlier (Dev Login fails on localhost) — unclear if still true.
- Unrelated untracked files left alone: `badminton-v2/5`, `badminton-v2/docs/lessons.md`, `supabase/.temp/cli-latest`.

## Next steps
1. Owner reviews the branch.
2. Merge into `dev`, then deploy. On deploy the live boards switch to "The 2027 season starts with the {next} session" until the next played session.
3. Owner: close the Xmas Party session when photos are in; resume Supabase DEV if localhost testing is needed.

## Open questions
- Parked from the build: the 2026 card reads the 2026 window on every profile open; mid-session games show before the session counts as attended; TodayView season baseline is not refreshed live; Early Bird caption doesn't say "past 12 months".
- Run the parity check after all? Owner's call.
- Offered, not decided: treat Supabase 500/52x token-refresh errors as retryable so a brief outage doesn't sign players out.
- Carried over: iPhone Safari WebP untested on a real phone; kiosk insert rule; offline-backup phone check; Broadcast/share on phones; Nov 1 session not closed; prod `service_role` key not rotated; old Neon test branches cleanup (owner: maybe later).
