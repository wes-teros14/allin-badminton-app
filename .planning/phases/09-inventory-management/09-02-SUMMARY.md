---
plan: 09-02
phase: 09-inventory-management
status: complete
completed: 2026-05-05
subsystem: inventory-ui
tags: [inventory, ui, shadcn, react, table]
requires: [09-01]
provides: [InventoryView component]
affects: []
tech-stack:
  added: [shadcn/badge, shadcn/table, shadcn/dialog]
  patterns: [Intl.NumberFormat peso formatting, animate-pulse skeleton, empty state with icon]
key-files:
  created:
    - badminton-v2/src/views/InventoryView.tsx
    - badminton-v2/src/components/ui/badge.tsx
    - badminton-v2/src/components/ui/table.tsx
    - badminton-v2/src/components/ui/dialog.tsx
  modified: []
decisions:
  - Table component includes overflow-x-auto container natively so no extra wrapper div was needed
  - Add Batch button onClick is no-op stub (Wave 3 wires the dialog)
  - dialog.tsx installed in Wave 2 so Wave 3 can import it without a separate install step
---

# Phase 09 Plan 02: InventoryView UI Component Summary

InventoryView read-path component: 6-column shadcn Table with depleted-row Badge, 3-row pulse skeleton, Package icon empty state, and peso-formatted Cost/Tube column.

## What Was Built

- `badminton-v2/src/views/InventoryView.tsx` — default-exported React component consuming `useShuttleBatches`
- Three shadcn components installed into `badminton-v2/src/components/ui/`: badge.tsx, table.tsx, dialog.tsx

## Task Breakdown

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Install shadcn badge, table, dialog | 1a1afa2 | badge.tsx, table.tsx, dialog.tsx |
| 2 | Build InventoryView component | c4ad5ec | InventoryView.tsx |

## Key Decisions

- **Table overflow wrapper**: The shadcn Table component already includes `overflow-x-auto` in its container div, so no extra wrapper div was added in InventoryView (deviation from plan's suggested `<div className="overflow-x-auto">` wrapper — cleaner without it).
- **Add Batch button**: `onClick={() => {}}` no-op stub — Wave 3 replaces with dialog trigger.
- **dialog.tsx installed here**: Pre-installed in Wave 2 so Wave 3 can import it without a separate install step.
- **`&ndash;` for dash in Tube ID range**: Used HTML entity in JSX for the en-dash between T-{start} and T-{end}.

## Deviations from Plan

None — plan executed exactly as written. Minor structural note: removed extra `overflow-x-auto` div wrapper since the shadcn Table component provides this natively.

## Known Stubs

- **Add Batch button onClick**: `onClick={() => {}}` in `InventoryView.tsx` line ~31. Intentional — Wave 3 (plan 09-03) wires the dialog open handler here.

## Threat Flags

None — InventoryView is read-only display. Route-level admin guard is Wave 3's responsibility (T-09-05).

## Self-Check: PASSED

- [x] badge.tsx exists and is non-empty (52 lines)
- [x] table.tsx exists and is non-empty (114 lines)
- [x] dialog.tsx exists and is non-empty (160 lines)
- [x] InventoryView.tsx exists at badminton-v2/src/views/InventoryView.tsx
- [x] Commit 1a1afa2 exists (chore: shadcn install)
- [x] Commit c4ad5ec exists (feat: InventoryView)
- [x] All 13 acceptance criteria pass (default export, imports, variant=secondary, bg-muted/30, animate-pulse, empty state copy, tubeStart, totalStockRemaining, formatPeso, aria-hidden, aria-label depleted)
- [x] npx tsc --noEmit exits 0 (TSC PASS)
