---
phase: 8
name: DB Foundation
status: complete
completed: 2026-05-04
plans: 1
---

# Phase 8: DB Foundation — Summary

## What Was Built

Three database changes landed in the dev Supabase project, establishing the schema foundation for all Finance & Inventory work in v1.1:

1. **`shuttle_batches` table** (migration 053) — inventory purchase ledger. Columns: `id`, `purchased_at`, `brand`, `tube_count INT`, `cost_per_tube NUMERIC(8,2)`, `notes`, `created_by`, `created_at`. Admin-only RLS + GRANT.

2. **`shuttle_usage` table** (migration 054) — per-session consumption log. Columns: `id`, `session_id` (FK → sessions ON DELETE CASCADE), `batch_id` (FK → shuttle_batches), `tubes_used NUMERIC(4,1)`, `recorded_by`, `recorded_at`. UNIQUE on `(session_id, batch_id)`. Admin-only RLS + GRANT.

3. **`sessions.court_cost NUMERIC(10,2)` column** (migration 055) — nullable court rental cost per session for P&L. Historical sessions default to NULL; P&L uses COALESCE(court_cost, 0).

4. **TypeScript types regenerated** from the correct dev project (`tsvetqzkullivprbjtli`). `database.ts` now includes full Row/Insert/Update types for both new tables and the new column.

5. **MatchGeneratorPanel.tsx fixed** — type gen from the correct project exposed a pre-existing `Record<string,unknown>` → `Json` cast issue. Fixed by importing `Json` from `database.ts` and using it as the cast target.

## Key Decisions

- Migrations run via Supabase Dashboard SQL Editor (CLI blocked on Windows — project blocker)
- Dev project ref: `tsvetqzkullivprbjtli` (URL-based). The CLI `linked-project.json` pointed to a different project (`ensdfitpeyreunihkqkh`) — type gen was incorrect until switched to project ref from `VITE_SUPABASE_URL`
- `court_cost` is nullable (no DEFAULT) — preserves historical session data

## Deviations

- Type gen required explicit `--project-id tsvetqzkullivprbjtli` (not `--linked`) because the supabase CLI is linked to a different project than the one in `.env`
- MatchGeneratorPanel.tsx bug fix was out-of-scope but required to achieve exit-0 build

## Self-Check: PASSED

- [x] `shuttle_batches` table in live dev DB (admin RLS + GRANT)
- [x] `shuttle_usage` table in live dev DB (admin RLS + GRANT)
- [x] `sessions.court_cost NUMERIC(10,2)` column in live dev DB (nullable)
- [x] `database.ts` contains shuttle_batches, shuttle_usage, court_cost, cost_per_tube, tubes_used
- [x] `npm run build` exits 0
