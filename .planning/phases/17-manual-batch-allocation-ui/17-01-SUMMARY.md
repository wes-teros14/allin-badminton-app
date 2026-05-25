---
plan: 17-01
phase: 17-manual-batch-allocation-ui
status: complete
completed: 2026-05-25
subsystem: finance-hook
tags: [finance, hook, manual-allocation, tests]
requirements: [MAN-02, MAN-03, MAN-04, MAN-05, MAN-06]
dependency-graph:
  requires: [16-02]
  provides: [manual-batch-metadata, manual-row-hydration, shared-manual-save-contract]
  affects: [useSessionFinance, useSessionFinance.test.ts]
tech-stack:
  added: []
  patterns: [hook-enrichment, inventory-aligned-view-models, replacement-save-contract]
key-files:
  created: []
  modified:
    - badminton-v2/src/hooks/useSessionFinance.ts
    - badminton-v2/src/__tests__/useSessionFinance.test.ts
---

# Phase 17 Plan 01: Manual Finance Hook Summary

Enriched `useSessionFinance` so the manual allocation UI can stay thin. The hook now exposes inventory-style batch metadata for the picker, hydrates saved manual allocation rows back into editable row shapes, and keeps both auto and manual saves on the same full-replacement `saveUsageAllocation` seam introduced in Phase 16.

## Self-Check

- Manual picker batches expose tube ID, brand, shuttles remaining, cost per tube, and notes
- Saved manual usage rows rehydrate into editable finance rows without a second persistence contract
- Auto saves still route through the cheapest-first allocator
- `npm run test:unit` passed
- `npm run build` passed
