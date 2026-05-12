---
phase: 12-public-registration-homepage
plan: 01
subsystem: ui-auth
tags: [react, playwright, supabase, oauth, homepage]
requires:
  - phase: prior-app
    provides: Existing root route, AuthContext, Supabase Google OAuth, and invite-token registration route.
provides:
  - Public signed-out root homepage with registration-oriented Google OAuth CTA.
  - Playwright smoke coverage for signed-out homepage, OAuth initiation, signed-in homepage, and tokenless invite route.
affects: [public-entry, auth, invite-registration, e2e]
tech-stack:
  added: []
  patterns:
    - Route-level auth branching stays in HomeView.
    - OAuth initiation tests intercept Supabase authorize navigation instead of depending on Google.
key-files:
  created:
    - badminton-v2/tests/public-homepage.spec.ts
  modified:
    - badminton-v2/src/views/HomeView.tsx
key-decisions:
  - "Kept normal onboarding on / with direct Google OAuth, separate from /register invite-token compatibility."
  - "Used existing dev login panel helpers for deterministic signed-in Playwright coverage."
patterns-established:
  - "Public homepage E2E stubs Supabase OAuth authorize navigation while asserting provider and redirect_to."
requirements-completed:
  - REG-01
  - REG-02
  - REG-03
  - AUTH-01
  - AUTH-02
  - INVITE-01
  - INVITE-02
duration: 25 min
completed: 2026-05-12
---

# Phase 12 Plan 01: Public Registration Homepage Summary

**Signed-out root homepage with a Register with Google CTA and focused Playwright coverage for public, authenticated, and invite compatibility paths**

## Performance

- **Duration:** 25 min
- **Started:** 2026-05-12T11:29:00+08:00
- **Completed:** 2026-05-12T11:54:01+08:00
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments

- Replaced the signed-out `/` prompt with a simple public homepage that explains the badminton group app and presents `Register with Google`.
- Preserved the existing Supabase Google OAuth call and root redirect target.
- Added deterministic Playwright coverage for signed-out homepage content, OAuth initiation, signed-in homepage preservation, and `/register` tokenless compatibility.

## Task Commits

Each implementation task was committed atomically:

1. **Task 1: Add public signed-out homepage branch** - `83a4a89` (feat)
2. **Task 2: Add public homepage E2E coverage** - `c4705f1` (test)
3. **Task 3: Run phase verification commands and record execution summary** - this SUMMARY commit

## Files Created/Modified

- `badminton-v2/src/views/HomeView.tsx` - Public signed-out homepage branch and renamed registration-oriented OAuth handler.
- `badminton-v2/tests/public-homepage.spec.ts` - Focused Playwright smoke coverage for the phase behavior.

## Verification

- `npx.cmd eslint src/views/HomeView.tsx tests/public-homepage.spec.ts` - PASS
- `npm.cmd run test:e2e -- public-homepage.spec.ts` - PASS, 4/4 tests
- `npm.cmd run lint` - FAIL, blocked by pre-existing unrelated lint errors outside this phase's touched files.

## Decisions Made

- Kept the public homepage compact and app-focused rather than introducing a marketing layout.
- Tested OAuth by intercepting Supabase `/auth/v1/authorize` navigation and asserting `provider=google` plus root `redirect_to`.

## Deviations from Plan

None - plan implementation scope was executed as written.

## Issues Encountered

Full repo lint is currently blocked by unrelated existing errors in files not touched by this plan, including `CourtTabs.tsx`, several hooks, `RegisterView.tsx`, and existing tests. The changed phase files pass targeted ESLint, and the focused phase E2E suite passes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase behavior is implemented and covered by focused E2E tests. Before claiming a fully green repository gate, the existing repo-wide lint debt needs a separate cleanup pass.

## Self-Check: FAILED

The signed-out homepage, Register CTA, signed-in branch, and `/register` compatibility behavior are verified by focused E2E coverage. The plan-level full `npm run lint` gate remains failed due to pre-existing unrelated repository lint errors.

---
*Phase: 12-public-registration-homepage*
*Completed: 2026-05-12*
