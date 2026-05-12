# Codebase Concerns

**Analysis Date:** 2026-05-12

## Tech Debt

**Session orchestration spread across client hooks:**
- Issue: Session lifecycle, queue management, and court assignment are implemented as many separate client-side writes instead of transactional database functions.
- Files: `badminton-v2/src/hooks/useSession.ts`, `badminton-v2/src/hooks/useAdminActions.ts`, `badminton-v2/src/components/CourtCard.tsx`
- Impact: Partial failures can leave sessions, invitations, matches, and courts in inconsistent states.
- Fix approach: Move multi-step mutations into Supabase RPC functions or SQL transactions and have React call one durable command per transition.

**Oversized UI and domain modules:**
- Issue: Match generation and session UI logic are concentrated in very large files with mixed concerns.
- Files: `badminton-v2/src/components/MatchGeneratorPanel.tsx`, `badminton-v2/src/lib/matchGenerator.ts`, `badminton-v2/src/views/PlayersView.tsx`, `badminton-v2/src/views/SessionView.tsx`
- Impact: Changes are high-risk, review is slow, and isolated testing is difficult.
- Fix approach: Split scheduling UI, audit widgets, edit flows, and scoring logic into smaller modules with narrow responsibilities.

**Duplicated Supabase query logic across hooks and views:**
- Issue: Registration, roster, player schedule, leaderboard, profile, and finance views each assemble their own Supabase reads with repeated mapping logic.
- Files: `badminton-v2/src/hooks/useRegisteredPlayers.ts`, `badminton-v2/src/hooks/useRoster.ts`, `badminton-v2/src/hooks/usePlayerSchedule.ts`, `badminton-v2/src/views/LeaderboardView.tsx`, `badminton-v2/src/views/ProfileView.tsx`
- Impact: Behavior drifts between screens, RLS failures are handled inconsistently, and changes require touching multiple files.
- Fix approach: Consolidate repeated queries into shared data-access helpers or RPC endpoints and standardize error handling at the boundary.

## Known Bugs

**Notification bootstrap runs only once per app mount:**
- Symptoms: The initial unread-notification fetch and toast replay do not run again after switching users in the same browser session.
- Files: `badminton-v2/src/contexts/NotificationContext.tsx`
- Trigger: Sign in as one user, sign out, then sign in as another without a full page reload.
- Workaround: Refresh the page after changing users.

**Registration token is left in browser storage and printed to the console:**
- Symptoms: `/register` can reuse a stale invitation token and the token is exposed in browser logs.
- Files: `badminton-v2/src/views/RegisterView.tsx`, `badminton-v2/src/hooks/useRegistration.ts`
- Trigger: Open a registration link, complete or abandon sign-in, then revisit `/register` later without a token in the URL.
- Workaround: Clear `localStorage.registration_token` manually or open registration links in a fresh browser session.

**Shuttle usage update is destructive on partial failure:**
- Symptoms: Editing usage deletes existing rows first; if reinsertion fails, the session is left with no recorded shuttle usage.
- Files: `badminton-v2/src/hooks/useSessionFinance.ts`
- Trigger: Any network, validation, or RLS failure after the delete step inside `logUsage`.
- Workaround: Re-enter usage manually after the failure.

## Security Considerations

**Hardcoded dev credentials live in source:**
- Risk: Test account emails and passwords are committed in the UI and seed flow, creating reuse risk and accidental exposure if the dev panel is enabled outside local development.
- Files: `badminton-v2/src/components/DevLoginPanel.tsx`, `badminton-v2/scripts/seed-test-users.ts`
- Current mitigation: `DevLoginPanel` returns `null` when `import.meta.env.DEV` is false.
- Recommendations: Remove passwords from tracked source, load them from local-only env or generated fixtures, and gate test auth behind Playwright-only helpers.

**Local secret files are required by test tooling:**
- Risk: E2E and seeding depend on `.env`-backed service-role credentials on disk.
- Files: `badminton-v2/playwright.config.ts`, `badminton-v2/tests/registration-limit.spec.ts`, `badminton-v2/scripts/seed-test-users.ts`
- Current mitigation: Secrets are not hardcoded in the files; `.env` files exist locally.
- Recommendations: Prefer CI secret injection over manual file parsing and keep service-role usage limited to setup utilities.

**Lint ignores generated UI primitives entirely:**
- Risk: Unlinted code in shared UI components can accumulate unsafe patterns or stale accessibility issues without detection.
- Files: `badminton-v2/eslint.config.js`, `badminton-v2/src/components/ui`
- Current mitigation: The directory is intentionally excluded.
- Recommendations: Either lint the directory or treat it as vendored code that is not modified locally.

## Performance Bottlenecks

**Leaderboard and awards pages perform broad client-side aggregation:**
- Problem: The awards flow fetches large sets from `cheers`, `player_cheer_stats`, `player_stats`, `profiles`, `sessions`, and `session_registrations`, then computes rankings in the browser.
- Files: `badminton-v2/src/views/LeaderboardView.tsx`, `badminton-v2/src/views/ProfileView.tsx`
- Cause: Aggregation logic sits in React instead of SQL views or RPC functions.
- Improvement path: Move leaderboard and award calculations into database views or RPCs with pre-aggregated outputs.

**Inventory and finance recompute stock from all usage rows on every load:**
- Problem: Admin inventory screens read all `shuttle_usage` rows to derive remaining stock.
- Files: `badminton-v2/src/hooks/useSessionFinance.ts`, `badminton-v2/src/hooks/useShuttleBatches.ts`
- Cause: Remaining inventory is computed client-side from full-table scans rather than a summarized source.
- Improvement path: Add a stock summary view/RPC per batch and fetch only the session usage plus aggregated remaining inventory.

**Match generation runs entirely on the main thread:**
- Problem: Large optimization settings execute synchronous CPU-heavy work inside the browser UI.
- Files: `badminton-v2/src/components/MatchGeneratorPanel.tsx`, `badminton-v2/src/lib/matchGenerator.ts`
- Cause: `generateScheduleOptimized` performs many trials and restarts in-process without a worker.
- Improvement path: Offload scheduling to a Web Worker or server-side function and stream progress back to the UI.

## Fragile Areas

**RLS and migration workflow is easy to misconfigure:**
- Files: `badminton-v2/supabase/migrations/`, `.planning/STATE.md`
- Why fragile: The app relies heavily on RLS policies, explicit grants, and manual SQL execution through the Supabase Dashboard because the CLI workflow is blocked on Windows.
- Safe modification: Add every schema change with matching `ENABLE ROW LEVEL SECURITY`, policies, and grants in the same migration, then regenerate `badminton-v2/src/types/database.ts`.
- Test coverage: No automated migration verification is present in `badminton-v2/tests/` or `badminton-v2/src/__tests__/`.

**Realtime behavior is distributed and uncached:**
- Files: `badminton-v2/src/contexts/NotificationContext.tsx`, `badminton-v2/src/hooks/useRoster.ts`, `badminton-v2/src/hooks/useMatchCheers.ts`, `badminton-v2/src/views/ProfileView.tsx`, `badminton-v2/src/views/TodayView.tsx`
- Why fragile: Multiple features open their own channels and independently refetch state, which makes ordering bugs and duplicate fetches hard to reason about.
- Safe modification: Centralize realtime subscriptions by domain and keep channel lifecycle logic in dedicated hooks with stable invalidation paths.
- Test coverage: No subscription behavior is covered by Vitest or Playwright.

**Auth and role resolution fails silently:**
- Files: `badminton-v2/src/contexts/AuthContext.tsx`
- Why fragile: Profile lookup errors are not surfaced, so auth failures collapse into `role = null` and redirect behavior without a clear user-facing error.
- Safe modification: Handle Supabase errors explicitly, show an auth recovery state, and avoid assuming profile reads always succeed.
- Test coverage: No tests exercise auth state transitions or inactive-user sign-out behavior.

## Scaling Limits

**Frontend data layer does not scale past small datasets:**
- Current capacity: 67 source files, 61 migrations, 3 unit tests, and 1 E2E spec indicate the app is still optimized for a small admin/player population and light historical data.
- Limit: Full-table reads in leaderboard, cheers, inventory, and finance flows will degrade as sessions and usage history grow.
- Scaling path: Introduce paginated admin queries, SQL summaries, and RPC endpoints that return already-ranked or already-aggregated results.

## Dependencies at Risk

**Generated Supabase types can drift from schema:**
- Risk: The app depends on a checked-in generated file that must match the latest migrations.
- Impact: Hook queries fall back to `any`, casts, or broken inferred types when migrations advance without regenerating types.
- Migration plan: Regenerate `badminton-v2/src/types/database.ts` immediately after each schema change and reduce `as any` usage in `badminton-v2/src/hooks/`.

## Missing Critical Features

**No transactional server API for critical admin workflows:**
- Problem: High-value mutations still rely on direct client table writes.
- Blocks: Reliable queue reordering, schedule locking, session start/stop flows, and finance updates under concurrent admin activity.

## Test Coverage Gaps

**Admin, auth, realtime, and registration flows are mostly untested:**
- What's not tested: `useSession`, `useAdminActions`, `AuthContext`, `NotificationContext`, inventory management, cheers flows, and most player/admin views.
- Files: `badminton-v2/src/hooks/useSession.ts`, `badminton-v2/src/hooks/useAdminActions.ts`, `badminton-v2/src/contexts/AuthContext.tsx`, `badminton-v2/src/contexts/NotificationContext.tsx`, `badminton-v2/src/views/InventoryView.tsx`, `badminton-v2/src/views/FinanceDetailView.tsx`
- Risk: Regressions in session state, payment updates, auth gating, and realtime UX can ship unnoticed.
- Priority: High

**Test suite coverage is narrow relative to the app surface:**
- What's not tested: 67 non-test source files are covered by only 3 unit test files and 1 Playwright spec.
- Files: `badminton-v2/src/__tests__/matchGenerator.test.ts`, `badminton-v2/src/__tests__/matchGenerator.scoring.test.ts`, `badminton-v2/src/__tests__/useSessionFinance.test.ts`, `badminton-v2/tests/registration-limit.spec.ts`
- Risk: Most screens and hooks have no executable safety net.
- Priority: High

---

*Concerns audit: 2026-05-12*
