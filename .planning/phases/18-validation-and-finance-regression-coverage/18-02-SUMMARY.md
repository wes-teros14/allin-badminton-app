---
plan: 18-02
phase: 18-validation-and-finance-regression-coverage
status: complete
completed: 2026-05-25
subsystem: finance-ui
tags: [finance, validation, react, manual-allocation]
requirements: [VAL-01, VAL-02, VAL-03, COMP-01]
dependency-graph:
  requires: [18-01]
  provides: [inline-manual-validation, save-gating, row-level-finance-errors]
  affects: [FinanceDetailView, ManualAllocationEditor, ManualBatchPickerDialog]
tech-stack:
  added: []
  patterns: [live-inline-validation, draft-preserving-number-inputs, disabled-save-guard]
key-files:
  created: []
  modified:
    - badminton-v2/src/views/FinanceDetailView.tsx
    - badminton-v2/src/components/ManualAllocationEditor.tsx
---

# Phase 18 Plan 02: Finance Validation UI Summary

Wired the finance page to the shared hook validator so manual allocation errors stay visible while the QM edits and invalid saves never leave the page. The editor now preserves draft numeric input, renders row-local validation copy next to the offending input, and disables `Save Allocation` until the manual draft is valid again.

## Self-Check

- Manual finance validation stays visible inline while editing
- Empty, invalid-count, duplicate, and over-stock states block `Save Allocation`
- Picker-based duplicate prevention remains intact while save-time validation still defends the backend seam
- Auto allocation flow is unchanged outside the shared validation-aware manual branch
- `npm run lint` passed with 2 pre-existing warnings outside Phase 18
- `npm run build` passed
