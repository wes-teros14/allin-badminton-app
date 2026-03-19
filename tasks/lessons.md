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

## General

- **Always run `npm run build` + `npm run lint` before marking a story complete.** Both must pass clean.

- **Visual verification is the test for CSS/theming stories**: No unit tests needed for pure CSS work. Run `npm run dev` and check the browser.

- **`.kiosk-dark` is separate from shadcn's `.dark`**: Do not merge them. Kiosk dark mode is applied via explicit class on the KioskView root, not via `prefers-color-scheme`.
