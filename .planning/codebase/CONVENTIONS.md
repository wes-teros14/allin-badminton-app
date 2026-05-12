# Coding Conventions

**Analysis Date:** 2026-05-12

## Naming Patterns

**Files:**
- Use `PascalCase.tsx` for React components and view modules in `badminton-v2/src/components/`, `badminton-v2/src/views/`, and `badminton-v2/src/layouts/`. Examples: `badminton-v2/src/components/MatchGeneratorPanel.tsx`, `badminton-v2/src/views/RegisterView.tsx`, `badminton-v2/src/layouts/PlayerLayout.tsx`.
- Use `camelCase.ts` for hooks, utilities, and library modules in `badminton-v2/src/hooks/`, `badminton-v2/src/lib/`, and `badminton-v2/src/utils/`. Examples: `badminton-v2/src/hooks/useSessionFinance.ts`, `badminton-v2/src/lib/matchGenerator.ts`, `badminton-v2/src/lib/utils.ts`.
- Use generated lowercase filenames for UI primitives in `badminton-v2/src/components/ui/`. Examples: `badminton-v2/src/components/ui/button.tsx`, `badminton-v2/src/components/ui/dialog.tsx`.
- Use `*.test.ts` for Vitest files under `badminton-v2/src/__tests__/` and `*.spec.ts` for Playwright files under `badminton-v2/tests/`. Examples: `badminton-v2/src/__tests__/useSessionFinance.test.ts`, `badminton-v2/tests/registration-limit.spec.ts`.

**Functions:**
- Use `camelCase` for functions and hooks. Examples: `useFinanceSessions` in `badminton-v2/src/hooks/useFinanceSessions.ts`, `allocateCheapestFirst` in `badminton-v2/src/hooks/useSessionFinance.ts`, `generateScheduleOptimized` in `badminton-v2/src/lib/matchGenerator.ts`.
- Prefix React hooks with `use`. Examples: `useRegistration` in `badminton-v2/src/hooks/useRegistration.ts`, `useAuth` in `badminton-v2/src/contexts/AuthContext.tsx`.
- Use helper-style verbs for private functions inside modules. Examples: `fetchProfile` in `badminton-v2/src/contexts/AuthContext.tsx`, `formTeams` and `pickGroup` in `badminton-v2/src/lib/matchGenerator.ts`.

**Variables:**
- Use `camelCase` for state, locals, and maps. Examples: `isLoading`, `fetchError`, `usageAllocations`, `levelMap`, `tubeStartMap` in `badminton-v2/src/hooks/useSessionFinance.ts`.
- Use boolean prefixes like `is`, `has`, and `should` for flags. Examples: `isValidToken`, `isAlreadyRegistered`, `hasAutoRegistered`, `isRegenerating` in `badminton-v2/src/hooks/useRegistration.ts` and `badminton-v2/src/views/RegisterView.tsx`.
- Use uppercase constants for shared defaults and lookup maps. Examples: `DEFAULT_WEIGHTS` in `badminton-v2/src/lib/matchGenerator.ts`, `DEFAULTS` and `MATCH_TYPE_COLOR` in `badminton-v2/src/components/MatchGeneratorPanel.tsx`.

**Types:**
- Use `PascalCase` for interfaces and exported types. Examples: `FinanceSessionRow` in `badminton-v2/src/hooks/useFinanceSessions.ts`, `SessionFinanceData` in `badminton-v2/src/hooks/useSessionFinance.ts`, `GeneratedMatch` in `badminton-v2/src/lib/matchGenerator.ts`.
- Use short literal-union aliases for constrained domain values when the module owns the state. Example: `type Role = 'admin' | 'player' | null` in `badminton-v2/src/contexts/AuthContext.tsx`.

## Code Style

**Formatting:**
- No Prettier or Biome config is detected in `badminton-v2/`; formatting is maintained manually with ESLint as the only enforced style tool.
- Use 2-space indentation in app-owned source such as `badminton-v2/src/App.tsx`, `badminton-v2/src/hooks/useRegistration.ts`, and `badminton-v2/src/lib/matchGenerator.ts`.
- Keep semicolon usage style consistent within a file. App-owned modules usually omit semicolons, while generated UI primitives in `badminton-v2/src/components/ui/` use semicolons and double quotes.
- Preserve the existing exception for generated UI primitives in `badminton-v2/src/components/ui/`; they intentionally follow generator formatting instead of the rest of the repo.

**Linting:**
- ESLint flat config is defined in `badminton-v2/eslint.config.js`.
- Lint `**/*.{ts,tsx}` with `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`, and `eslint-plugin-react-refresh`.
- Respect the global ignores in `badminton-v2/eslint.config.js`: `dist` and `src/components/ui`.
- Browser globals are assumed in linted source via `globals.browser`.

## Import Organization

**Order:**
1. React or framework imports first. Examples: `badminton-v2/src/App.tsx`, `badminton-v2/src/views/RegisterView.tsx`.
2. Third-party packages next. Examples: `sonner`, `@supabase/supabase-js`, `@playwright/test`.
3. App alias imports from `@/` after external packages. Examples: `badminton-v2/src/hooks/useRegistration.ts`, `badminton-v2/src/components/MatchGeneratorPanel.tsx`.
4. Relative imports last when used. Examples: `badminton-v2/src/App.tsx`, `badminton-v2/src/__tests__/matchGenerator.test.ts`.
5. `import type` is used, but not required to be grouped separately. Examples: `badminton-v2/src/lib/supabase.ts`, `badminton-v2/src/views/RegisterView.tsx`, `badminton-v2/src/__tests__/matchGenerator.scoring.test.ts`.

**Path Aliases:**
- Use the `@/*` alias from `badminton-v2/tsconfig.app.json` for app code under `badminton-v2/src/`.
- Prefer `@/contexts/AuthContext`, `@/lib/supabase`, and similar aliases over deep relative paths in source modules.
- Tests also use the alias. Examples: `badminton-v2/src/__tests__/matchGenerator.test.ts`, `badminton-v2/src/__tests__/useSessionFinance.test.ts`.

## Error Handling

**Patterns:**
- Throw only for invariant violations and invalid hook usage. Example: `useAuth` throws when the context is missing in `badminton-v2/src/contexts/AuthContext.tsx`.
- For async data access, prefer returning stateful error strings instead of throwing. Examples: `fetchError` in `badminton-v2/src/hooks/useFinanceSessions.ts` and `badminton-v2/src/hooks/useSessionFinance.ts`.
- For Supabase mutations, check `{ error }` immediately and branch early. Examples: `badminton-v2/src/hooks/useRegistration.ts`, `badminton-v2/src/hooks/useSessionFinance.ts`, `badminton-v2/src/components/MatchGeneratorPanel.tsx`.
- Surface user-facing failures with `toast.error(...)` for UI actions. Examples: `badminton-v2/src/hooks/useRegistration.ts`, `badminton-v2/src/components/MatchGeneratorPanel.tsx`.
- Use empty `catch {}` only when failure is intentionally non-fatal. Examples: `badminton-v2/src/components/CheersPanel.tsx`, `badminton-v2/src/views/RegisterView.tsx`.

## Logging

**Framework:** `console`

**Patterns:**
- Use targeted `console.error(...)` for Supabase or data-repair paths that should not block the UI. Examples: `badminton-v2/src/hooks/useRegistration.ts`.
- Ad hoc `console.log(...)` debugging exists in `badminton-v2/src/views/RegisterView.tsx`; avoid spreading that pattern into new code unless temporary investigation is required.
- No centralized logging abstraction is present in `badminton-v2/src/`.

## Comments

**When to Comment:**
- Comment to explain workflow constraints, race conditions, or business rules around Supabase and scheduling logic. Examples: `badminton-v2/src/contexts/AuthContext.tsx`, `badminton-v2/src/hooks/useRegistration.ts`, `badminton-v2/src/lib/matchGenerator.ts`.
- Use banner comments to divide large algorithm or test files into sections. Examples: `badminton-v2/src/lib/matchGenerator.ts`, `badminton-v2/src/__tests__/matchGenerator.test.ts`.
- Do not add comments for self-evident JSX or basic state wiring.

**JSDoc/TSDoc:**
- Use short JSDoc blocks for exported helpers and algorithm phases in utility-heavy files. Examples: `badminton-v2/src/lib/matchGenerator.ts`, `badminton-v2/src/__tests__/fixtures/helpers.ts`.
- Interfaces and most hooks rely on type names instead of full TSDoc.

## Function Design

**Size:** Large feature modules and algorithm files are acceptable when the behavior is tightly related. Examples: `badminton-v2/src/components/MatchGeneratorPanel.tsx` and `badminton-v2/src/lib/matchGenerator.ts`.

**Parameters:** Prefer typed parameter objects for option-heavy APIs and explicit scalar parameters for small helpers. Examples: `GenerateOptions` and `OptimizeOptions` in `badminton-v2/src/lib/matchGenerator.ts`, scalar helpers like `calculateProfitAfterPersonalShare` in `badminton-v2/src/hooks/useSessionFinance.ts`.

**Return Values:**
- Hooks return structured state objects with data, loading flags, error fields, and action functions. Examples: `useFinanceSessions` in `badminton-v2/src/hooks/useFinanceSessions.ts`, `useRegistration` in `badminton-v2/src/hooks/useRegistration.ts`, `useSessionFinance` in `badminton-v2/src/hooks/useSessionFinance.ts`.
- Async action functions commonly return `{ error: string | null }` instead of throwing. Example: `logUsage`, `saveCourtCost`, and `savePersonalShare` in `badminton-v2/src/hooks/useSessionFinance.ts`.

## Module Design

**Exports:**
- Hooks and utility modules prefer named exports. Examples: `badminton-v2/src/hooks/useSessionFinance.ts`, `badminton-v2/src/lib/matchGenerator.ts`.
- Route views often export both a named component and a default export for lazy routing. Example: `badminton-v2/src/views/RegisterView.tsx`.
- Small UI primitives may export multiple named members. Example: `Button` and `buttonVariants` from `badminton-v2/src/components/ui/button.tsx`.

**Barrel Files:** Not used in `badminton-v2/src/`; import modules directly from their file path.

---

*Convention analysis: 2026-05-12*
