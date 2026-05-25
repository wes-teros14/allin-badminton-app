---
plan: 18-03
phase: 18-validation-and-finance-regression-coverage
status: complete
completed: 2026-05-25
subsystem: finance-e2e
tags: [finance, playwright, regression, supabase]
requirements: [VAL-01, VAL-02, VAL-03, COMP-01]
dependency-graph:
  requires: [18-01, 18-02]
  provides: [finance-allocation-browser-regression, real-backend-finance-fixtures]
  affects: [finance-allocation-regression.spec.ts]
tech-stack:
  added: []
  patterns: [serial-finance-e2e-fixtures, service-role-setup, browser-level-finance-assertions]
key-files:
  created:
    - badminton-v2/tests/finance-allocation-regression.spec.ts
  modified: []
---

# Phase 18 Plan 03: Finance Browser Regression Summary

Added a real Supabase-backed Playwright regression spec for the finance allocation flow so Phase 18 now proves both manual validation hardening and automatic allocation compatibility in the browser. The spec creates isolated finance sessions and shuttle inventory, exercises the real picker and editor UI, blocks invalid manual saves, and confirms saved totals plus batch-allocation output for both manual and auto modes.

## Self-Check

- Playwright covers manual mode switching, brand search, row editing, duplicate-safe add behavior, and invalid-save blocking
- Playwright confirms saved manual totals and allocation rows on the real finance page
- Automatic allocation remains verified through the browser with deterministic cheapest-first fixture data
- `npm run test:e2e -- finance-allocation-regression.spec.ts` passed
