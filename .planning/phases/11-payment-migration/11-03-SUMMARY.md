---
plan: 11-03
phase: 11-payment-migration
status: complete
completed: 2026-05-06
commit: 96f79c3
---

# Plan 11-03: Remove Payment Controls from SessionView

## What Was Built

Removed all payment UI from the Admin session view. Payment management is now exclusively on the Finance page (established by 11-01).

## Key Files

### Modified
- `badminton-v2/src/views/SessionView.tsx` — removed `<RosterPanel paymentOnly />` from `schedule_locked` block
- `badminton-v2/src/components/RosterPanel.tsx` — removed Paid/Unpaid button group from `editable` mode

## Changes Made

1. **SessionView.tsx** — deleted the single line `<RosterPanel sessionId={session.id} paymentOnly />` from inside the `schedule_locked` block; remaining children (MatchGeneratorPanel, Start Session, Open LiveBoard, Unlock Schedule) unchanged
2. **RosterPanel.tsx** — deleted the Paid/Unpaid button `<div>` block (~15 lines) from inside `{editable && (<>...</>)}`; gender toggle and level select remain; `updatePaid` stays in `useRoster` destructure (still used by `paymentOnly` branch)

## Verification

- `grep -n "paymentOnly" SessionView.tsx` → 0 results
- `grep -n "updatePaid|Paid|Unpaid" RosterPanel.tsx` → only lines 27 (destructure) and 73/80 (paymentOnly branch)
- `npx tsc --noEmit` → 0 errors

## Self-Check: PASSED
