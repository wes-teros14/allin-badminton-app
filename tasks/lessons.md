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

## General

- **Always run `npm run build` + `npm run lint` before marking a story complete.** Both must pass clean.

- **Visual verification is the test for CSS/theming stories**: No unit tests needed for pure CSS work. Run `npm run dev` and check the browser.

- **`.kiosk-dark` is separate from shadcn's `.dark`**: Do not merge them. Kiosk dark mode is applied via explicit class on the KioskView root, not via `prefers-color-scheme`.
