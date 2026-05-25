---
plan: 16-02
phase: 16-finance-allocation-mode-foundation
status: complete
completed: 2026-05-25
subsystem: finance-hook
tags: [finance, hook, allocation-mode, tests]
requirements: [FIN-01, FIN-03, COMP-02]
dependency-graph:
  requires: [16-01]
  provides: [mode-aware-finance-hook, replacement-save-contract]
  affects: [useSessionFinance, useSessionFinance.test.ts]
tech-stack:
  added: []
  patterns: [compatibility-wrapper, shared-save-path, defensive-normalization]
key-files:
  created: []
  modified:
    - badminton-v2/src/hooks/useSessionFinance.ts
    - badminton-v2/src/__tests__/useSessionFinance.test.ts
---

# Phase 16 Plan 02: Mode-Aware Hook Summary

Refactored `useSessionFinance` around an explicit allocation-mode contract. The hook now normalizes missing mode values to `auto`, exposes `allocationMode` plus `saveAllocationMode`, and routes the legacy `logUsage(totalShuttles)` API through one shared full-replacement save path that can also represent manual per-batch rows.

## Self-Check

- `allocationMode` is loaded from the finance RPC with `auto` fallback
- Auto saves still use the unchanged cheapest-first allocator through `logUsage`
- Shared save helper can build both auto and manual `shuttle_usage` rows
- `npm run test:unit` passed
- `npm run build` passed

