---
plan: 09-01
phase: 09-inventory-management
status: complete
completed: 2026-05-05
---

## Summary

Created `useShuttleBatches` hook — the complete data layer for the inventory screen.

## What Was Built

- `badminton-v2/src/hooks/useShuttleBatches.ts` — exports `ShuttleBatch`, `AddBatchInput`, and `useShuttleBatches()`

## Key Decisions

- Batches fetched ordered by `cost_per_tube ASC` (cheapest-first, per D-04)
- Tube ID ranges computed from a second query ordered by `created_at ASC`, starting at 1001
- `shuttle_usage` joined via separate query; `tubesRemaining = tube_count - SUM(tubes_used)` computed client-side via Map
- `totalStockRemaining` derived as sum of all `tubesRemaining` values
- `addBatch` passes `created_by: user.id` from `useAuth()` — RLS-safe

## Self-Check: PASSED

- [x] `useShuttleBatches.ts` exists
- [x] Exports `ShuttleBatch` interface with all required fields
- [x] Exports `AddBatchInput` interface
- [x] Exports `useShuttleBatches` function
- [x] Uses `.order('cost_per_tube', { ascending: true })` (INV-02)
- [x] Queries `shuttle_usage` for remaining stock (INV-04)
- [x] Computes `tubeStart`/`tubeEnd` ranges (INV-03)
- [x] Exposes `totalStockRemaining` (INV-05)
- [x] Uses `created_by: user.id` (auth-safe insert)
- [x] Committed: `feat(09-01): create useShuttleBatches hook`

## key-files

### created
- badminton-v2/src/hooks/useShuttleBatches.ts
