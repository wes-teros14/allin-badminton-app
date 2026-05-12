# Codebase Structure

**Analysis Date:** 2026-05-12

## Directory Layout

```text
[project-root]/
├── badminton-v2/            # Active Vite + React application
├── .planning/               # GSD project state, plans, and generated codebase docs
├── tasks/                   # Planning/task artifacts outside runtime
├── old_app_references/      # Legacy reference material
├── temporary_files/         # Temporary workspace artifacts
├── _bmad/                   # BMAD workflow/config assets
└── _bmad-output/            # Generated BMAD outputs
```

## Directory Purposes

**`badminton-v2/`:**
- Purpose: Main application and the only runtime subtree that ships the product.
- Contains: `src/`, `public/`, `supabase/migrations/`, `tests/`, `scripts/`, build output/config files
- Key files: `badminton-v2/package.json`, `badminton-v2/src/main.tsx`, `badminton-v2/src/App.tsx`

**`badminton-v2/src/`:**
- Purpose: Application source code.
- Contains: Route views, components, hooks, contexts, layouts, libs, types, utilities, unit tests
- Key files: `badminton-v2/src/App.tsx`, `badminton-v2/src/lib/supabase.ts`, `badminton-v2/src/lib/matchGenerator.ts`

**`badminton-v2/src/views/`:**
- Purpose: Route-level screens.
- Contains: Player, admin, finance, inventory, registration, leaderboard, and live-board pages
- Key files: `badminton-v2/src/views/SessionView.tsx`, `badminton-v2/src/views/RegisterView.tsx`, `badminton-v2/src/views/FinanceView.tsx`

**`badminton-v2/src/hooks/`:**
- Purpose: Stateful feature logic and Supabase access.
- Contains: Session lifecycle hooks, player schedule hooks, realtime subscriptions, finance/inventory hooks
- Key files: `badminton-v2/src/hooks/useSession.ts`, `badminton-v2/src/hooks/useRegistration.ts`, `badminton-v2/src/hooks/useSessionFinance.ts`

**`badminton-v2/src/components/`:**
- Purpose: Reusable UI fragments composed by views.
- Contains: Domain-specific panels/cards plus vendored `ui/` primitives
- Key files: `badminton-v2/src/components/TopNavBar.tsx`, `badminton-v2/src/components/CourtTabs.tsx`, `badminton-v2/src/components/ui/table.tsx`

**`badminton-v2/src/contexts/`:**
- Purpose: App-wide state shared through React context.
- Contains: Auth and notification providers
- Key files: `badminton-v2/src/contexts/AuthContext.tsx`, `badminton-v2/src/contexts/NotificationContext.tsx`

**`badminton-v2/src/lib/`:**
- Purpose: Shared non-UI logic.
- Contains: Supabase client setup, match generation engine, generic utility helpers
- Key files: `badminton-v2/src/lib/supabase.ts`, `badminton-v2/src/lib/matchGenerator.ts`, `badminton-v2/src/lib/utils.ts`

**`badminton-v2/src/types/`:**
- Purpose: Shared TypeScript contracts.
- Contains: App-level types and generated database types
- Key files: `badminton-v2/src/types/app.ts`, `badminton-v2/src/types/database.ts`

**`badminton-v2/src/utils/`:**
- Purpose: Small formatting helpers that do not warrant a full domain module.
- Contains: Presentation-oriented utilities
- Key files: `badminton-v2/src/utils/formatPeso.ts`

**`badminton-v2/src/__tests__/`:**
- Purpose: Vitest unit tests colocated under source.
- Contains: Pure logic and hook tests plus fixtures
- Key files: `badminton-v2/src/__tests__/matchGenerator.test.ts`, `badminton-v2/src/__tests__/useSessionFinance.test.ts`

**`badminton-v2/tests/`:**
- Purpose: Playwright end-to-end coverage.
- Contains: Browser specs driven against the Vite dev server
- Key files: `badminton-v2/tests/registration-limit.spec.ts`

**`badminton-v2/scripts/`:**
- Purpose: Operational scripts for seeding and manual data maintenance.
- Contains: `tsx` seeders plus helper SQL files
- Key files: `badminton-v2/scripts/seed-test-users.ts`, `badminton-v2/scripts/copy-prod-profiles-to-dev.ts`

**`badminton-v2/supabase/migrations/`:**
- Purpose: Database schema and backend behavior definitions.
- Contains: Ordered SQL migrations for tables, RLS, triggers, RPCs, and finance/inventory changes
- Key files: `badminton-v2/supabase/migrations/001_create_profiles.sql`, `badminton-v2/supabase/migrations/058_create_get_session_finance.sql`, `badminton-v2/supabase/migrations/061_add_shuttles_per_tube_to_shuttle_batches.sql`

**`.planning/`:**
- Purpose: Planning-system source of truth used by GSD workflows.
- Contains: `STATE.md`, milestone/phase plans, generated codebase maps
- Key files: `.planning/STATE.md`, `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/STRUCTURE.md`

## Key File Locations

**Entry Points:**
- `badminton-v2/index.html`: Vite HTML entry document
- `badminton-v2/src/main.tsx`: Browser bootstrap and router mount
- `badminton-v2/src/App.tsx`: Route graph and provider composition

**Configuration:**
- `badminton-v2/package.json`: Scripts and dependencies
- `badminton-v2/tsconfig.json`: TS project references and path alias root
- `badminton-v2/vite.config.ts`: Vite plugins and `@` alias
- `badminton-v2/eslint.config.js`: Lint rules and ignored paths
- `badminton-v2/vitest.config.ts`: Unit-test include pattern and alias
- `badminton-v2/playwright.config.ts`: E2E runner configuration and local dev server boot

**Core Logic:**
- `badminton-v2/src/hooks/useSession.ts`: Admin session workflow
- `badminton-v2/src/hooks/useRegistration.ts`: Public invitation registration workflow
- `badminton-v2/src/hooks/useSessionFinance.ts`: Finance detail state and shuttle allocation
- `badminton-v2/src/lib/matchGenerator.ts`: Match scheduling engine
- `badminton-v2/src/lib/supabase.ts`: Typed Supabase client

**Testing:**
- `badminton-v2/src/__tests__/`: Unit tests
- `badminton-v2/tests/`: Playwright specs
- `badminton-v2/src/__tests__/fixtures/`: Test data helpers

## Naming Conventions

**Files:**
- Route views and major components use PascalCase: `badminton-v2/src/views/SessionView.tsx`
- Hooks use `use*.ts`: `badminton-v2/src/hooks/useRealtime.ts`
- Generic helpers use lower camel or noun phrases in lowercase filenames: `badminton-v2/src/lib/utils.ts`, `badminton-v2/src/utils/formatPeso.ts`
- Unit tests use `*.test.ts`: `badminton-v2/src/__tests__/matchGenerator.scoring.test.ts`
- Playwright specs use kebab-case `*.spec.ts`: `badminton-v2/tests/registration-limit.spec.ts`

**Directories:**
- Source groupings are lowercase plural buckets by role: `badminton-v2/src/views`, `badminton-v2/src/hooks`, `badminton-v2/src/components`
- Vendored shadcn primitives live under a dedicated lowercase subtree: `badminton-v2/src/components/ui`

## Where to Add New Code

**New Feature:**
- Primary code: add the route screen in `badminton-v2/src/views/` and feature state/data logic in `badminton-v2/src/hooks/`
- Tests: add unit coverage in `badminton-v2/src/__tests__/` and browser coverage in `badminton-v2/tests/` when the feature crosses page flows

**New Component/Module:**
- Implementation: put reusable display pieces in `badminton-v2/src/components/`; keep route-specific orchestration in the owning file under `badminton-v2/src/views/`

**Utilities:**
- Shared helpers: put pure domain algorithms in `badminton-v2/src/lib/` and lightweight formatting/presentation helpers in `badminton-v2/src/utils/`

**New Database Behavior:**
- Schema/RLS/RPC changes: create a new ordered SQL migration in `badminton-v2/supabase/migrations/`
- Client typing touchpoints: update consumers that depend on `badminton-v2/src/types/database.ts`

**New Operational Script:**
- Seed/admin scripts: place `tsx` or `.sql` utilities in `badminton-v2/scripts/`

## Special Directories

**`badminton-v2/src/components/ui/`:**
- Purpose: Reusable UI primitives used across views and components
- Generated: Yes
- Committed: Yes

**`badminton-v2/dist/`:**
- Purpose: Vite production build output
- Generated: Yes
- Committed: Yes

**`badminton-v2/playwright-report/`:**
- Purpose: Playwright HTML test reports
- Generated: Yes
- Committed: Yes

**`badminton-v2/test-results/`:**
- Purpose: Playwright run artifacts
- Generated: Yes
- Committed: Yes

**`badminton-v2/.vercel/output/`:**
- Purpose: Vercel build/export artifacts
- Generated: Yes
- Committed: Yes

**`badminton-v2/html/`:**
- Purpose: Snapshot/export-style static output separate from `dist/`
- Generated: Yes
- Committed: Yes

---

*Structure analysis: 2026-05-12*
