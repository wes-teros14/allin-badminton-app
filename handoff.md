# Handoff — current snapshot

Updated: 2026-11-16 ~09:00 Manila. Overwrite this file on every update; it is never a running history.

## Done this session
- **Neon migration plan v2** (H1 hybrid) in `tasks/todo.md`, reviewed by a separate session
  (`tasks/neon-migration-review.md`); visual `badminton-v2/docs/visual/supabase-to-neon-migration.html`.
- **Neon setup:** CLI signed in; project `lucky-heart-02739020` linked (`badminton-v2/.neon`); connection
  strings in `badminton-v2/.env.local`; project-level Neon skills + MCP; `neon.ts` + `@neon/config`,
  `@neon/env` (bumped `zod` 4.3.6 → 4.6.7, `jiti`; build + 495 tests pass).
- **G0 PASS** on Neon branch `spike` (two design changes, recorded in `tasks/todo.md` and memory).
- **Realtime enabled** on `spike` (project `wal_level=logical`, permanent); delivery check passed.
- **G6:** risk, not a blocker → daily Supabase keep-alive in Phase 1.

## In progress
- **G1 idle test** on branch `spike` since 2026-11-16 00:31 UTC. **Do not connect to `spike`** until it is
  read. Read from 2026-11-17 00:31 UTC (~09:30 Manila, metrics lag):
  `neon branches get spike --project-id lucky-heart-02739020 -o json` → `active_time_seconds`.
- **Session [G3 parity](local_69317aee-1460-46c9-b76a-4eb75c608792)** (own worktree): schema + app
  queries on Neon branch `parity`; writes `badminton-v2/scripts/neon/`. Not finished.
- **Session [G5 cold start](local_5e8f477e-6843-4103-b5b4-6eca2f5073f3):** 8 cycles on branch
  `coldstart`, deletes it after. Not finished.

## Immediate next steps
1. Read both sessions' results; check their numbers/files; record in `tasks/todo.md` (G3, G5).
2. Read G1. Pass → hidden/visible-tab runs, G2, G4, then Phase 1. Fail → stop, re-plan with owner.

## Open questions
- Where the merged JWKS (Supabase key + our anon key) lives in prod, and where the anon private key is
  kept (spike: public Neon bucket + scratchpad only). Unclear.
- Egress for the last Supabase cycle (owner reads Usage → Egress). Not given yet.
- D1 (open registration on app load vs a Function) not confirmed by owner.
- Neon MCP shows "needs authentication" — owner authorizes via `/mcp` if wanted; CLI suffices.
- 42 npm audit vulnerabilities (3 critical) reported after the Neon package install; not addressed.
- Carried over: Broadcast/share/keep-last-good untested on real phones in a real session; magnet HTML
  commit; Nov 1 session not closed; prod `service_role` key not rotated; `sessions: admin delete`
  `qual true` unchecked; never `db push` to prod.
