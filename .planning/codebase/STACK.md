# Technology Stack

**Analysis Date:** 2026-05-12

## Languages

**Primary:**
- TypeScript 5.9.x - Frontend app, Supabase client access, Playwright specs, and Node utility scripts in `badminton-v2/src/`, `badminton-v2/tests/`, and `badminton-v2/scripts/`
- SQL - Database schema, RLS, triggers, realtime publication, cron, and finance functions in `badminton-v2/supabase/migrations/`

**Secondary:**
- CSS - App styling and Tailwind v4 entry CSS in `badminton-v2/src/index.css` and `badminton-v2/src/App.css`
- HTML - Vite entry document in `badminton-v2/index.html`

## Runtime

**Environment:**
- Node.js v22.22.2 - Local development/runtime detected in the workspace
- Browser runtime - React SPA bundled by Vite and served from static assets

**Package Manager:**
- npm 10.9.7
- Lockfile: present in `badminton-v2/package-lock.json` (lockfileVersion 3)

## Frameworks

**Core:**
- React 19.2.4 - UI runtime in `badminton-v2/src/main.tsx` and `badminton-v2/src/App.tsx`
- React Router 7.13.1 - Client-side routing in `badminton-v2/src/App.tsx`
- Supabase JS 2.99.2 - Auth, PostgREST, Realtime, and RPC client in `badminton-v2/src/lib/supabase.ts`
- Tailwind CSS 4.2.1 - Utility styling via `@tailwindcss/vite` in `badminton-v2/vite.config.ts` and `badminton-v2/src/index.css`

**Testing:**
- Vitest 2.0.0 - Unit tests via `badminton-v2/vitest.config.ts`
- Playwright 1.58.2 - Browser E2E tests via `badminton-v2/playwright.config.ts`

**Build/Dev:**
- Vite 8.0.0 - Dev server and production bundler in `badminton-v2/package.json` and `badminton-v2/vite.config.ts`
- TypeScript project references - Type-check/build config in `badminton-v2/tsconfig.json`, `badminton-v2/tsconfig.app.json`, and `badminton-v2/tsconfig.node.json`
- ESLint 9.39.4 - Linting in `badminton-v2/eslint.config.js`
- shadcn CLI 4.0.8 - UI scaffold metadata in `badminton-v2/components.json`

## Key Dependencies

**Critical:**
- `@supabase/supabase-js` 2.99.2 - Single backend client for auth, database access, realtime subscriptions, and RPC calls; used throughout `badminton-v2/src/lib/supabase.ts`, `badminton-v2/src/contexts/AuthContext.tsx`, and `badminton-v2/src/hooks/`
- `react` 19.2.4 and `react-dom` 19.2.4 - SPA runtime in `badminton-v2/src/main.tsx`
- `react-router` 7.13.1 - Route protection and page composition in `badminton-v2/src/App.tsx`
- `zod` 4.3.6 and `react-hook-form` 7.71.2 with `@hookform/resolvers` 5.2.2 - Form validation stack used by finance/inventory flows in `badminton-v2/src/views/` and `badminton-v2/src/hooks/`

**Infrastructure:**
- `@vitejs/plugin-react` 6.0.0 - React integration for Vite in `badminton-v2/vite.config.ts`
- `@tailwindcss/vite` 4.2.1 - Tailwind v4 Vite plugin in `badminton-v2/vite.config.ts`
- `@playwright/test` 1.58.2 - E2E runner in `badminton-v2/playwright.config.ts`
- `vitest` 2.0.0 - Unit test runner in `badminton-v2/vitest.config.ts`
- `sonner` 2.0.7 - Toast notifications in `badminton-v2/src/contexts/NotificationContext.tsx` and `badminton-v2/src/components/DevLoginPanel.tsx`
- `@fontsource-variable/geist` 5.2.8 - Bundled typography assets used by the app bundle

## Configuration

**Environment:**
- Vite client config reads `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_APP_URL` via `import.meta.env` in `badminton-v2/src/lib/supabase.ts`, `badminton-v2/src/App.tsx`, and `badminton-v2/src/views/HomeView.tsx`
- Seed/admin scripts read `VITE_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` by manually parsing env files in `badminton-v2/scripts/seed-test-users.ts` and `badminton-v2/scripts/copy-prod-profiles-to-dev.ts`
- Env files present: `badminton-v2/.env`, `badminton-v2/.env.development`, `badminton-v2/.env.production`, and `badminton-v2/.env.example`
- Additional deployment-local env file present: `badminton-v2/.vercel/.env.preview.local`
- Auth-sensitive package-manager config file present: `badminton-v2/.npmrc`

**Build:**
- Vite config: `badminton-v2/vite.config.ts`
- TypeScript config: `badminton-v2/tsconfig.json`, `badminton-v2/tsconfig.app.json`, `badminton-v2/tsconfig.node.json`
- ESLint config: `badminton-v2/eslint.config.js`
- Vitest config: `badminton-v2/vitest.config.ts`
- Playwright config: `badminton-v2/playwright.config.ts`
- Vercel SPA rewrite config: `badminton-v2/vercel.json`
- shadcn/ui config: `badminton-v2/components.json`

## Platform Requirements

**Development:**
- Run commands from `badminton-v2/`
- Requires Node.js and npm
- Requires Supabase project credentials in local env files for app auth/data access
- Requires Supabase service-role credentials for seed/admin scripts and Playwright DB setup in `badminton-v2/scripts/` and `badminton-v2/tests/registration-limit.spec.ts`

**Production:**
- Static SPA deployment target on Vercel indicated by `badminton-v2/vercel.json` and generated `.vercel/` output
- Backend platform is Supabase Postgres/Auth/Realtime with schema managed by `badminton-v2/supabase/migrations/`

---

*Stack analysis: 2026-05-12*
