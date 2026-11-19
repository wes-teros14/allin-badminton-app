# Handoff — current snapshot

Updated: 2026-11-19 ~12:00 Manila. Overwrite this file on every update; it is never a running history.

## Done this session (2026-11-17 → 11-19)
- Shipped to dev + main: Finance shortcut on admin session cards; Against the Odds wording (D); yellow Admin tab
  always on the bar; offline backup = app-style subs panel (top 3) + Schedule/Players tabs (Now dropped).
- **Dev on Neon (Phase 5 in `tasks/todo.md`):** `parity` → `dev` (no expiry), schema identical to production,
  fresh seed (`scripts/neon/seed-dev.sql`), new anon key `neon-anon-dev-1`, seal/keepalive redeployed,
  `badminton-v2-dev` launcher on Neon. Verified on localhost (push 2.4 s, boards, finance, backup, signed-out board).

## Current state
- Live site: Neon `production` + Supabase prod auth/storage. Local dev: Neon `dev` + Supabase DEV auth.
- Git: all work committed; `dev` = `main` content (last push: 5b4a039 / merge bbdc3f6) + this wrap-up docs commit.
- Neon: 2 real branches (`production`, `dev`) + 6 old test/backup branches (see step 4). Local dev server stopped.
- Preview builds: deliberately not switched (owner: not needed).

## Next steps
1. Check dev's keepalive first run (2026-11-19 19:00 UTC): JWKS file still lists 4 kids.
2. Watch Sun Nov 22 session on Neon (console RAM/CU); Phase 4 daily CU-h check.
3. Housekeeping, when the owner says so (deferred 2026-11-19): delete `spike`, `rehearsal` then
   `rehearsal-loadtest-backup`, `production-dryrun-backup`. **Keep** `parity-before-restore` and
   `parity-writetests-backup`: they are `dev`'s parents. npm audit.

## Open questions
- Kiosk rule `match_results: kiosk insert` — decide at project end.
- Real phone check of the offline backup (tabs, Who's out?) — not done.
- Carried over: Broadcast/share untested on phones; Nov 1 session not closed; prod `service_role` key not rotated.
