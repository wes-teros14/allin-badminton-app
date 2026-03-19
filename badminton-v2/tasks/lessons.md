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
