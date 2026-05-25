---
status: complete
phase: 18-validation-and-finance-regression-coverage
source:
  - 18-01-SUMMARY.md
  - 18-02-SUMMARY.md
  - 18-03-SUMMARY.md
started: 2026-05-25T05:20:00Z
updated: 2026-05-25T05:27:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Manual Mode Requires At Least One Allocation Row
expected: In manual mode, trying to save without a valid allocation keeps the user on the finance page, shows a clear validation message, and does not allow the allocation to be saved.
result: pass

### 2. Duplicate Batch Selection Is Blocked
expected: When the same shuttle batch is selected twice in a manual allocation, the UI prevents or flags the duplicate and still blocks saving until the duplicate is removed.
result: pass

### 3. Invalid Counts Show Inline Errors And Block Save
expected: Manual allocation rows with zero, negative, non-integer, or above-stock shuttle counts show row-level validation feedback and keep Save Allocation disabled.
result: pass

### 4. Valid Manual Allocation Saves Correct Totals And Reloads Cleanly
expected: A valid manual allocation saves successfully, shows the correct total shuttles, shuttle cost, and batch allocation details, and the same values reappear correctly when the session is reopened for editing.
result: pass

### 5. Automatic Allocation Still Saves Correct Finance Results
expected: In auto mode, saving allocation still follows the existing automatic flow and shows correct total shuttles, shuttle cost, and batch allocation display without manual-mode regressions.
result: pass

## Summary

total: 5
passed: 0
passed: 4
passed: 5
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
