# Handoff — current snapshot

Updated: 2026-11-19 afternoon, Manila. Overwrite this file on every update; it is never a running history.

## Season reset — designed and planned, PARKED until after the Nov 22 Xmas party (owner)
- Design approved: `specs/009-season-reset/design.md`. Plan: `specs/009-season-reset/plan.md` (12 tasks).
  POC: `temporary_files/season-reset-poc.html` (gitignored). Visual: `badminton-v2/docs/visual/season-reset-approaches.html`.
- In short: 2026 season = sessions before 2026-11-16; Nov 22 opens 2027. Boards, awards and My Profile become
  season-only, computed at read time from raw rows (no migration). Minimums = 3 sessions in the past 12 months
  (2026 keeps its 4). Season switcher on the leaderboard + private "Your 2026 season" page.
- No deadline: under read-time windows, Nov 22's games land in 2027 whenever this ships.
- Not committed: design, plan, visual, qa-log entries, CLAUDE.md lessons, `tasks/todo.md` pointer.

## Neon work (from the 11-17 → 11-19 session)
- Shipped to dev + main: Finance shortcut on admin session cards; Against the Odds wording; yellow Admin tab;
  offline backup subs panel + Schedule/Players tabs.
- Dev on Neon: `parity` → `dev` (no expiry), schema identical to production, `badminton-v2-dev` launcher on Neon.
- Live site: Neon `production` + Supabase prod auth/storage. Local dev: Neon `dev` + Supabase DEV auth.
- Git: `main`/`dev` at 97e0096 (pushed per that session).

## Next steps
1. Sun Nov 22: watch the session on Neon (console RAM/CU); Phase 4 daily CU-h check.
2. After Nov 22: build the season plan — owner to pick subagent-driven (recommended) or native execution.
3. Check dev's keepalive first run (2026-11-19 19:00 UTC): JWKS file still lists 4 kids.
4. Housekeeping when the owner says so: delete `spike`, `rehearsal`, `rehearsal-loadtest-backup`,
   `production-dryrun-backup`. **Keep** `parity-before-restore` and `parity-writetests-backup` (`dev`'s parents).
   Deleting `rehearsal` is fine for the season plan: its parity task falls back to production, read-only. npm audit.

## Open questions
- Season plan: cheers counted with their March `multiplier` weights (my call) — owner hasn't confirmed or objected.
- Season plan task 12 needs a prod-copy (or production) Data API URL + anon JWT from the owner.
- Kiosk rule `match_results: kiosk insert` — decide at project end.
- Real phone check of the offline backup — not done. Broadcast/share untested on phones; Nov 1 session not closed;
  prod `service_role` key not rotated.
