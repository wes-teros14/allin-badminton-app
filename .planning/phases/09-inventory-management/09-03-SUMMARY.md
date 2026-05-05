---
phase: "09"
plan: "03"
subsystem: "inventory"
tags: [inventory, dialog, form, routing, navigation, zod, react-hook-form]
dependency_graph:
  requires: ["09-01-useShuttleBatches", "09-02-InventoryView"]
  provides: ["inventory-feature-complete"]
  affects: ["App.tsx routing", "TopNavBar navigation", "InventoryView dialog"]
tech_stack:
  added: []
  patterns:
    - "Zod v4 z.input/z.output split for useForm TFieldValues vs TTransformedValues"
    - "Controlled Dialog (no DialogTrigger) via dialogOpen state"
    - "AdminRoute guard for /inventory route"
    - "Admin-only tab in TopNavBar via show: role === 'admin'"
key_files:
  created: []
  modified:
    - "badminton-v2/src/views/InventoryView.tsx"
    - "badminton-v2/src/App.tsx"
    - "badminton-v2/src/components/TopNavBar.tsx"
decisions:
  - "Used z.input<> for useForm type and z.output<> for handleSubmit type to satisfy @hookform/resolvers v5 + Zod v4 type constraints"
  - "Controlled Dialog pattern (dialogOpen state) avoids DialogTrigger so the Add Batch button in the header controls the dialog"
  - "AdminRoute wraps /inventory inside PlayerLayout consistent with /players and /admin routes"
  - "Admin-only Inventory tab placed after Players tab in TopNavBar"
metrics:
  duration: "~10 minutes"
  completed: "2026-05-05"
  tasks_completed: 2
  files_modified: 3
---

# Phase 09 Plan 03: Inventory UI Wiring Summary

Completed the inventory feature by adding the Add Batch dialog with Zod form validation to InventoryView, wiring the /inventory route inside AdminRoute, and adding the admin-only Inventory tab to TopNavBar.

## What Was Built

### Task 1: Add Batch Dialog (InventoryView.tsx)
- Added `addBatchSchema` (Zod v4) with brand, tubeCount, costPerTube, notes fields
- Added `useForm` with `zodResolver` using Zod v4 input/output type split
- Added `handleSubmit` calling `addBatch` with `toast.success`/`toast.error` feedback
- Wired Add Batch button `onClick` to `setDialogOpen(true)`
- Added controlled Dialog JSX with complete form, field validation messages, and DialogFooter submit button
- Dialog resets form on close via `onOpenChange`

### Task 2: Route + Navigation (App.tsx + TopNavBar.tsx)
- Added `const InventoryView = lazy(() => import('@/views/InventoryView'))` after PlayersView
- Added `<Route path="/inventory" element={<InventoryView />} />` inside AdminRoute + PlayerLayout
- Added Inventory tab entry to TopNavBar tabs array with `show: role === 'admin'`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Zod v4 API incompatibility with @hookform/resolvers v5**
- **Found during:** Task 2 (npm run build with tsc -b)
- **Issue:** Plan specified `invalid_type_error` which is Zod v3 API. Project uses Zod v4 (^4.3.6) where the parameter is `error`. Additionally, `z.coerce.number()` input type is `unknown` in Zod v4, causing type mismatch with `useForm<AddBatchForm>` when using `z.output<>` as the form type.
- **Fix:** Replaced `invalid_type_error` with `error` param. Split form types: `useForm<AddBatchFormInput, unknown, AddBatchFormOutput>` where `AddBatchFormInput = z.input<typeof addBatchSchema>` and `AddBatchFormOutput = z.output<typeof addBatchSchema>`. This matches the @hookform/resolvers v5 Zod v4 overload signature.
- **Files modified:** `badminton-v2/src/views/InventoryView.tsx`
- **Commit:** e7c9c40

## Key Decisions

| Decision | Rationale |
|---|---|
| z.input/z.output split for useForm | @hookform/resolvers v5 returns `Resolver<z4.input<T>, Context, z4.output<T>>` — useForm must use input type for field registration, output type for handleSubmit |
| Controlled Dialog via state | No DialogTrigger needed; Add Batch button in page header drives dialog open state |
| AdminRoute + PlayerLayout wrapping | Consistent with /admin and /players routes; gives inventory the top nav bar |
| Admin-only nav tab | Inventory is admin-facing only; `show: role === 'admin'` hides tab from players |

## Acceptance Criteria

| Criteria | Status |
|---|---|
| InventoryView.tsx contains DialogContent | PASS |
| InventoryView.tsx contains addBatchSchema | PASS |
| InventoryView.tsx contains toast.success('Batch added.') | PASS |
| InventoryView.tsx contains toast.error('Failed to add batch. Try again.') | PASS |
| InventoryView.tsx contains 'Adding...' text | PASS |
| InventoryView.tsx contains 'Add Shuttle Batch' title | PASS |
| InventoryView.tsx contains dialogOpen state | PASS |
| App.tsx contains lazy InventoryView import | PASS |
| App.tsx contains /inventory Route inside AdminRoute | PASS |
| TopNavBar.tsx contains href: '/inventory' with show: role === 'admin' | PASS |
| npx tsc --noEmit exits 0 | PASS |
| npm run build exits 0 | PASS |

## Commits

| Hash | Message |
|---|---|
| 2fb4d93 | feat(09-03): add Add Batch dialog with Zod form validation to InventoryView |
| e7c9c40 | fix(09-03): use Zod v4 error param and input/output types for useForm |
| d7f79d4 | feat(09-03): wire /inventory route and admin-only Inventory tab in TopNavBar |

## Known Stubs

None — all data flows are wired. The dialog calls `addBatch` which inserts to Supabase and refetches. The table reads from `useShuttleBatches` which queries the `shuttle_batches` and `shuttle_usage` tables.

## Self-Check: PASSED

- `badminton-v2/src/views/InventoryView.tsx` — exists, contains all required criteria
- `badminton-v2/src/App.tsx` — exists, contains lazy import and /inventory route in AdminRoute
- `badminton-v2/src/components/TopNavBar.tsx` — exists, contains Inventory tab with admin guard
- Commits 2fb4d93, e7c9c40, d7f79d4 — all present in git log
- `npm run build` — exits 0, InventoryView-D8LrXOGm.js emitted
