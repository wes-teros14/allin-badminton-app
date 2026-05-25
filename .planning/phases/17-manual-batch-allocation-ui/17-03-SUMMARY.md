---
plan: 17-03
phase: 17-manual-batch-allocation-ui
status: complete
completed: 2026-05-25
subsystem: finance-detail-ui
tags: [finance, ui, manual-allocation]
requirements: [MAN-02, MAN-03, MAN-04, MAN-05, MAN-06]
dependency-graph:
  requires: [17-01, 17-02]
  provides: [manual-allocation-editor, picker-integration, reloadable-manual-flow]
  affects: [FinanceDetailView, ManualAllocationEditor]
tech-stack:
  added: []
  patterns: [draft-row-state, inline-remove-confirmation, mode-aware-editor]
key-files:
  created:
    - badminton-v2/src/components/ManualAllocationEditor.tsx
  modified:
    - badminton-v2/src/views/FinanceDetailView.tsx
---

# Phase 17 Plan 03: Manual Allocation Editor Summary

Replaced the Phase 16 manual placeholder with a working manual allocation flow inside `FinanceDetailView`. QMs can now open the picker, add batches into an editable table in add order, change per-batch shuttle counts with live total updates, remove rows with inline confirmation, and save or reload manual allocations through the existing finance hook contract.

## Self-Check

- Manual mode no longer relies on the placeholder shell
- Selected rows keep add order and recalculate total shuttles immediately
- Row removal requires confirmation before deletion
- Reopened manual allocations load back into the same editable table state
- `npm run build` passed
- `npm run lint` passed with 2 pre-existing warnings outside Phase 17
