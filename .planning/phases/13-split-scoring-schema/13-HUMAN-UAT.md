---
status: passed
phase: 13-split-scoring-schema
source: [13-VERIFICATION.md]
started: 2026-05-23T14:20:00+08:00
updated: 2026-05-23T14:20:00+08:00
---

## Current Test

complete

## Tests

### 1. Apply the split scoring migration in Supabase Dashboard
expected: `063_add_split_scoring_schema.sql` runs cleanly and `public.sessions.split_match_scoring` plus `public.match_results.game_number` exist in the live database.
result: PASS (2026-05-23 — migration required a fix to cast `att.attname::text` before running successfully)

### 2. Validate legacy match result normalization on live data
expected: Existing `match_results` rows resolve to `game_number = 1`, and attempting a duplicate insert for the same `(match_id, game_number)` is rejected by the database.
result: PASS (2026-05-23 — all existing rows confirmed game_number = 1)

## Summary

total: 2
passed: 2
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
