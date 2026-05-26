# Repository Guidelines

## Project Structure & Module Organization
The active application lives in `badminton-v2/`. Most contributor work should happen there.

- `badminton-v2/src/`: React + TypeScript source.
- `badminton-v2/src/components`, `views`, `hooks`, `contexts`, `layouts`, `lib`, `types`, `utils`: feature and shared modules.
- `badminton-v2/src/__tests__/`: Vitest unit tests.
- `badminton-v2/tests/`: Playwright end-to-end specs.
- `badminton-v2/public/`: static assets served by Vite.
- `badminton-v2/supabase/migrations/`: database schema changes.
- Root-level folders such as `tasks/`, `old_app_references/`, and `_bmad-output/` are planning or legacy material, not the main app runtime.

## Build, Test, and Development Commands
Run commands from `badminton-v2/`.

- `npm run dev`: start the Vite dev server on `http://localhost:5173`.
- `npm run build`: type-check with `tsc -b` and build production assets.
- `npm run preview`: serve the production build locally.
- `npm run lint`: run ESLint across the app.
- `npm run test:unit`: run Vitest unit tests once.
- `npm run test:unit:watch`: run Vitest in watch mode.
- `npm run test:e2e`: run Playwright browser tests.
- `npm run seed -- --sessions 2`: seed test users and session data for E2E flows.

## Coding Style & Naming Conventions
Use TypeScript with 2-space indentation and existing import aliases such as `@/views/HomeView`. Follow the prevailing style: PascalCase for React components and view files (`SessionView.tsx`), camelCase for functions and hooks (`useFinanceSessions`), and kebab-case for Playwright specs (`registration-limit.spec.ts`). Do not edit generated output in `dist/`. Linting is enforced with `eslint.config.js`; `src/components/ui` is intentionally ignored.

## Testing Guidelines
Unit tests use Vitest and should be named `*.test.ts` under `src/`. E2E tests use Playwright and should be named `*.spec.ts` under `tests/`. Keep unit tests deterministic and seed-backed E2E tests isolated. Before opening a PR, run `npm run lint`, `npm run test:unit`, and any affected `npm run test:e2e` coverage.

## Commit & Pull Request Guidelines
Recent history uses scoped conventional commits such as `feat(11-02): ...` and `docs(phase-11): ...`. Prefer `feat`, `fix`, `docs`, `refactor`, and `test`, with a short scope when helpful. PRs should include a concise summary, impacted areas, linked task or issue, and screenshots for UI changes. Call out Supabase migrations, seed-data changes, and new environment variables explicitly.

## Security & Configuration Tips
Keep secrets in local `.env` files and use `.env.example` as the shareable template. Playwright and seed scripts expect Supabase values to be present; never commit service-role credentials.

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
<!-- SPECKIT END -->
