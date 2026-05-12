# Testing Patterns

**Analysis Date:** 2026-05-12

## Test Framework

**Runner:**
- Vitest `^2.0.0` for unit tests, configured in `badminton-v2/vitest.config.ts`.
- Config: `badminton-v2/vitest.config.ts`
- Playwright `^1.58.2` for browser E2E tests, configured in `badminton-v2/playwright.config.ts`.

**Assertion Library:**
- Vitest `expect` in `badminton-v2/src/__tests__/*.test.ts`
- Playwright `expect` in `badminton-v2/tests/registration-limit.spec.ts`

**Run Commands:**
```bash
npm run test:unit         # Run all Vitest tests once
npm run test:unit:watch   # Run Vitest in watch mode
npm run test:e2e          # Run Playwright browser tests
```

## Test File Organization

**Location:**
- Unit tests are centralized under `badminton-v2/src/__tests__/`, not co-located with source files.
- E2E tests live under `badminton-v2/tests/`.
- Shared unit-test fixtures live under `badminton-v2/src/__tests__/fixtures/`.

**Naming:**
- Use `*.test.ts` for Vitest files. Examples: `badminton-v2/src/__tests__/matchGenerator.test.ts`, `badminton-v2/src/__tests__/useSessionFinance.test.ts`.
- Use `*.spec.ts` for Playwright files. Example: `badminton-v2/tests/registration-limit.spec.ts`.

**Structure:**
```text
badminton-v2/
├── src/__tests__/
│   ├── *.test.ts
│   └── fixtures/
│       ├── helpers.ts
│       └── players.ts
└── tests/
    └── *.spec.ts
```

## Test Structure

**Suite Organization:**
```typescript
describe('Group 1: Output Structure', () => {
  beforeEach(mockRandom)
  afterEach(restoreRandom)

  it('1.1 - match count equals ceil(n*8/4)', () => {
    const matches = generateSchedule(FIXTURE_B)
    expect(matches.length).toBe(Math.ceil((FIXTURE_B.length * 8) / 4))
  })
})
```

**Patterns:**
- Organize larger suites with themed `describe(...)` groups and numbered `it(...)` names. Example: `badminton-v2/src/__tests__/matchGenerator.test.ts`.
- Use local helper functions inside the test file for deterministic setup. Examples: `mockRandom` and `restoreRandom` in `badminton-v2/src/__tests__/matchGenerator.test.ts`, `makeMatch` in `badminton-v2/src/__tests__/matchGenerator.scoring.test.ts`.
- E2E specs rely on top-level helpers plus `beforeAll`, `beforeEach`, `afterEach`, and `afterAll` hooks for database setup and cleanup in `badminton-v2/tests/registration-limit.spec.ts`.

## Mocking

**Framework:** Vitest `vi`

**Patterns:**
```typescript
vi.mock('@/lib/supabase', () => ({
  supabase: {},
}))

vi.spyOn(Math, 'random').mockImplementation(() => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff
  return seed / 0x7fffffff
})

afterEach(() => {
  vi.restoreAllMocks()
})
```

**What to Mock:**
- Mock module boundaries when the test only cares about pure helper logic. Example: `badminton-v2/src/__tests__/useSessionFinance.test.ts` mocks `@/lib/supabase`.
- Spy on randomness to make scheduling deterministic. Example: `badminton-v2/src/__tests__/matchGenerator.test.ts`.

**What NOT to Mock:**
- Do not mock the scheduling algorithm internals when validating behavior; the current unit suite executes real logic from `badminton-v2/src/lib/matchGenerator.ts`.
- Do not mock Supabase in E2E tests; `badminton-v2/tests/registration-limit.spec.ts` uses a real service-role client and seeded data.

## Fixtures and Factories

**Test Data:**
```typescript
export const FIXTURE_B: PlayerInput[] = [
  { id: 'b1', nameSlug: 'alice', nickname: null, gender: 'M', level: 1 },
  { id: 'b2', nameSlug: 'bob', nickname: null, gender: 'M', level: 3 },
  { id: 'b5', nameSlug: 'eve', nickname: null, gender: 'F', level: 1 },
]
```

**Location:**
- Static player fixtures live in `badminton-v2/src/__tests__/fixtures/players.ts`.
- Shared test helper functions live in `badminton-v2/src/__tests__/fixtures/helpers.ts`.
- E2E setup helpers such as `getUserId`, `registerUserDirectly`, and `signInAs` live inline inside `badminton-v2/tests/registration-limit.spec.ts`.

## Coverage

**Requirements:** None enforced. No coverage script, coverage provider package, or threshold config is detected in `badminton-v2/package.json`, `badminton-v2/vitest.config.ts`, or `badminton-v2/playwright.config.ts`.

**View Coverage:**
```bash
Not configured
```

## Test Types

**Unit Tests:**
- Focus on pure algorithm behavior and helper functions in `badminton-v2/src/lib/matchGenerator.ts` and `badminton-v2/src/hooks/useSessionFinance.ts`.
- Current unit tests do not render React components and do not use React Testing Library.
- Vitest runs with `environment: 'node'` in `badminton-v2/vitest.config.ts`, which matches the current non-DOM unit test scope.

**Integration Tests:**
- Light integration coverage exists through real function combinations rather than a separate integration test harness. Example: `badminton-v2/src/__tests__/matchGenerator.test.ts` exercises full schedule generation flows.
- There is no dedicated integration-test directory or jsdom-based component integration setup.

**E2E Tests:**
- Playwright is used for browser flows in `badminton-v2/tests/registration-limit.spec.ts`.
- `badminton-v2/playwright.config.ts` starts the app with `npm run dev`, uses `http://localhost:5173` as `baseURL`, and enables HTML reporting.
- The current E2E suite uses a real Supabase backend with seeded users and direct DB setup via a service-role client.

## Common Patterns

**Async Testing:**
```typescript
test.beforeAll(async () => {
  const { data: session, error } = await supabase
    .from('sessions')
    .insert({ name: 'Registration Limit Test Session', date: today, status: 'registration_open', created_by: adminId })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
})
```

**Error Testing:**
```typescript
const { error } = await supabase
  .from('session_registrations')
  .insert({ session_id: testSessionId, player_id: samId })

expect(error).not.toBeNull()
expect(error!.message).toContain('session_full')
```

## Additional Notes

- Vitest includes `src/**/*.test.ts` in `badminton-v2/vitest.config.ts`, which picks up `badminton-v2/src/__tests__/` successfully.
- `badminton-v2/tsconfig.app.json` excludes `src/__tests__`, so `npm run build` type-checks app code but does not type-check test files.
- Playwright config and the current spec manually load `.env` at runtime in `badminton-v2/playwright.config.ts` and `badminton-v2/tests/registration-limit.spec.ts`; keep that pattern if new E2E tests need direct backend access.

---

*Testing analysis: 2026-05-12*
