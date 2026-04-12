# STACK.md — Technology Stack

## Runtime & Language

- **Language:** TypeScript ~5.9.3 (strict mode, ES2023 target)
- **Runtime:** Browser SPA — no server-side rendering
- **Module system:** ESNext modules (`"type": "module"`)
- **Build tool:** Vite 8 with `@vitejs/plugin-react`
- **Package manager:** npm (package-lock.json present)

## Frontend Framework

- **UI framework:** React 19
- **Routing:** React Router v7 (lazy-loaded views via `React.lazy`)
- **Styling:** Tailwind CSS v4 (`@tailwindcss/vite` plugin)
- **Component library:** shadcn/ui (Base UI backed — `@base-ui/react ^1.3.0`)
- **Class utilities:** `clsx` + `tailwind-merge` → `cn()` helper in `src/lib/utils.ts`
- **Theming:** `next-themes ^0.4.6`
- **Icons:** `lucide-react ^0.577.0`
- **Fonts:** Geist variable font via `@fontsource-variable/geist`
- **Animations:** `tw-animate-css`

## Forms & Validation

- **Form library:** React Hook Form v7 (`react-hook-form`)
- **Validation:** Zod v4 (`zod ^4.3.6`)
- **Resolver:** `@hookform/resolvers`

## Notifications / UI Feedback

- **Toast library:** Sonner v2 (`sonner ^2.0.7`)
- **Toast config:** `position="top-center"`, `offset={52}`, `fontSize: '1rem'`, 20s duration
- **Toaster mounting:** `App.tsx` root-level

## Backend / Database

- **Backend-as-a-service:** Supabase (`@supabase/supabase-js ^2.99.2`)
  - PostgreSQL database
  - Row-Level Security (RLS) policies
  - Realtime subscriptions
  - Auth (PKCE flow)
- **Client init:** `src/lib/supabase.ts` — typed via `Database` type from `src/types/database.ts`
- **Migrations:** 44 SQL migration files in `badminton-v2/supabase/migrations/`

## TypeScript Configuration

- **Strict mode:** enabled (`strict: true`)
- **Unused locals/params:** errors enforced
- **Path aliases:** `@/*` → `./src/*`
- **JSX:** `react-jsx`
- **Excluded from compile:** `src/__tests__` (only Vitest test files live there)

## Deployment

- **Host:** Vercel
- **Config:** `vercel.json` — all routes rewrite to `/index.html` (SPA routing)
- **Environments:** dev (`tsvetqzkullivprbjtli`) and prod (`ensdfitpeyreunihkqkh`) Supabase projects

## Environment Variables

- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Supabase anon key
- `VITE_APP_URL` — App base URL (used for OAuth redirects)

## Dev Tooling

- **Linter:** ESLint 9 with `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`
- **Unit tests:** Vitest v2 (`vitest.config.ts`)
- **E2E tests:** Playwright (`playwright.config.ts`)
- **DB seeding scripts:** `badminton-v2/scripts/` — TypeScript scripts run via `tsx`
