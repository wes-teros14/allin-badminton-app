---
status: complete
phase: 14-split-result-entry
source: [14-VERIFICATION.md]
started: 2026-05-23T18:15:00.000Z
updated: 2026-05-23T19:00:00.000Z
---

## Current Test

[testing complete]

## Tests

### 1. Toggle persists to DB
expected: In `registration_closed` or `schedule_locked` state, checking "Split match scoring" saves `sessions.split_match_scoring = true` to Supabase, toast shows "Split scoring enabled", and a page refresh keeps the checkbox checked
result: pass

### 2. Live board 3-button screen
expected: With `split_match_scoring = true` on a session, pressing "Finish" on an active court shows 3 buttons: "{t1p1} & {t1p2} won 2-0", "1-1 Draw", "{t2p1} & {t2p2} won 2-0"
result: pass

### 3. Split outcome writes 2 DB rows and advances queue
expected: Selecting any split outcome inserts exactly 2 `match_results` rows (game_number 1 and 2) for that match, the match status changes to complete, and the next queued match starts on that court
result: pass

### 4. COMP-02 regression — live board
expected: With `split_match_scoring = false`, the live board Finish screen shows the original 2-button screen (team names only, no "won 2-0" text)
result: pass

### 5. COMP-02 regression — admin panel
expected: With `split_match_scoring = false`, the admin CourtTabs Finish screen shows the original 3-button screen (team1, team2, Draw/No Winner)
result: pass

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none]
