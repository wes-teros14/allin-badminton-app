# Lessons Learned

## Vercel Build Errors from Local Fixes

**Symptom:** Vercel reports a TypeScript error that was already fixed locally. Build fails on Vercel but `tsc --noEmit` passes locally.

**Root cause:** Vercel cached a previous deployment and did not pick up the latest commit. The error shown in the Vercel log references line numbers that no longer match the current file.

**Fix:** Push an empty commit to force Vercel to trigger a fresh build:
```bash
git commit --allow-empty -m "chore: trigger Vercel rebuild" && git push
```

**How to apply:** When a Vercel build error looks identical to one already fixed in a prior commit, always check `git log` first. If the fix is already pushed, use the empty commit trick rather than re-applying the same change.

---

## TypeScript: Non-null Assertion vs Early Return for Optional Params

**Symptom:** `error TS2345: Argument of type 'string | undefined' is not assignable to parameter of type 'string'` inside a hook that already guards with `if (!userId) return`.

**Root cause:** TypeScript does not narrow the type of `userId` inside an async `load()` function declared inside `useEffect`, even when there's an early return guard at the top. The narrowing is lost across the async function boundary.

**Fix:** Use the non-null assertion `userId!` at the call site, since the early return already guarantees it is defined.

**How to apply:** Inside async functions nested in `useEffect`, use `!` assertions after a guard rather than expecting TypeScript to carry the narrowing through.

---

## Supabase: Admin Updating Other Users' Rows Needs Explicit RLS Policy

**Symptom:** Admin edits in /players view appear to work (no error toast) but don't persist on refresh.

**Root cause:** Default RLS UPDATE policy only allows `auth.uid() = id` — users can only update their own row. Admin updating another player's profile gets silently blocked by RLS even with GRANT in place.

**Fix:** Add a separate policy allowing admins to update any profile row:
```sql
CREATE POLICY "Admins can update any profile" ON public.profiles
FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
```

**How to apply:** Any time an admin needs to write to rows they don't own, add an admin-specific RLS policy. GRANT alone is not enough — RLS USING clause must also pass.

---

## Supabase: RLS Policy Alone Is Not Enough — GRANT Required Too

**Symptom:** `permission denied for table X` even though an RLS policy allowing the operation exists.

**Root cause:** Supabase RLS policies control row-level access, but PostgreSQL still requires the role to have the underlying table privilege (SELECT/INSERT/UPDATE/DELETE) granted separately. The `anon` and `authenticated` roles don't get UPDATE or DELETE by default.

**Fix:** Run the missing GRANT in the Supabase SQL editor:
```sql
GRANT UPDATE ON public.profiles TO authenticated;
GRANT DELETE ON public.sessions TO authenticated;
-- etc.
```

**How to apply:** Any time a new table operation (UPDATE/DELETE/INSERT) is added and returns `permission denied`, check `GRANT` first before debugging RLS policies. RLS is row-filtering; GRANT is table-level access.

---

## Unused Imports Cause Vercel Build Failures

**Symptom:** `error TS6133: 'X' is declared but its value is never read` — passes locally if `noUnusedLocals` is not set in `tsconfig`, but Vercel's build uses stricter flags.

**Root cause:** Vercel runs `tsc -b` which respects the project's `tsconfig.json`. If the tsconfig has `"noUnusedLocals": true`, unused imports that are harmless locally will fail the build.

**Fix:** Remove unused imports immediately when refactoring. Don't leave dead imports even if they don't cause local errors.

**How to apply:** Always clean up imports when removing or refactoring JSX — especially when removing named exports from shadcn component imports.

---

## Migration 079 Blocked by Pre-Existing Duplicate-Player Match

**Symptom:** Running `079_matches_distinct_players.sql` on prod raised
`P0001: Cannot add matches_distinct_players_check — these matches repeat a player: match 4b02f199-… (session 47a97f9e-…, game 5)`.

**Root cause:** Not a migration bug — the guard block did its job. One historical row genuinely held the same player twice. Session "FREE SHUTTLE!" (2026-08-23) game 5 had Aian in both `team1_player2_id` and `team2_player1_id`. All 20 matches in that session were generated in one batch (`created_at` identical), and the generator cannot emit a repeat, so game 5 was hand-edited afterward through one of the four-independent-dropdown forms — the exact hole commit `141679e` closed at the app layer. Game 5 was also the only match in the session with no `match_results` row, so it never contributed to stats.

**Fix:** Identified the correct occupant by slot count (every player had 5 games except Jax with 3), confirmed with the user, then:
```sql
UPDATE public.matches
   SET team2_player1_id = '<jax-uuid>'
 WHERE id = '4b02f199-…' AND team2_player1_id = '<aian-uuid>';
```
Re-ran the offender scan (0 rows), then applied 079 to prod and dev. Constraint verified present on both.

**How to apply:** When a data-integrity migration fails, treat the RAISE as a finding, not an error to code around — never loosen the constraint to make it apply. Run `supabase/maintenance/duplicate-match-players-scan.sql` first. To identify the intended value in a repaired row, use session-level invariants (games-per-player should be even across the roster) as evidence, and confirm with the user before writing to prod.
