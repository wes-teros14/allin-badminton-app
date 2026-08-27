# Lessons Learned

## Story 1.1 — Project Scaffold

- **`@tailwindcss/vite` peer dep conflict with Vite 8**: `@tailwindcss/vite@4.x` requires `vite@^5-7` but Vite 8 is installed. Fix: add `legacy-peer-deps=true` to `.npmrc`. No flag needed on future installs.

- **shadcn init must be pre-configured**: Before running `npx shadcn@latest init`, you must: (1) add `@tailwindcss/vite` plugin to `vite.config.ts`, (2) add `@import "tailwindcss"` to `index.css`, (3) add `paths: { "@/*": ["./src/*"] }` to both `tsconfig.json` and `tsconfig.app.json`. shadcn validates Tailwind + path alias before running — it fails without these.

- **shadcn-generated files trigger ESLint errors**: Files in `src/components/ui/` violate `react-refresh/only-export-components`. Fix: add `'src/components/ui'` to `globalIgnores` in `eslint.config.js`. Never edit files under `src/components/ui/`.

- **React Router v7 package name changed**: Import from `"react-router"` NOT `"react-router-dom"`.

- **Git submodule trap**: If `badminton-v2/` has its own `.git` folder, the parent repo tracks it as a submodule (mode 160000). Fix: `git rm --cached badminton-v2` then `git add badminton-v2/` to re-add as regular folder.

- **Vercel + monorepo subfolder**: When the app is in a subfolder (`badminton-v2/`), Vercel's UI root directory picker may not work. Fix: create a root-level `vercel.json` with explicit `buildCommand` (`cd badminton-v2 && npm install && npm run build`) and `outputDirectory` (`badminton-v2/dist`).

---

## Story 1.2 — Design Token System

- **CSS variable scoping vs painting**: Applying `.kiosk-dark` to a div scopes the CSS variable override, but the div won't visually change color unless it also applies `bg-background`. The variable override alone doesn't paint the background — the Tailwind utility must also be applied to the element.

- **`@utility` in Tailwind v4 for custom classes**: Use `@utility game-hero { ... }` for the base style. Responsive overrides use a standard `@media` block targeting `.game-hero` — not another `@utility` block.

---

## Story 1.3 — Google OAuth & Profiles

- **Supabase CLI "Access is denied" on Windows**: The Supabase CLI binary is blocked by Windows permissions. Workaround: run migrations directly in Supabase Dashboard → SQL Editor instead of `supabase db push`.

- **Supabase JS v2 type inference with manual `Database` type**: When hand-writing `Database` types (before `supabase gen types` runs), each table entry must include `Relationships: []` or TypeScript infers `data` as `never` or `{}`. The `select('role')` partial select also returns `never` — use `select('*')` or cast with `(data as { role?: string } | null)`.

- **`onAuthStateChange` callback must be synchronous**: Never make the `onAuthStateChange` callback `async`. Async callbacks cause Supabase JS deadlocks. Fetch role data outside the callback using `.then()`.

- **Google Cloud Console project creation**: If using a Google Workspace/org account, you may get "You need additional permissions". Fix: switch to a personal Gmail account or ensure "No organization" is selected when creating the project.

- **Supabase project needed before `.env.local`**: A Supabase project must be created at supabase.com before you can populate `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local`. The anon key = the "anon public" / "publishable" key in Project Settings → API.

- **Run SQL migrations via dashboard as CLI alternative**: Supabase Dashboard → SQL Editor → New query → paste SQL → Run. Equivalent to `supabase db push` without needing the CLI.

- **RLS policies alone are not enough — table grants are required**: In PostgreSQL, RLS policies and table-level privileges are separate. Even with a permissive RLS policy (`USING (true)`), a 403 will occur if the role doesn't have `GRANT SELECT` on the table. After creating a table via SQL, always run: `GRANT SELECT ON public.<table> TO anon, authenticated;`. Supabase only auto-grants these for tables created through the dashboard UI, not via raw SQL migrations.

---

## Story 2.3 — Player Registration via OAuth Link

- **Authenticated users need their own RLS SELECT policy**: `session_invitations` had `TO anon USING (true)` for reads, but after OAuth sign-in the player becomes `authenticated` — not `anon`. The `anon` policy no longer applies. Authenticated non-admin users got empty results (no matching policy), causing "Registration Closed" to show even with a valid token. Fix: always add a `TO authenticated USING (true)` SELECT policy for any table that both anon AND signed-in non-admin users need to read.

- **OAuth redirect drops query params — use `sessionStorage` as fallback**: `signInWithOAuth` redirects through Supabase and Google, then back to `redirectTo`. By the time the browser lands back on the app, query params like `?token=xxx` may be lost. Fix: `sessionStorage.setItem('registration_token', token)` before calling `signInWithOAuth`, then in the component: `const token = searchParams.get('token') ?? sessionStorage.getItem('registration_token')`. Clear from `sessionStorage` once validated.

- **Supabase network tab truncates UUIDs**: The Claude CLI and browser DevTools may display truncated URLs. Always click into the request in the Network tab and check the full Response body — PostgreSQL error messages show the exact value received (e.g., `invalid input syntax for type uuid: "f0634918"`), which pinpoints truncation.

---

## Supabase SQL Editor

- **Multi-column `ALTER TABLE` with comma-separated `ADD COLUMN` fails in Supabase Dashboard**: Running `ALTER TABLE t ADD COLUMN a ..., ADD COLUMN b ...;` in the SQL Editor errors on the second column line. Fix: split into separate statements and run one at a time — `ALTER TABLE t ADD COLUMN a ...;` then `ALTER TABLE t ADD COLUMN b ...;`.

---

## React / TypeScript

- **Never use dynamic `await import(...)` for error handling utilities like `toast`**: Dynamic imports inside async functions can fail silently, making errors invisible to the user (the function just stops with no feedback). Always import `toast` (and similar utilities) statically at the top of the file. Silent early returns (`if (!x) return`) are equally dangerous — always pair them with a `toast.error(...)` so the user knows something went wrong.

---

## Supabase Realtime

- **Symptom**: `postgres_changes` subscriptions never fire — views don't auto-update when DB rows change.
  **Root cause**: Table not added to the `supabase_realtime` publication. Supabase only broadcasts changes for tables explicitly in this publication.
  **Fix**: `ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;`
  **Note**: Confirmed working — updates arrive in under 4 seconds after applying this fix. Always run this migration for any new table that needs Realtime.

- **Symptom**: Filtered subscriptions (`filter: session_id=eq.xxx`) don't trigger on UPDATE/DELETE.
  **Root cause**: Table has default REPLICA IDENTITY (primary key only), so Postgres can't match filter columns on old row values.
  **Fix**: `ALTER TABLE public.matches REPLICA IDENTITY FULL;`

- **Symptom**: Two views (kiosk + admin) open simultaneously — realtime stops working on one.
  **Root cause**: Both subscribed to the same channel name (`kiosk-{sessionId}`). Duplicate channel names conflict in the Supabase client.
  **Fix**: Use distinct channel prefixes per view (`kiosk-`, `admin-`, `player-`). The `useRealtime` hook accepts a `channelPrefix` param.

---

## Supabase RLS — Player / Anon Access

- **Symptom**: `/player` page showed "Find your name" heading but no player list — empty results with no error.
  **Root cause**: `session_registrations` had no `anon` SELECT policy and no `GRANT SELECT TO anon`. The browser was also authenticated as a user whose `player_id` had no matching profile row, so only their own registration was visible via the `player read own` policy.
  **Fix**: Migration 008 added `CREATE POLICY "session_registrations: anon read" ... TO anon USING (true)` + `GRANT SELECT ON public.session_registrations TO anon`. Also deleted the orphaned registration row with no matching profile.

- **Symptom**: Logged-in players visiting `/player` still saw an empty list despite anon policy being applied.
  **Root cause**: Authenticated users bypass the `anon` policy — the `player read own` policy only allows them to see their own registration row.
  **Fix**: Migration 009 added `CREATE POLICY "session_registrations: authenticated read all" ... TO authenticated USING (true)`.

---

## Vercel Environment Variables

- **Supabase redirect URL allowlist blocks preview deployments**: After OAuth sign-in, Supabase redirects to the production URL even when signing in from a Vercel preview URL. Root cause: Supabase only allows redirect URLs explicitly listed in Authentication → URL Configuration → Redirect URLs. Fix: add `https://*.vercel.app/**` as a wildcard redirect URL in Supabase to cover all preview deployments.

- **`VITE_APP_URL` must be Production-only**: Setting `VITE_APP_URL` on Preview environments causes OAuth redirects to land on the production URL instead of the preview URL. Fix: in Vercel → Environment Variables → `VITE_APP_URL` → check **Production only**. Leave it unset for Preview/Development so `window.location.origin` is used, which correctly resolves to the preview deployment URL.

- **Vercel preview URLs require Vercel login by default**: Vercel enables Deployment Protection on preview/branch URLs out of the box. Incognito or non-Vercel-authenticated users get a Vercel login wall. Fix: Vercel Dashboard → project → Settings → Deployment Protection → disable "Vercel Authentication" for Preview deployments.

- **Deleted env vars cause blank black screen**: If Vercel environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) are accidentally deleted, the app renders a blank black screen with console error `supabaseUrl is required`. Re-add the variables with Production + Preview + Development checked, then redeploy.

---

## General

- **Always run `npm run build` + `npm run lint` before marking a story complete.** Both must pass clean.

- **Visual verification is the test for CSS/theming stories**: No unit tests needed for pure CSS work. Run `npm run dev` and check the browser.

- **`.kiosk-dark` is separate from shadcn's `.dark`**: Do not merge them. Kiosk dark mode is applied via explicit class on the KioskView root, not via `prefers-color-scheme`.

- **Never paste the literal `SUPABASE_SERVICE_ROLE_KEY` value into a scratch script for manual/browser verification**: Ad-hoc Node scripts used to seed test data before a headed-Playwright check should load the key from `.env`/`.env.development` at runtime (same pattern as `tests/registration-limit.spec.ts` and `tests/admin-court-count.spec.ts`), not hardcode the string. Hardcoding it means the raw secret sits in a file on disk and flows through tool output/transcripts unnecessarily, even if the file is deleted afterward and never committed. No leak occurred when this happened (verified via `git log --all -S "<key>"` across all branches, plus a memory/plan-file search), but it was an avoidable practice gap.

---

## Vercel Environment Variables — Dev vs Prod Supabase

- **Symptom**: Google OAuth login works on dev/preview deployment but returns 401 on production. Both deployments use the same code (same commit). Direct `fetch()` to the prod Supabase URL with the anon key also returns 401.
  **Root cause**: Two issues compounded:
  1. Dev and prod use **separate Supabase projects**, but Vercel had a **single shared** `VITE_SUPABASE_ANON_KEY` and `VITE_SUPABASE_URL` across all environments. The shared key only matched the dev Supabase project, so prod auth always failed.
  2. Two Vercel projects existed (`all-in-badminton-app` and `allin-badminton-app`) — the wrong one was being used for production.
  **Fix**: In Vercel → Settings → Environment Variables, set **separate values per environment**: Production gets the prod Supabase URL + anon key, Preview/Development gets the dev Supabase URL + anon key. Also ensured the correct Vercel project is used for each deployment.
  **Rule**: When dev and prod Supabase projects are separated, **always** set environment-specific variables in Vercel — never share a single value across all environments.

---

## Leaderboard — Win% Ranking + Session-Eligibility Gate

- **Symptom**: After changing the All-time Idols leaderboard to require `player_stats.sessions_attended >= 3` for eligibility, the board showed "No stats recorded yet" for everyone, even players with dozens of games played.
  **Root cause**: Migration `030_sessions_attended_on_completion.sql` switched the counter to increment only when a session transitions to `status = 'complete'`, but — unlike migration `013` which backfilled on creation — it never backfilled `sessions_attended` for sessions that were *already* complete when it ran. The column had been silently stuck near 0 for every player since that migration shipped; a new eligibility check finally made the gap visible.
  **Fix**: Added migration `071_backfill_sessions_attended.sql`, which recomputes `sessions_attended` for every player from `session_registrations` joined to `sessions WHERE status = 'complete'` (idempotent, safe to rerun). Applied directly to the dev Supabase project via a throwaway service-role script since no Supabase CLI project link exists locally; **still needs to be run against the prod Supabase project** (SQL editor or `supabase db push` once linked) — no prod credentials are available in this environment.
  **Rule**: Any migration that changes *when* or *how* a running counter/aggregate is maintained must also backfill from source-of-truth data for rows that predate the change — otherwise the column silently diverges from reality until something (like a new eligibility check) finally surfaces it.

---

## Today Tab — Multiple Sessions Bug

- **Symptom**: Live session's Today tab leaderboard broken when a second session (test seed) existed simultaneously.
  **Root cause**: `useActiveSession()` used `LIMIT 1` with `ORDER BY date DESC` — when multiple active sessions exist, it picks whichever has the most recent date, which may be the wrong session. The leaderboard then showed data for the unintended session.
  **Fix**: Renamed to `useActiveSessions()`, returns all active sessions as an array. TodayView shows a pill selector when multiple sessions exist so the user can switch between them. TopNavBar shows Today tab if any active session exists.

---

## Court Count — Editable During Registration Open

- **Symptom**: Admin could only set the number of courts (`sessions.court_count`) once, during the Setup phase (`SetupCard`), before registration opens. There was no way to adjust it later based on actual registrant turnout, even though the value already drove all court-card rendering dynamically (`lib/courts.ts`, `CourtTabs`, `useAdminSession`, `useCourtState`, LiveBoard).
  **Root cause**: `court_count` was only exposed as an editable input in `SetupCard`; `RegistrationURLCard` (the Registration Open screen) only exposed the registrant `max_players` limit ("Set Limit").
  **Fix**: Added a second Input + Button row ("# of courts" / "Set Courts") directly below the existing "Set Limit" row in `RegistrationURLCard.tsx`, updating `sessions.court_count` on save with the same validation rule as `SetupCard` (whole number ≥ 1). `SessionView.tsx` now passes `sessionId` and `courtCount` props through.
  **Note**: No changes were needed downstream — court-card rendering was already fully dynamic per `court_count`; this only added a second, later opportunity to set it. Verified live in a real browser (headed Playwright + seeded test data): setting the value to 4 on the Registration Open screen persisted through reload and correctly rendered 4 court cards (2 playing, 2 "No match playing") once the session went live.

---

## Court Count > 2 — Stale DB Check Constraint Silently Blocked Court 3+

- **Symptom**: With `court_count` set above 2, (a) clicking "Up" to promote a queued match onto court 3 threw `new row for relation "matches" violates check constraint "matches_court_number_check"`, and (b) starting a session with 3+ configured courts only filled courts 1–2 from the queue — courts 3+ silently stayed empty ("No match playing") with no visible error.
  **Root cause**: `matches.court_number` still had `CHECK (court_number IN (1, 2))` from migration `007_match_results_and_court.sql`, written before court count was configurable. Migration `066_add_court_count_to_sessions.sql` added `sessions.court_count` but never updated this constraint. Every write of `court_number > 2` was rejected at the DB level. `startSession()` in `useSession.ts` fired its per-court `matches` updates via `Promise.all(...)` without checking each result's `error` field, so the court-3+ rejections were silently swallowed — the match just stayed `queued` with no toast, making the failure look like a missing feature rather than an error.
  **Fix**: Migration `070_widen_matches_court_number_check.sql` drops and recreates the constraint as `CHECK (court_number IS NULL OR court_number >= 1)`, matching the simple-range style already used elsewhere (e.g. `sessions_court_count_positive`). App code already bounds real assignments to each session's configured `court_count`, so the DB doesn't need to know the per-session limit. Also hardened `startSession()` to inspect each `Promise.all` result's `error` and `toast.error(...)` on the first failure instead of swallowing it.
  **Rule**: When a DB check constraint encodes a value that later becomes admin-configurable (e.g. "always 2 courts" → `court_count`), grep migrations for every hardcoded reference to the old fixed value — a new settings column alone doesn't relax constraints written against the old assumption. Also: never fire multiple Supabase writes via bare `Promise.all` without inspecting each `{ error }` — partial failures go completely silent otherwise.
  **Environment note**: This project's Supabase CLI isn't logged in in this environment (`supabase login` / `SUPABASE_ACCESS_TOKEN` unset), so `supabase db push` can't apply migrations here — matches the existing Windows CLI workaround in this file. The migration SQL was applied manually via the Supabase Dashboard SQL Editor, then verified live in a real browser.

---

## Registration Limit Reset on Reopen Registration

- **Symptom**: Setting a registrant limit ("Set Limit"), closing registration, then clicking "Reopen Registration" silently reverted the limit back to "No limit".
  **Root cause**: `max_players` lives on the `session_invitations` row (`035_add_max_players_to_invitations.sql`, nullable, `DEFAULT NULL`), not on `sessions`. `reopenRegistration()` in `useSession.ts` always `insert()`-ed a brand-new `session_invitations` row with no `max_players` passed, defaulting to `NULL`. The old row (with the real limit) was left behind, inactive and forgotten — and by the time reopen ran, `closeRegistration()` had already cleared the in-memory `invitation` state to `null`, so there was nothing to carry the value forward from either.
  **Fix**: `reopenRegistration()` no longer inserts a new invitation row. It looks up the most recent `session_invitations` row for the session (`order('created_at', {ascending:false}).limit(1)`) and reactivates it (`update({ is_active: true })` by `id`), instead of creating a fresh one. Same row ⇒ `max_players` (and the registration link/token itself) survive close→reopen cycles automatically. No DB migration needed — pure application-logic fix.
  **Rule**: When "reopening"/"reactivating" something re-inserts a new row instead of flipping a status flag on the existing one, any other column on that row that isn't explicitly carried forward gets silently reset to its default. Prefer reactivating the existing row over recreating it unless there's a specific reason to mint a new identity (e.g. security-rotated tokens) — ask before assuming insert-new is intended.

---

## Roster Level-Override Doesn't Affect Match Generation Until Refresh

- **Symptom**: On the session admin page (`registration_closed` status), editing a player's level/gender override in the Roster panel, or adding a new player via "Add player", did not affect the Match Schedule generator's settings/output until the page was manually refreshed.
  **Root cause**: `RosterPanel` (via `useRoster`) and `MatchGeneratorPanel` (via `useRegisteredPlayers`) are sibling components in `SessionView`, each holding its **own independent `useState` copy** of the roster — there is no shared cache/store (no React Query/Zustand in this app). The only mechanism meant to keep them in sync was a Supabase Realtime `postgres_changes` subscription on `session_registrations` in each hook, but that table was **never added to the `supabase_realtime` publication** (same class of bug as `041_notifications_realtime.sql`), so those subscriptions silently never fired. Each hook's data only ever refreshed on mount, which is why a full page reload "fixed" it.
  **Fix**: Added a `rosterVersion` counter in `SessionView`, bumped via an `onRosterChange` callback passed into `RosterPanel`/`useRoster` (fired after `addPlayer`/`removePlayer`/`updateSessionOverride` succeed). `MatchGeneratorPanel` passes this version into `useRegisteredPlayers(sessionId, refreshKey)`, whose fetch `useEffect` now depends on it — forcing an immediate refetch on every roster mutation, independent of Realtime. Left the dead-Realtime-publication issue itself unfixed (see below) since the code fix removes the dependency on it entirely and is more robust.
  **Follow-up (not resolved)**: Wrote `supabase/migrations/070_session_registrations_realtime.sql` to add `session_registrations` to the realtime publication (harmless, matches existing pattern), but the DEV Supabase project's remote migration-history table (`supabase_migrations.schema_migrations`) has corrupted duplicate rows for versions 037–044 (full filename stems instead of bare version numbers, e.g. `037_profiles_authenticated_read_all` alongside a clean `037`) that block `supabase db push` and can't be removed via `supabase migration repair` (its version-arg parser rejects non-numeric strings). Also found the DEV project was 34 migrations behind local files before this task — repaired history bookkeeping for 037–069 (`migration repair --status applied`) to match the schema (verified via REST that those migrations' columns/tables already existed), but the actual DB push of 070 is still blocked pending manual cleanup via direct SQL access (Supabase Dashboard → SQL Editor, or psql) to delete the malformed rows.
  **Rule**: When two components independently fetch the same session-scoped data and need to stay in sync on the same page, don't rely on Supabase Realtime alone — it has already failed silently here twice (041, and this one) because the publication step is easy to forget and there's no compile-time or runtime signal when it's missing. Prefer a same-page state-sync mechanism (lifted state, or a version/refetch-key prop) as the primary fix; treat Realtime as a nice-to-have for cross-device/cross-tab sync only.

---

## Generate Schedule Button Does Nothing (Silent Empty Schedule)

- **Symptom**: Clicking "Generate Schedule" appeared to run (brief loading state) but produced no visible result — Optimizer Score showed `0`, all audit metrics `0`, and the match list was empty. No error, no toast. Reproduced with the untouched original roster (6 players, levels 2/5/5/2/8/6), so unrelated to the roster-sync fix above.
  **Root cause**: `src/lib/matchGenerator.ts` `buildAssignment()` (called from `generateScheduleOptimized` with `allowRelaxSpread = false` for its Phase-1 seed) skips a match slot entirely — pushes nothing to `schedule` — when `findValidGroup()` can't find any 4-player group within `maxSpreadLimit`, because the fallback (`candidates.slice(0, 4)`) was gated behind `allowRelaxSpread`. With the UI's default "Max Skill Gap per Match" = 2 and this roster's levels (2,2,5,5,6,8), the tightest possible 4-player spread is 3 — no group can ever satisfy the limit, so *every* slot gets skipped and `buildAssignment` returns `[]`. The SA phase (`optimizeAssignment`) then has nothing to optimize, `evaluateSessionScore([])` correctly scores an empty schedule as `0`, and `bestMatches` (initialized to `[]`) never gets replaced since `0 > -Infinity` only assigns on the very first start, freezing the result at "0 matches, 0 score" — which looks exactly like the button did nothing.
  **Fix**: In `buildAssignment`, removed the `allowRelaxSpread &&` guard from the fallback branch (`matchGenerator.ts` ~line 229) so a match slot always gets filled with the best-available 4 candidates when no fully-compliant group exists, regardless of the phase-1 `allowRelaxSpread` flag. This guarantees a full `numMatches`-length schedule is always built; the SA phase and scorer then surface the real constraint violations (e.g. "Skill Gap Violations: 20") instead of the engine silently producing nothing. Verified live: with Max Skill Gap left at the default 2, the schedule now generates all 20 matches with a real (negative) score and a visible Skill Gap Violations count, instead of 0/0/empty.
  **Rule**: Never let an optimizer's "no valid candidate" case silently drop output — always fall back to a best-effort candidate and let the scorer/audit report the constraint violation. Silent empty results are indistinguishable from "the button is broken."

---

## Eligible Substitutes List Included Players Already Playing Elsewhere

- **Symptom**: Opening the "Eligible Substitutes" panel for a match could list players who were, at that exact moment, playing an in-progress match on a different court — physically unavailable to sub in.
  **Root cause**: `getEligibleSubstitutes()` in `CourtTabs.tsx` only excluded (1) the target match's own players and (2) players scheduled in "the next game" (`nextGameNumber`, matched by game-number equality against `allActiveMatches`). It never excluded players currently on court in *other* in-progress matches unless that specific match happened to equal the next-game-number lookup — any other currently-playing match (different game number, not "next") was invisible to the exclusion logic entirely.
  **Fix**: Extracted the function to `src/lib/substitutes.ts` (for testability) and added a `currentlyPlayingMatches` parameter — built from `courts.map(c => c.current)` in `CourtTabs.tsx` — whose players are unconditionally added to the busy set, in addition to the existing next-game and own-match exclusions. Queued (not-yet-playing) players remain eligible as before.
  **Rule**: When "who's busy" is derived by matching a computed key (like `nextGameNumber`) against a merged list, an entity can be busy for a completely different, structural reason (e.g. "currently on court") that the key-matching approach doesn't cover. List every distinct reason an entity can be unavailable and exclude for each one explicitly, rather than relying on one lookup to catch all cases.

---

## Finance Page Could Not Compute Completed-Only Totals (Missing `status` on Finance RPC)

- **Symptom**: Adding "All Sessions" and "Completed" gain/loss totals to `/finance` was blocked — the page had no way to tell a completed session from an in-flight one, so the completed-only total could not be computed at all.
  **Root cause**: `FinanceView` is fed entirely by `useFinanceSessions` → `supabase.rpc('get_session_finance', {})`. That function's `RETURNS TABLE` (last defined in `065_add_shuttle_allocation_mode.sql`) exposes 16 columns — revenue, costs, profit, counts, allocation mode — but never `sessions.status`. The status column exists and is `NOT NULL DEFAULT 'setup'` on the table, it simply was never projected through the RPC, and the finance surface has no other read path to `sessions`.
  **Fix**: Added `074_add_status_to_get_session_finance.sql`, a signature-only change appending `status public.session_status` to the `RETURNS TABLE` and `s.status` to the final projection. The function's outer `SELECT` already did `JOIN public.sessions s ON s.id = fb.session_id`, so no CTE or query restructuring was needed and no existing computed column changed value (verified by diffing the new migration body against 065 — the only differences are the two appended lines). Postgres cannot alter a function's return type in place, so this DROPs and re-CREATEs, matching the pattern of 060 and 065. Mirrored the new field into the hand-maintained `src/types/database.ts`, then summed `profit_after_personal_share` in a new pure exported `summarizeFinanceTotals()` helper.
  **Rule**: When adding a `DROP FUNCTION` + `CREATE` migration for an RPC, always re-issue the `GRANT` afterwards — dropping a function discards its privileges, and forgetting it breaks the feature for every user with no schema-level error to point at. Two more traps worth naming for any money rollup: (1) `NUMERIC(10,2)` arrives in JS as a float, so summing many rows drifts (e.g. `4199.999999999999`) — round once at the end of the reduce, matching `calculateProfitAfterPersonalShare`'s `Number(x.toFixed(2))`; (2) when a fetch fails, `useFinanceSessions` leaves `sessions` as `[]` and clears `isLoading`, so a naive total renders a confident `₱0.00` that a user reads as "exactly break-even" rather than "the data didn't load" — render a placeholder on the error branch instead.

---

## Storage Objects Orphaned by a DB Cascade (Payment Receipts)

- **Symptom**: Caught during `/speckit-analyze` on feature `005-payment-receipt-upload`, before any code shipped. The receipt-upload design specified "delete the storage object before the row" at two call sites — a player deleting their own receipt, and an admin deleting a session. A third path existed and was missed: an admin removing a player from the roster.
  **Root cause**: `session_receipts.registration_id` is `ON DELETE CASCADE`, so `useRoster.removePlayer` (`useRoster.ts:122`) silently disposes of that player's receipt rows as a side effect of deleting the registration. A Postgres cascade deletes rows but has **no reach into Supabase Storage**, and the row is the only place `storage_path` is recorded. Deleting the registration first therefore strands the image in the bucket permanently — unreachable through the app, undeletable (nothing knows the filename any more), and still readable by anyone whose storage RLS matches the path. No error, no failing test, and the UI looks entirely correct.
  **Fix**: Added the cleanup to `removePlayer` — query the registration's `storage_path` values, `storage.remove()` them, abort on failure, and only then delete the registration. Same treatment already applied at `AdminView.tsx` (session delete) and in `useSessionReceipts.deleteReceipt`. Also kept the admin `DELETE` policy on the **bucket** while deliberately omitting it on the **table**: two of the three cleanup paths have an admin deleting another player's files, so removing the bucket policy as "unused" would have broken the fix on contact. Covered by an E2E assertion that checks the bucket, not just the rows.
  **Rule**: A `ON DELETE CASCADE` into a table that stores external object keys is a silent leak generator. Before shipping any feature where a DB row points at a Storage object, enumerate **every** path that can delete that row — including cascades fired as a side effect of deleting a *parent* — and clean the object up first at each one. Cascade paths are the dangerous ones precisely because nobody in that code flow is thinking about the child entity. Also: a test that asserts "the rows are gone" proves nothing here — the rows always vanish cleanly. Assert against the bucket.

---

## `getPublicUrl()` Fails Silently on a Private Supabase Bucket

- **Symptom**: Anticipated and designed around rather than hit, but worth recording because every existing upload example in this repo points the wrong way. `receipts` (migration 076) is the codebase's first **private** bucket; `avatars` (069) and `payment-qr` (073) are both `public = true`.
  **Root cause**: `supabase.storage.from(bucket).getPublicUrl(path)` is a pure string builder — it does not contact the server and never returns an error. On a private bucket it hands back a well-formed URL that resolves to nothing. Copying the avatar upload pattern into a private-bucket feature therefore produces broken images with no exception, no console error, and no failing request to notice.
  **Fix**: All receipt reads go through `createSignedUrl(path, 60)`, minted at view time from the caller's own JWT against the storage SELECT policy — so a player signs their own and an admin signs anyone's, with no service-role key involved. The 60-second TTL means a URL leaked into browser history or a screen-share is inert. Left explicit "never getPublicUrl()" comments at both call sites.
  **Rule**: Bucket privacy is a single boolean at creation time, and the client API gives you no feedback when you use the wrong accessor for it. When adding a private bucket to a codebase whose existing buckets are public, assume every copied upload snippet is wrong until its read path is switched to `createSignedUrl`.
