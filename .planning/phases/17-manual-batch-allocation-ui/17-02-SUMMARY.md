---
plan: 17-02
phase: 17-manual-batch-allocation-ui
status: complete
completed: 2026-05-25
subsystem: finance-picker
tags: [finance, ui, dialog, search]
requirements: [MAN-01, MAN-02, MAN-03]
dependency-graph:
  requires: [17-01]
  provides: [manual-batch-picker-dialog, live-brand-search]
  affects: [ManualBatchPickerDialog]
tech-stack:
  added: []
  patterns: [dialog-picker, live-filtering, inventory-detail-rows]
key-files:
  created:
    - badminton-v2/src/components/ManualBatchPickerDialog.tsx
  modified: []
---

# Phase 17 Plan 02: Manual Batch Picker Summary

Added `ManualBatchPickerDialog` as the searchable inventory-native picker for manual shuttle allocation. The dialog keeps brand filtering live with a case-insensitive contains match, preserves the existing cheapest-first batch ordering when search is empty, and renders full batch details before a one-tap `Add`.

## Self-Check

- Manual batch selection happens in a dialog instead of inline in the finance card
- Empty-search suggestions stay in cheapest-first order from the hook contract
- Search uses `includes()` matching on brand
- Result rows show tube ID, brand, shuttles remaining, cost per tube, and notes
- `npm run build` passed
- `npm run lint` passed with 2 pre-existing warnings outside Phase 17
