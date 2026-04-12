# TESTING.md — Test Structure & Practices

## Test Frameworks

| Tool | Purpose | Config |
|------|---------|--------|
| **Vitest v2** | Unit tests | `badminton-v2/vitest.config.ts` |
| **Playwright** | E2E browser tests | `badminton-v2/playwright.config.ts` |

## Unit Tests (Vitest)

### Location
`badminton-v2/src/__tests__/` — excluded from TypeScript compilation (`tsconfig.app.json` excludes `src/__tests__`), included in Vitest via `src/**/*.test.ts` glob.

### Current coverage
**Only the match generator engine is unit-tested:**
- `src/__tests__/matchGenerator.test.ts` — behavioral + structural tests
- `src/__tests__/matchGenerator.scoring.test.ts` — scorer/audit data tests
- `src/__tests__/fixtures/players.ts` — player fixture data (FIXTURE_A through FIXTURE_G)
- `src/__tests__/fixtures/helpers.ts` — test helper utilities

No React component unit tests exist (no testing-library/react setup).

### Running
```bash
npm run test:unit       # single run
npm run test:unit:watch # watch mode
```

### Vitest config
```ts
// vitest.config.ts
test: {
  include: ['src/**/*.test.ts'],
  environment: 'node',   // no jsdom — pure logic tests only
}
```

### Test patterns
- `describe` / `it` / `expect` — standard Vitest API
- Randomness mocked via `vi.spyOn(Math, 'random').mockReturnValue(0.5)` in `beforeEach`/`afterEach`
- Tests import directly from `@/lib/matchGenerator`
- Fixtures defined as named exports (`FIXTURE_A` through `FIXTURE_G`) representing different player counts/gender ratios

### Example test structure
```ts
describe('Group 1: Output Structure', () => {
  beforeEach(() => vi.spyOn(Math, 'random').mockReturnValue(0.5))
  afterEach(() => vi.restoreAllMocks())

  it('1.1 — match count equals ceil(n*8/4)', () => {
    const matches = generateSchedule(FIXTURE_B)
    expect(matches.length).toBe(Math.ceil((FIXTURE_B.length * 8) / 4))
  })
})
```

## E2E Tests (Playwright)

### Location
`badminton-v2/tests/` — separate from unit tests.

### Current coverage
- `tests/registration-limit.spec.ts` — tests player registration limit enforcement (both client-side pre-check and DB trigger from migration 020)

### Running
```bash
npm run test:e2e      # headless
npm run test:e2e:ui   # Playwright UI mode
```

### Playwright config
```ts
// playwright.config.ts
testDir: './tests',
fullyParallel: true,
retries: process.env.CI ? 2 : 0,
workers: process.env.CI ? 1 : undefined,
use: {
  baseURL: 'http://localhost:5173',
  trace: 'on-first-retry',
},
webServer: {
  command: 'npm run dev',
  url: 'http://localhost:5173',
  reuseExistingServer: true,
  timeout: 30000,
}
```
- **Browser:** Chromium only (Desktop Chrome)
- **Dev server:** Auto-started, or reuses existing (`reuseExistingServer: true`)

### E2E test patterns
- Supabase **service role** admin client used for test setup (bypasses RLS):
  ```ts
  const supabase = createClient(url, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
  ```
- `.env` file manually parsed in both `playwright.config.ts` and test files (Playwright workers don't auto-inherit env)
- Prerequisites: dev server running, seed data applied

## Test Gaps

- No React component rendering tests
- No hook unit tests
- No integration tests for Supabase queries
- No snapshot tests
- E2E tests only cover registration limit; no auth flow, admin actions, or match generation E2E tests
- No CI pipeline configured (CI retries/workers ready in Playwright config but no CI workflow file found)

## Mocking Strategy

- **Unit tests:** `Math.random` mocked via `vi.spyOn` for deterministic match generation
- **E2E tests:** no mocks — real Supabase dev instance used with service role for setup
- No Supabase client mocking pattern established

## Seed Data

Scripts in `badminton-v2/scripts/`:
- `seed-test-users.ts` — creates test player accounts (`npm run seed`)
- `seed-extra-users.ts` — seeds additional users
- `copy-prod-profiles-to-dev.ts` — copies prod profiles to dev environment

Run via: `npx tsx scripts/<file>.ts`
