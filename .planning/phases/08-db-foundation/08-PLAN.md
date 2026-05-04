---
phase: 8
name: DB Foundation
wave: 1
depends_on: []
files_modified:
  - badminton-v2/supabase/migrations/053_create_shuttle_batches.sql
  - badminton-v2/supabase/migrations/054_create_shuttle_usage.sql
  - badminton-v2/supabase/migrations/055_add_court_cost_to_sessions.sql
  - badminton-v2/src/types/database.ts
autonomous: false
requirements: []
---

# Phase 8: DB Foundation

**Goal:** Establish the database schema for Finance & Inventory (v1.1) — two new tables plus one new column — and regenerate TypeScript types so all downstream hooks compile without `never` errors.

**Why autonomous: false:** Migrations cannot be applied via Supabase CLI on Windows. Each SQL file must be manually executed in the Supabase Dashboard SQL Editor. The executor writes the files; the user runs them.

---

## must_haves

- [ ] `shuttle_batches` table exists in the live Supabase DB with RLS enabled and admin-only policy
- [ ] `shuttle_usage` table exists in the live Supabase DB with RLS enabled and admin-only policy
- [ ] `sessions.court_cost NUMERIC(10,2)` column exists in the live Supabase DB
- [ ] `database.ts` contains Row/Insert/Update types for `shuttle_batches` and `shuttle_usage`
- [ ] `database.ts` contains `court_cost` field in the `sessions` Row type
- [ ] TypeScript build passes (`npm run build` exits 0 in `badminton-v2/`)

---

## Task 1 — Write migration 053: Create shuttle_batches table

<objective>
Write the SQL migration file for the shuttle_batches table — the inventory purchase ledger.
Includes CREATE TABLE, ENABLE ROW LEVEL SECURITY, admin-only policy, and GRANT.
</objective>

<wave>1</wave>

<read_first>
- badminton-v2/supabase/migrations/043_admin_update_profiles.sql — canonical admin-only RLS policy pattern (USING + WITH CHECK on profiles.role = 'admin')
- badminton-v2/supabase/migrations/042_add_paid_to_registrations.sql — migration header comment format
- badminton-v2/supabase/migrations/051_add_is_active_to_profiles.sql — simple migration format reference
- .planning/research/ARCHITECTURE.md — shuttle_batches schema spec (exact column names, types, constraints)
- .planning/research/PITFALLS.md — Pitfall 3: RLS checklist (ENABLE RLS + admin USING policy + explicit GRANT)
</read_first>

<action>
Create file `badminton-v2/supabase/migrations/053_create_shuttle_batches.sql` with this exact content:

```sql
-- =============================================================
-- Migration: 053_create_shuttle_batches
-- Creates shuttle_batches table for tracking inventory purchases.
-- Admin-only: players have no access to cost or stock data.
-- =============================================================

CREATE TABLE public.shuttle_batches (
  id            UUID         NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  purchased_at  DATE         NOT NULL DEFAULT current_date,
  brand         TEXT         NOT NULL,
  tube_count    INT          NOT NULL CHECK (tube_count > 0),
  cost_per_tube NUMERIC(8,2) NOT NULL CHECK (cost_per_tube > 0),
  notes         TEXT,
  created_by    UUID         NOT NULL REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- No total_cost column — always computed as tube_count * cost_per_tube on read.
-- Storing it would create a sync hazard with no benefit.

ALTER TABLE public.shuttle_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shuttle_batches: admin all"
  ON public.shuttle_batches
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shuttle_batches TO authenticated;
-- No anon grant — finance data is admin-only.
```
</action>

<acceptance_criteria>
- File `badminton-v2/supabase/migrations/053_create_shuttle_batches.sql` exists
- File contains `CREATE TABLE public.shuttle_batches`
- File contains `cost_per_tube NUMERIC(8,2)`
- File contains `tube_count INT`
- File contains `ENABLE ROW LEVEL SECURITY`
- File contains `CREATE POLICY "shuttle_batches: admin all"`
- File contains `GRANT SELECT, INSERT, UPDATE, DELETE ON public.shuttle_batches TO authenticated`
- File does NOT contain `TO anon`
</acceptance_criteria>

---

## Task 2 — Write migration 054: Create shuttle_usage table

<objective>
Write the SQL migration file for the shuttle_usage table — per-session consumption log.
Includes CREATE TABLE, UNIQUE constraint, ENABLE ROW LEVEL SECURITY, admin-only policy, and GRANT.
</objective>

<wave>1</wave>

<read_first>
- badminton-v2/supabase/migrations/053_create_shuttle_batches.sql — must be written first (054 references shuttle_batches.id via FK)
- badminton-v2/supabase/migrations/043_admin_update_profiles.sql — admin-only RLS policy pattern
- .planning/research/ARCHITECTURE.md — shuttle_usage schema spec (NUMERIC(4,1) for tubes_used, UNIQUE on session_id+batch_id)
- .planning/research/PITFALLS.md — Pitfall 3: RLS checklist
</read_first>

<action>
Create file `badminton-v2/supabase/migrations/054_create_shuttle_usage.sql` with this exact content:

```sql
-- =============================================================
-- Migration: 054_create_shuttle_usage
-- Creates shuttle_usage table for logging per-session shuttle consumption.
-- One row per batch per session; update tubes_used if more consumed.
-- Admin-only: players have no access to usage or cost data.
-- =============================================================

CREATE TABLE public.shuttle_usage (
  id          UUID         NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID         NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  batch_id    UUID         NOT NULL REFERENCES public.shuttle_batches(id),
  tubes_used  NUMERIC(4,1) NOT NULL CHECK (tubes_used > 0),
  recorded_by UUID         NOT NULL REFERENCES auth.users(id),
  recorded_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (session_id, batch_id)
);

-- NUMERIC(4,1) for tubes_used supports partial tracking (e.g. 0.5, 1.5).
-- UNIQUE (session_id, batch_id): one row per batch per session.
-- To record more usage from the same batch: UPDATE tubes_used, not INSERT.

ALTER TABLE public.shuttle_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shuttle_usage: admin all"
  ON public.shuttle_usage
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shuttle_usage TO authenticated;
-- No anon grant — finance data is admin-only.
```
</action>

<acceptance_criteria>
- File `badminton-v2/supabase/migrations/054_create_shuttle_usage.sql` exists
- File contains `CREATE TABLE public.shuttle_usage`
- File contains `tubes_used  NUMERIC(4,1)`
- File contains `REFERENCES public.shuttle_batches(id)`
- File contains `REFERENCES public.sessions(id) ON DELETE CASCADE`
- File contains `UNIQUE (session_id, batch_id)`
- File contains `ENABLE ROW LEVEL SECURITY`
- File contains `CREATE POLICY "shuttle_usage: admin all"`
- File contains `GRANT SELECT, INSERT, UPDATE, DELETE ON public.shuttle_usage TO authenticated`
- File does NOT contain `TO anon`
</acceptance_criteria>

---

## Task 3 — Write migration 055: Add court_cost to sessions

<objective>
Write the SQL migration file adding court_cost column to the sessions table.
This is an ALTER TABLE — no new table, no RLS change needed (sessions table already has its own RLS policies).
</objective>

<wave>1</wave>

<read_first>
- badminton-v2/supabase/migrations/051_add_is_active_to_profiles.sql — ALTER TABLE ADD COLUMN pattern
- badminton-v2/supabase/migrations/042_add_paid_to_registrations.sql — ADD COLUMN with DEFAULT pattern
- .planning/STATE.md — architectural decision: court_cost as NUMERIC(10,2) column on sessions, not separate table
</read_first>

<action>
Create file `badminton-v2/supabase/migrations/055_add_court_cost_to_sessions.sql` with this exact content:

```sql
-- =============================================================
-- Migration: 055_add_court_cost_to_sessions
-- Adds court_cost column to sessions for P&L calculation.
-- Nullable: historical sessions have no court cost recorded.
-- No RLS change needed — sessions table policies already exist.
-- =============================================================

ALTER TABLE public.sessions
  ADD COLUMN court_cost NUMERIC(10,2);

-- court_cost is nullable intentionally:
-- - Historical sessions (pre-v1.1) have no court cost data.
-- - P&L query uses COALESCE(court_cost, 0) to treat NULL as zero.
-- - Admin sets this when recording a session's financials.
```
</action>

<acceptance_criteria>
- File `badminton-v2/supabase/migrations/055_add_court_cost_to_sessions.sql` exists
- File contains `ALTER TABLE public.sessions`
- File contains `ADD COLUMN court_cost NUMERIC(10,2)`
- File does NOT contain `NOT NULL` on the court_cost line (it must be nullable)
- File does NOT contain `ENABLE ROW LEVEL SECURITY` (sessions table already has RLS)
</acceptance_criteria>

---

## Task 4 — [MANUAL] Execute migrations in Supabase Dashboard

<objective>
Execute all three migration SQL files in the Supabase Dashboard SQL Editor.
This task CANNOT be automated — Supabase CLI is blocked on Windows in this project.
</objective>

<wave>2</wave>
<autonomous>false</autonomous>

<read_first>
- badminton-v2/supabase/migrations/053_create_shuttle_batches.sql
- badminton-v2/supabase/migrations/054_create_shuttle_usage.sql
- badminton-v2/supabase/migrations/055_add_court_cost_to_sessions.sql
</read_first>

<action>
MANUAL STEP — executor must pause and instruct the user:

1. Open Supabase Dashboard → SQL Editor
2. Run `053_create_shuttle_batches.sql` — paste full content, click Run
3. Confirm: no error, table appears in Table Editor under `shuttle_batches`
4. Run `054_create_shuttle_usage.sql` — paste full content, click Run
5. Confirm: no error, table appears under `shuttle_usage`
6. Run `055_add_court_cost_to_sessions.sql` — paste full content, click Run
7. Confirm: no error, `sessions` table now shows `court_cost` column in Table Editor

Run in order: 053 → 054 → 055. Do NOT skip 053 before 054 (FK dependency).

After all three succeed, tell executor: "migrations done".
</action>

<acceptance_criteria>
- User confirms all 3 SQL scripts ran without error in Supabase Dashboard
- `shuttle_batches` table visible in Supabase Table Editor
- `shuttle_usage` table visible in Supabase Table Editor
- `sessions` table shows `court_cost` column in Supabase Table Editor
- No "relation does not exist" or RLS errors reported
</acceptance_criteria>

---

## Task 5 — Regenerate TypeScript types

<objective>
Regenerate database.ts from the live Supabase schema to pick up the three new DB objects.
Verify the generated file contains the new table types before proceeding.
</objective>

<wave>3</wave>

<read_first>
- badminton-v2/src/types/database.ts — current state before regen (check existing structure)
- badminton-v2/package.json — confirm supabase CLI is in devDependencies or scripts
</read_first>

<action>
Run in `badminton-v2/` directory:

```bash
npx supabase gen types --linked > src/types/database.ts
```

If `--linked` fails (project not linked), use the project ref directly:
```bash
npx supabase gen types typescript --project-id <project-id> > src/types/database.ts
```

The project ID can be found in `badminton-v2/supabase/config.toml` or the Supabase Dashboard URL.

After running, verify the output contains:
- `shuttle_batches` (search for it in database.ts)
- `shuttle_usage`
- `court_cost` in the sessions Row type
</action>

<acceptance_criteria>
- `badminton-v2/src/types/database.ts` contains `shuttle_batches`
- `badminton-v2/src/types/database.ts` contains `shuttle_usage`
- `badminton-v2/src/types/database.ts` contains `court_cost` in the sessions section
- `badminton-v2/src/types/database.ts` contains `cost_per_tube` in the shuttle_batches section
- `badminton-v2/src/types/database.ts` contains `tubes_used` in the shuttle_usage section
</acceptance_criteria>

---

## Task 6 — Verify TypeScript build passes

<objective>
Confirm the updated database.ts causes no TypeScript compilation errors in existing code.
This is a regression check — no existing hooks should break from adding new table types.
</objective>

<wave>3</wave>

<read_first>
- badminton-v2/src/types/database.ts — just regenerated; check for syntax errors
- badminton-v2/tsconfig.app.json — TS config to understand strictness settings
</read_first>

<action>
Run in `badminton-v2/` directory:

```bash
npm run build
```

If build fails with TypeScript errors unrelated to the new tables (pre-existing `never` errors), document them but do NOT fix them — they are pre-existing technical debt. Phase 8 only needs to confirm no NEW errors were introduced by the type regen.

If build succeeds: phase is complete.
If build fails on NEW errors (files referencing shuttle_batches/shuttle_usage/court_cost): fix the type reference in database.ts (re-run gen types or check for malformed SQL in the migration).
</action>

<acceptance_criteria>
- `npm run build` exits 0 in `badminton-v2/` directory
- OR: `npm run build` fails only on pre-existing errors (none referencing shuttle_batches, shuttle_usage, or court_cost)
- No NEW TypeScript errors introduced by the type regeneration
- `tsc --noEmit` in `badminton-v2/` shows no errors on `src/types/database.ts` itself
</acceptance_criteria>

---

## Verification

After all tasks complete, verify phase goal:

```bash
# 1. SQL files exist
ls badminton-v2/supabase/migrations/053_create_shuttle_batches.sql
ls badminton-v2/supabase/migrations/054_create_shuttle_usage.sql
ls badminton-v2/supabase/migrations/055_add_court_cost_to_sessions.sql

# 2. Types contain new tables
grep "shuttle_batches" badminton-v2/src/types/database.ts
grep "shuttle_usage" badminton-v2/src/types/database.ts
grep "court_cost" badminton-v2/src/types/database.ts

# 3. Build passes (no new errors)
cd badminton-v2 && npm run build
```

**Phase 8 is complete when:**
- All 3 SQL files exist with correct schema
- All 3 migrations have been run in Supabase Dashboard (confirmed by user)
- `database.ts` contains the 3 new DB objects
- Build passes

**Unblocks:** Phase 9 (Inventory Management) which requires these tables to exist before writing hooks.

---

## Threat Model

<threat_model>
**RLS bypass (HIGH):** Missing GRANT or missing ENABLE RLS on new tables causes silent empty results (project has hit this 4× in v1.0). Mitigation: both policies include explicit ENABLE RLS + GRANT statements. No anon grant.

**FK ordering (MEDIUM):** Running 054 before 053 fails due to FK reference to shuttle_batches.id. Mitigation: migrations must run in numeric order (053 → 054 → 055).

**Type drift (MEDIUM):** Writing Phase 9 hooks before regenerating types causes `never` casts that silently break at runtime. Mitigation: type regen (Task 5) is a blocking gate before Phase 9 begins.

**Court cost nullability (LOW):** Making court_cost NOT NULL would break existing session rows that have no cost data. Mitigation: column is nullable, P&L uses COALESCE(court_cost, 0).
</threat_model>
