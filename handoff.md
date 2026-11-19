# Handoff — current snapshot

Updated: 2026-11-19 ~11:30 Manila. Overwrite this file on every update; it is never a running history.

## Done this session (2026-11-17 → 11-19)
- Shipped to dev + main: Finance shortcut on admin session cards; Against the Odds wording (D); yellow Admin tab
  always on the bar; offline backup = app-style subs panel (top 3) + Schedule/Players tabs (Now dropped).
- **Dev on Neon (Phase 5 in `tasks/todo.md`):** `parity` → `dev` (no expiry), schema identical to production,
  fresh seed (`scripts/neon/seed-dev.sql`), new anon key `neon-anon-dev-1`, seal/keepalive redeployed,
  `badminton-v2-dev` launcher on Neon. Verified on localhost (push 2.4 s, boards, finance, backup, signed-out board).

## Current state
- Live site: Neon `production` + Supabase prod auth/storage. Local dev: Neon `dev` + Supabase DEV auth.
- Uncommitted: Phase 5 files (`.claude/launch.json`, `scripts/neon/seed-dev.sql`, `scripts/neon/run-dev.mjs`, docs).
- Preview builds: not switched (no Supabase URL compiled in → reach no database today).

## Next steps
1. OWNER: Preview vars (6) + which Preview URL to allow — see todo.md Phase 5 step 7.
2. Check dev's keepalive first run (2026-11-19 19:00 UTC): JWKS file still lists 4 kids.
3. Watch Sun Nov 22 session on Neon (console RAM/CU); Phase 4 daily CU-h check.
4. Housekeeping: delete `spike`, `rehearsal` (exp. 11-30) and backup branches when sure (note: `dev`'s parent chain
   is `parity-writetests-backup` → `parity-before-restore`); npm audit.

## Open questions
- Kiosk rule `match_results: kiosk insert` — decide at project end.
- Real phone check of the offline backup (tabs, Who's out?) — not done.
- Carried over: Broadcast/share untested on phones; Nov 1 session not closed; prod `service_role` key not rotated.
