# Handoff — current snapshot

Updated: 2026-11-24 Manila. Overwrite this file on every update; it is never a running history.

## Done this session
- Owner's 8 banned "AI design" patterns applied across the whole app (a1f2705, 64aee49). Rules + keep-list in
  `project_memory.md` → "Visual rules". POCs in `temporary_files/ai-pattern-*.html`.
- "No cheers" list (migration 094, `no_cheer_players`): admin-managed on Settings → Cheers; anyone listed gets no
  cheer screen and no reminder bar (`useNoCheers` in `hooks/useCheerLater.ts`, checked in `PlayerLayout`).
  Owner chose per account, not all guests.
  - Neon dev: applied, `scripts/neon/tests/no-cheer-rls.sql` 6/6 PASS, verified in app (Raj on → no gate, off → gate).
  - **Production: applied 2026-11-24 with owner OK, Data API schema refreshed, work-work (Angelo, "workislife99")
    added to the list.**
- `tsc -b` clean, 715/715 unit tests, build pass.

## Current state
- Pushed to `dev` and `main`. Vercel deploy not checked.
- Not seen on screen (dev data lacks them): Today with results, celebration card, toasts, turn banner, fee chips.
- work-work's 15 Oct 4 cheers kept (owner did not ask to remove). Its 5 Oct 25 games simply stop asking.
- Local stash "pre-pull local handoff/cli-latest 2026-11-24" still there (old handoff edits, likely stale).

## Next steps
1. Owner: open Settings → Cheers on the live site and confirm "No cheers" shows Angelo.
2. Optional: the All Games board's small monospace caps labels — not one of the 8 rules.
3. Drop the stash once confirmed stale.

## Open questions
- Carried over: Supabase 500/52x token-refresh retry (undecided); iPhone Safari WebP; kiosk insert rule; offline-backup
  phone check; Nov 1 session not closed; prod `service_role` not rotated; old Neon branches.
