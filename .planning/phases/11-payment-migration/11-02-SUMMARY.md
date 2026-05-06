---
plan: 11-02
phase: 11-payment-migration
status: complete
completed: 2026-05-06
commit: d494817
---

# Plan 11-02: Payment Count in Finance List

## What Was Built

Extended `useFinanceSessions` with `paidCount` (paid=true registrations) and `totalCount` (all registrations) fields. Added a "Paid" column to `FinanceView` table showing "X / Y" format between Date and Revenue columns.

## Key Files

### Modified
- `badminton-v2/src/hooks/useFinanceSessions.ts` — added `paidCount`/`totalCount` to interface and `totalCountMap` loop
- `badminton-v2/src/views/FinanceView.tsx` — added Paid column header and cell

## Changes Made

1. `FinanceSessionRow` interface: added `paidCount: number` and `totalCount: number`
2. After `regCountMap` loop: added parallel `totalCountMap` counting all registrations (not filtered by paid)
3. `financeRows` map: added `paidCount` and `totalCount` to each returned object
4. `FinanceView` `<TableHead>`: added "Paid" header between Date and Revenue
5. `FinanceView` `<TableBody>` row: added `{s.paidCount} / {s.totalCount}` cell with `text-muted-foreground` between Date and Revenue

## Verification

- `grep -n "paidCount\|totalCount" useFinanceSessions.ts` returns interface + loop + object lines
- `grep -n "paidCount" FinanceView.tsx` returns Paid column cell
- `npx tsc --noEmit` → 0 errors

## Self-Check: PASSED
