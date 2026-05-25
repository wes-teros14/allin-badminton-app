---
plan: 16-01
phase: 16-finance-allocation-mode-foundation
status: complete
completed: 2026-05-25
subsystem: finance-schema
tags: [finance, supabase, rpc, types]
requirements: [FIN-01, FIN-03, COMP-02]
dependency-graph:
  requires: []
  provides: [allocation-mode-schema, finance-rpc-mode-field]
  affects: [sessions, get_session_finance, database.ts]
tech-stack:
  added: [postgres-enum]
  patterns: [additive-schema, backward-compatible-default]
key-files:
  created:
    - badminton-v2/supabase/migrations/065_add_shuttle_allocation_mode.sql
  modified:
    - badminton-v2/src/types/database.ts
---

# Phase 16 Plan 01: Allocation Mode Schema Summary

Added `public.shuttle_allocation_mode` with `auto`/`manual`, stored it on `sessions` with a default of `auto`, and extended `get_session_finance` to return the mode without changing revenue, shuttle-cost, or profit formulas. Synced `database.ts` so session rows and the finance RPC expose the new field end-to-end.

## Self-Check

- Existing and new sessions normalize to `shuttle_allocation_mode = 'auto'` via the DB contract
- `get_session_finance` now returns `shuttle_allocation_mode`
- `database.ts` exposes the enum plus session/RPC fields
- `npm run build` passed

