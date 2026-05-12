---
phase: 12-public-registration-homepage
status: passed
verified: 2026-05-12
source:
  - 12-01-PLAN.md
  - 12-01-SUMMARY.md
---

# Phase 12 Verification: Public Registration Homepage

## Verdict

Status: `passed`

The user-facing phase goal is implemented and automated verification now passes for the required public, authenticated, OAuth, and invite compatibility paths. The previous repo-wide lint gap was closed by audit finding `F-01`.

## Must-Have Verification

| Requirement | Result | Evidence |
|-------------|--------|----------|
| REG-01 | PASS | Signed-out `/` shows the public homepage; covered by `public-homepage.spec.ts`. |
| REG-02 | PASS | `Register with Google` CTA is visible; covered by `public-homepage.spec.ts`. |
| REG-03 | PASS | CTA navigates to Supabase OAuth authorize with `provider=google` and root `redirect_to`; covered by `public-homepage.spec.ts`. |
| AUTH-01 | PASS | Dev-login smoke test verifies signed-in users still see `Welcome back!`. |
| AUTH-02 | PASS | No public form fields are rendered and no alternate auth provider was added. |
| INVITE-01 | PASS | `/register` remains routed to the existing tokenless `Registration Closed` state. |
| INVITE-02 | PASS | Normal onboarding starts from `/` without requiring an invite token. |

## Automated Checks

| Command | Result | Notes |
|---------|--------|-------|
| `npx.cmd eslint src/views/HomeView.tsx tests/public-homepage.spec.ts` | PASS | Changed phase files are lint-clean. |
| `npm.cmd run test:e2e -- public-homepage.spec.ts` | PASS | 4/4 Playwright tests passed. |
| `npm.cmd run lint` | PASS | Exits 0; four non-blocking exhaustive-deps warnings remain. |
| `npm.cmd run test:unit` | PASS | 59/59 Vitest tests passed. |
| `npm.cmd run build` | PASS | TypeScript build and Vite production build passed. |
| `node .codex/get-shit-done/bin/gsd-tools.cjs verify.schema-drift 12` | PASS | No schema drift detected. |

## Gaps

None.

## Human Verification

Recommended manual check remains:

- Open `/` signed out and confirm the first screen is a simple badminton app homepage with a clear Register action and no public form.

## Summary

Phase behavior is ready for review, focused automated coverage is passing, and the repo-wide lint gate no longer blocks Phase 12 completion.
