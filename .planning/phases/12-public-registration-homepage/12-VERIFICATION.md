---
phase: 12-public-registration-homepage
status: gaps_found
verified: 2026-05-12
source:
  - 12-01-PLAN.md
  - 12-01-SUMMARY.md
---

# Phase 12 Verification: Public Registration Homepage

## Verdict

Status: `gaps_found`

The user-facing phase goal is implemented and the focused Playwright suite verifies the required public, authenticated, OAuth, and invite compatibility paths. The phase cannot be marked fully passed because the required repo-wide `npm run lint` gate fails on pre-existing unrelated lint errors.

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
| `npm.cmd run lint` | FAIL | Fails on existing unrelated lint errors outside Phase 12 touched files. |
| `node .codex/get-shit-done/bin/gsd-tools.cjs verify.schema-drift 12` | PASS | No schema drift detected. |

## Gaps

### Gap 1: Repo-wide lint gate is not green

- **Status:** failed
- **Scope:** Existing unrelated files outside `badminton-v2/src/views/HomeView.tsx` and `badminton-v2/tests/public-homepage.spec.ts`.
- **Examples from lint output:** `CourtTabs.tsx`, `AuthContext.tsx`, `NotificationContext.tsx`, several hooks, `RegisterView.tsx`, and existing tests.
- **Impact:** Blocks a strict phase pass because the plan-level verification required `npm run lint`.
- **Recommended closure:** Run a separate lint cleanup pass, then rerun `npm.cmd run lint` and this verification.

## Human Verification

Recommended manual check remains:

- Open `/` signed out and confirm the first screen is a simple badminton app homepage with a clear Register action and no public form.

## Summary

Phase behavior is ready for review and focused automated coverage is passing. The only blocking verification gap is repo-wide lint debt that predates this phase's implementation.
