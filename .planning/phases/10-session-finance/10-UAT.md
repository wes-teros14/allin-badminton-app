---
status: partial
phase: 10-session-finance
source: [10-01-SUMMARY.md, 10-02-SUMMARY.md, 10-03-SUMMARY.md, 10-04-SUMMARY.md]
started: 2026-05-06T00:18:00+08:00
updated: 2026-05-06T00:20:00+08:00
---

## Current Test

[testing paused — 10 items outstanding. Resume after Phase 11 is complete.]

## Tests

### 1. Finance Tab Visibility (Admin)
expected: Sign in as admin. The top navigation bar shows a "Finance" tab after the "Inventory" tab. The tab is clickable and highlights as active when on /finance paths.
result: pass

### 2. Finance Tab Hidden for Non-Admin
expected: Sign in as a player (non-admin). The top navigation bar does NOT show a Finance tab — it is completely hidden, not just greyed out.
result: [pending]

### 3. Finance List — Session Table
expected: Navigate to /finance as admin. A table appears with columns: Date, Revenue, Cost, P&L. Each row represents a session. Sessions are ordered most-recent first.
result: [pending]

### 4. Finance List — P&L Color Coding
expected: In the Finance list, sessions with positive net profit show the P&L value in green text. Sessions with a net loss show P&L in red/destructive color.
result: [pending]

### 5. Finance List — Row Click Navigation
expected: Click any session row in the Finance list. The browser navigates to /finance/:sessionId and shows the Finance Detail View for that session.
result: [pending]

### 6. Shuttle Usage Form — Log Usage
expected: On the Finance Detail View, find the Shuttle Usage card. Select a tube by ID and enter how many shuttlecocks were used. Submit — the form saves and a batch allocation breakdown table appears below showing Brand, Tubes, Cost columns.
result: [pending]

### 7. Shuttle Usage Form — Update Usage (Dynamic Button Label)
expected: After logging usage once, return to the same session's detail view. The submit button now reads "Update Usage" (not "Save Usage"). Changing the tube count and submitting successfully updates the record without creating a duplicate.
result: [pending]

### 8. Shuttle Usage Form — Insufficient Stock Validation
expected: On the Shuttle Usage form, enter a quantity greater than the available tube stock. An inline error appears before any DB call — submission is blocked with a message about insufficient stock.
result: [pending]

### 9. Court Cost Form — Save Court Cost
expected: On the Finance Detail View, find the Court Cost card. Enter a court rental cost (e.g., ₱500) and save. The value persists — navigating away and returning to the same session still shows ₱500.
result: [pending]

### 10. P&L Summary Card — Computed Correctly
expected: After logging shuttle usage and entering a court cost, the P&L Summary card shows: Revenue (price × paid players), Court Cost, Shuttle COGS (tubes used × cost per tube), and Net Profit (revenue − court cost − shuttle cost). All values update after changes without a page refresh.
result: [pending]

### 11. P&L Color Coding — Detail View
expected: In the Finance Detail View's P&L card, the Net Profit figure is green when positive (profit) and red/destructive when negative (loss).
result: [pending]

## Summary

total: 11
passed: 1
issues: 0
pending: 10
skipped: 0
blocked: 0

## Gaps

[none yet]
