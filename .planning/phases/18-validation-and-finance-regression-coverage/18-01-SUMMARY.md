---
plan: 18-01
phase: 18-validation-and-finance-regression-coverage
status: complete
completed: 2026-05-25
subsystem: finance-hook
tags: [finance, validation, manual-allocation, vitest]
requirements: [VAL-01, VAL-02, VAL-03, COMP-01]
dependency-graph:
  requires: [17-01]
  provides: [manual-validation-helper, save-time-manual-guard, finance-helper-regression-tests]
  affects: [useSessionFinance, useSessionFinance.test.ts]
tech-stack:
  added: []
  patterns: [shared-manual-validator, save-seam-enforcement, stock-aware-row-errors]
key-files:
  created: []
  modified:
    - badminton-v2/src/hooks/useSessionFinance.ts
    - badminton-v2/src/__tests__/useSessionFinance.test.ts
---

# Phase 18 Plan 01: Manual Validation Hook Summary

Added a shared manual-allocation validator to `useSessionFinance` so invalid finance rows fail at the persistence seam before any database write occurs. The hook now rejects empty allocations, duplicate batch rows, non-integer or non-positive counts, and over-stock usage against the same reopen-safe stock baseline used by the finance screen.

## Self-Check

- Manual validation is centralized in `validateManualUsageRows`
- `buildUsageRowsForSave` blocks invalid manual payloads before inserts
- Reopen-safe stock checks still rely on the excluded-session usage baseline
- Automatic allocation behavior remains on the existing cheapest-first path
- `npm run test:unit -- --run src/__tests__/useSessionFinance.test.ts` passed
- `npm run build` passed

