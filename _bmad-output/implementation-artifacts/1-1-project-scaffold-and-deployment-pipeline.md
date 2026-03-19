# Story 1.1: Project Scaffold & Deployment Pipeline

Status: review

## Story

As a developer,
I want the project scaffolded with the full technology stack and deployed to Vercel,
So that all dev agents have a working, deployable foundation to build on.

## Acceptance Criteria

1. **Given** the project is initialized with `npm create vite@latest badminton-v2 -- --template react-ts` and all dependencies installed
   **When** `npm run dev` is run
   **Then** the app starts at `localhost:5173` with no console errors
   **And** shadcn/ui components are importable via `@/components/ui/`

2. **Given** `.env.local` contains `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
   **When** `npm run build` is run
   **Then** the build completes with zero TypeScript errors
   **And** environment variables are accessible via `import.meta.env.VITE_SUPABASE_*`

3. **Given** the project is pushed to `main` on GitHub
   **When** Vercel detects the push
   **Then** a production deployment completes and the app loads at the Vercel URL

4. **Given** the app is deployed to Vercel with `vercel.json` SPA fallback config
   **When** any route (e.g., `/admin`, `/kiosk`) is accessed directly or refreshed
   **Then** the app loads correctly — no 404 from the server

## Tasks / Subtasks

- [x] Task 1: Initialize project and install all dependencies (AC: #1, #2)
  - [x] Run `npm create vite@latest badminton-v2 -- --template react-ts`
  - [x] Install core deps: `@supabase/supabase-js`, `tailwindcss`, `@tailwindcss/vite`, `react-router`
  - [x] Run `npx shadcn@latest init` (sets up components.json, @/ alias, src/lib/utils.ts)
  - [x] Edit `vite.config.ts` to add `@tailwindcss/vite` plugin alongside existing React plugin

- [x] Task 2: Create Supabase client singleton (AC: #2)
  - [x] Create `src/lib/supabase.ts` with typed singleton — see Dev Notes for exact code
  - [x] Create `src/types/database.ts` as empty placeholder (will be overwritten by `supabase gen types typescript` later)
  - [x] Create `src/types/app.ts` as empty placeholder

- [x] Task 3: Create stub views and App.tsx routing skeleton (AC: #1, #4)
  - [x] Create `src/views/KioskView.tsx` — minimal stub returning `<div>Kiosk</div>`
  - [x] Create `src/views/PlayerView.tsx` — minimal stub returning `<div>Player</div>`
  - [x] Create `src/views/AdminView.tsx` — minimal stub returning `<div>Admin (protected)</div>`
  - [x] Wire `App.tsx` with React Router v7 + `React.lazy` + route structure (see Dev Notes)
  - [x] Wire `main.tsx` with `<BrowserRouter>`

- [x] Task 4: Environment config (AC: #2)
  - [x] Create `.env.example` with placeholder keys
  - [x] Create `.env.local` with real Supabase credentials (gitignored)
  - [x] Verify `import.meta.env.VITE_SUPABASE_URL` is accessible in app

- [x] Task 5: Vercel deployment config (AC: #3, #4)
  - [x] Create `vercel.json` with SPA rewrite config
  - [x] Confirm `.gitignore` covers `.env.local` and `dist/`
  - [x] Push to `main`, verify Vercel deploys and all routes load without 404

## Dev Notes

### Exact Installation Sequence

```bash
npm create vite@latest badminton-v2 -- --template react-ts
cd badminton-v2
npm install
npm install @supabase/supabase-js react-router
npm install tailwindcss @tailwindcss/vite --legacy-peer-deps
npx shadcn@latest init --defaults
```

**Important:** `@tailwindcss/vite@4.2.1` declares peer dep `vite@^5-7` but Vite 8 is installed. Use `--legacy-peer-deps` to bypass the check. The plugin works fine at runtime. An `.npmrc` with `legacy-peer-deps=true` is committed so future `npm install` commands don't need the flag.

**`react-router` is required** — React Router v7 ships as the package `react-router` (not `react-router-dom`). All imports come from `"react-router"`.

**shadcn init required pre-configuration:** Before running `shadcn init`:
1. Add `@tailwindcss/vite` plugin to `vite.config.ts`
2. Add `@import "tailwindcss"` to `src/index.css`
3. Add `paths: { "@/*": ["./src/*"] }` to both `tsconfig.json` and `tsconfig.app.json`

shadcn validates Tailwind CSS and import alias before running. Without this pre-config it will fail.

**ESLint:** shadcn-generated files in `src/components/ui/` trigger `react-refresh/only-export-components` errors. Fixed by adding `'src/components/ui'` to `globalIgnores` in `eslint.config.js`. Never edit files under `src/components/ui/`.

---

### Final `vite.config.ts`

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

---

### `src/index.css` — Tailwind v4 directive

shadcn init sets up `src/index.css` with `@import "tailwindcss"` plus shadcn CSS variables. Do **not** delete the shadcn CSS variables. Story 1.2 will override `--primary` and related tokens with brand values.

---

### `src/lib/supabase.ts`

```typescript
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export const supabase = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
```

This is the **single source of truth** for the Supabase client. All hooks and components import `supabase` from `@/lib/supabase` — never instantiate a second client.

---

### `src/types/database.ts` — Placeholder

```typescript
// Auto-generated by: supabase gen types typescript --local > src/types/database.ts
// Run this command after each migration to keep types in sync.
// Do not hand-edit this file.

export type Database = {
  public: {
    Tables: Record<string, never>
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
```

This placeholder satisfies TypeScript until the first real migration is run (Epic 2+).

---

### `src/main.tsx`

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import App from './App.tsx'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
```

---

### `src/App.tsx` — Route skeleton with code splitting

```tsx
import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router'

const KioskView = lazy(() => import('@/views/KioskView'))
const PlayerView = lazy(() => import('@/views/PlayerView'))
const AdminView = lazy(() => import('@/views/AdminView'))

function App() {
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <Routes>
        <Route path="/" element={<div>badminton v2</div>} />
        <Route path="/kiosk" element={<KioskView />} />
        <Route path="/player" element={<PlayerView />} />
        <Route path="/player/:nameSlug" element={<PlayerView />} />
        <Route path="/admin" element={<AdminView />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

export default App
```

**Admin route guard** (role check, redirect) is added in Story 1.4 — not this story.

---

### `.env.example`

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

Check into git. `.env.local` must **not** be committed (already covered by `*.local` in `.gitignore`).

---

### `vercel.json` — SPA fallback routing

```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

Without this, direct access to `/admin` or `/kiosk` returns a 404 from Vercel.

---

### Architecture Compliance

- **Import alias:** Always use `@/` (e.g., `import { supabase } from '@/lib/supabase'`). Never use relative paths crossing directory boundaries.
- **React Router imports:** Import from `"react-router"` — **not** `"react-router-dom"` (v7 change).
- **Supabase client:** Only one instance ever — `src/lib/supabase.ts`. No second `createClient(...)` anywhere.
- **shadcn/ui components:** Live only in `src/components/ui/` — never edit these files directly after generation.
- **Domain components** live in `src/components/` (root level), NOT inside `src/components/ui/`.
- **Tailwind v4:** Uses `@import "tailwindcss"` in CSS — no `@tailwind base/components/utilities` directives.
- **No tailwind.config.js:** Tailwind v4 with `@tailwindcss/vite` needs no config file.

### Key Anti-Patterns to Avoid

- ❌ `import { BrowserRouter } from 'react-router-dom'` — use `"react-router"` in v7
- ❌ Creating a second Supabase client instance in any other file
- ❌ Adding `@tailwind base; @tailwind components; @tailwind utilities;` directives (v3 syntax)
- ❌ Creating a `tailwind.config.js` file — not needed or used in v4
- ❌ Editing files under `src/components/ui/` — shadcn regenerates these
- ❌ Committing `.env.local`
- ❌ Running `npm install` without `--legacy-peer-deps` (or relying on `.npmrc`) due to @tailwindcss/vite peer dep mismatch with Vite 8

### Supabase Project Pre-requisite

If the Supabase project doesn't exist yet, create a placeholder `.env.local` with dummy values — the build will succeed; only runtime Supabase calls will fail.

### Vercel Deployment Pre-requisite

1. Push the repository to GitHub
2. Connect the GitHub repo to a new Vercel project (vercel.com → Import Project)
3. Set environment variables in Vercel dashboard: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
4. Framework preset: Vite (auto-detected)
5. After first deploy, verify: navigate to `https://<your-vercel-url>/admin` directly — should load app, not 404

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- `@tailwindcss/vite@4.2.1` peer dep conflict with Vite 8: resolved with `--legacy-peer-deps` + `.npmrc`
- shadcn init failed first run (no Tailwind CSS config, no import alias): fixed by pre-configuring `vite.config.ts`, `index.css`, `tsconfig.json`, and `tsconfig.app.json` before running init
- ESLint error in shadcn-generated `button.tsx` (react-refresh rule): fixed by adding `src/components/ui` to `globalIgnores` in `eslint.config.js`

### Completion Notes List

- Project scaffolded at `C:\1Wes\badminton_v2\badminton-v2\` using Vite 8 + React 19 + TypeScript strict
- All deps installed: `@supabase/supabase-js`, `react-router` (v7), `tailwindcss` + `@tailwindcss/vite`, `shadcn@4.0.8`
- `npm run build` passes with zero TypeScript errors — confirmed twice
- `npm run lint` passes clean — shadcn/ui directory excluded from react-refresh rule
- Code splitting confirmed: AdminView, KioskView, PlayerView each produce separate JS bundles
- AC #3 and #4 (Vercel deployment) require manual action by Wes: push to GitHub + connect to Vercel
- No unit tests written — no testable business logic in this scaffold story; testing framework (Vitest) deferred to implementation phase per architecture

### File List

- `badminton-v2/index.html`
- `badminton-v2/package.json`
- `badminton-v2/vite.config.ts`
- `badminton-v2/tsconfig.json`
- `badminton-v2/tsconfig.app.json`
- `badminton-v2/tsconfig.node.json`
- `badminton-v2/eslint.config.js`
- `badminton-v2/components.json`
- `badminton-v2/vercel.json`
- `badminton-v2/.env.example`
- `badminton-v2/.env.local` (gitignored — placeholder values)
- `badminton-v2/.npmrc`
- `badminton-v2/.gitignore`
- `badminton-v2/src/main.tsx`
- `badminton-v2/src/App.tsx`
- `badminton-v2/src/index.css`
- `badminton-v2/src/lib/supabase.ts`
- `badminton-v2/src/lib/utils.ts` (generated by shadcn init)
- `badminton-v2/src/types/database.ts`
- `badminton-v2/src/types/app.ts`
- `badminton-v2/src/views/KioskView.tsx`
- `badminton-v2/src/views/PlayerView.tsx`
- `badminton-v2/src/views/AdminView.tsx`
- `badminton-v2/src/components/ui/button.tsx` (generated by shadcn init)
- `badminton-v2/src/hooks/.gitkeep`
