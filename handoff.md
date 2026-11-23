# Handoff — current snapshot

Updated: 2026-11-23 Manila. Overwrite this file on every update; it is never a running history.

## Done this session
- Season reset built on branch `claude/094-season-reset-ab612d`, merged into `dev` (99f1b15) and `main` (416df4b), both pushed. **Live:** Vercel Production deploy succeeded; badmintontayo.mrkws.com bundles contain the new season copy.
  - Final fixes: shared season reads, Today baseline excludes the active session, profile refresh debounced, 2026 card totals read once per visit.
  - Seasons 2026 / 2027 in `lib/season.ts`; every board and profile number tallied at read time from raw rows.
  - Counter tables unread (one exception: gallery access gate). Per-season floors, 12-month window.
  - Leaderboard season switcher, between-seasons card, My Profile season-only, "Your 2026 season" page, celebration rollover, badge hold.
  - Owner rulings: game-less completed session (Nov 22 Xmas Party) ignored everywhere; parity check skipped.
- Docs updated: `project_memory.md` Leaderboards, `badminton-v2/docs/qa-log.html`, `specs/009-season-reset/design.md`, `tasks/lessons.md`.

## Current state
- Verified: 714 unit tests + build passing on dev; live check on Neon dev (2026-11-23) covering all tabs x seasons, error state, between-seasons card, light theme, My Profile + year page as test player Dana.
- NOT verified: parity vs the old counters (8 players ±1 win; March cheers weighted 6,249 vs counter 6,243) — skipped by the owner, so the new code never re-measured them.
- Neon dev has test cheers given as Dana; reset with `scripts/neon/seed-dev.sql` if needed.
- Supabase DEV resumed by the owner 2026-11-23 (Dev Login works on localhost).
- Production right now: 2027 has no played session yet (Nov 22 had no games), so every board shows "The 2027 season starts with the {next} session" + a link to the 2026 standings.
- Unrelated untracked files left alone: `badminton-v2/5`, `badminton-v2/docs/lessons.md`, `supabase/.temp/cli-latest`.

## Next steps
1. Owner: check the live leaderboard and My Profile on a phone (season card, switcher, "Your 2026 season").
2. After the first 2027 session with games: confirm the boards fill in and no "dropped" celebration fires.
3. Owner: close the Xmas Party session when photos are in.

## Open questions
- Worktree branch `claude/094-season-reset-ab612d` is fully merged; it can be deleted when the session is archived.
- Offered, not decided: treat Supabase 500/52x token-refresh errors as retryable so a brief outage doesn't sign players out.
- Carried over: iPhone Safari WebP untested on a real phone; kiosk insert rule; offline-backup phone check; Broadcast/share on phones; Nov 1 session not closed; prod `service_role` key not rotated; old Neon test branches cleanup (owner: maybe later).
