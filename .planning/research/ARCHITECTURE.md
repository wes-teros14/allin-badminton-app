# Architecture: Finance & Inventory Integration

**Project:** All-In Badminton App  
**Feature:** Finance tab + Shuttle Inventory  
**Researched:** 2026-05-04  
**Confidence:** HIGH — derived from reading all 52 migration files and existing frontend hooks

---

## Existing Schema: What Already Exists

These columns are already live and must NOT be re-created:

| Table | Column | Type | Purpose |
|-------|--------|------|---------|
| `sessions` | `price` | `INT` | Session fee in pesos (added mig 032) |
| `sessions` | `session_notes` | `TEXT` | Admin notes (added mig 032) |
| `session_registrations` | `paid` | `BOOLEAN DEFAULT false` | Per-player payment flag (added mig 042) |

The trigger `on_payment_confirmed` (mig 046, then rolled back in mig 050) toggled an email on `paid` flip. That email system was rolled back — but the `paid` column and trigger scaffold pattern remain valid to reuse.

---

## New Tables Required

### 1. `shuttle_batches` — Inventory purchases

```sql
CREATE TABLE public.shuttle_batches (
  id           UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  purchased_at DATE        NOT NULL DEFAULT current_date,
  brand        TEXT        NOT NULL,
  tube_count   INT         NOT NULL CHECK (tube_count > 0),
  cost_per_tube NUMERIC(8,2) NOT NULL CHECK (cost_per_tube > 0),
  -- Derived: total_cost = tube_count * cost_per_tube (compute on read)
  notes        TEXT,
  created_by   UUID        NOT NULL REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Why no total_cost column:** It is always `tube_count * cost_per_tube`. Storing it creates a sync hazard with no benefit.

### 2. `shuttle_usage` — Per-session consumption

```sql
CREATE TABLE public.shuttle_usage (
  id          UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID        NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  batch_id    UUID        NOT NULL REFERENCES public.shuttle_batches(id),
  tubes_used  NUMERIC(4,1) NOT NULL CHECK (tubes_used > 0),
  -- Allows partial tube tracking: 0.5, 1.0, 1.5, etc.
  recorded_by UUID        NOT NULL REFERENCES auth.users(id),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, batch_id)
  -- One row per batch per session; update tubes_used if more consumed
);
```

**Why NUMERIC(4,1):** Partial tube tracking (half-tube granularity is common in badminton). INT would lose precision.

---

## Cheapest-First Shuttle Consumption: DB-Side vs Client-Side

**Recommendation: Client-side, not DB-side.**

Rationale:
- "Cheapest-first" is a UI concern — admin sees which batch to draw from when recording usage. It is NOT an automatic allocation; admin manually logs which batch they opened.
- A DB function that auto-allocates would need to mutate `shuttle_usage` rows silently, creating audit confusion and making it hard to correct mistakes.
- The client computes the ordered batch list for the admin to act on: `SELECT * FROM shuttle_batches ORDER BY cost_per_tube ASC, purchased_at ASC`.
- Admin selects a batch, enters tubes used, submits. The ordering is just a UI hint.

**Implementation pattern (client-side):**
```typescript
// useShuttleBatches.ts
// Returns batches sorted cheapest-first for the "Record Usage" dropdown
const { data } = await supabase
  .from('shuttle_batches')
  .select('*')
  .order('cost_per_tube', { ascending: true })
  .order('purchased_at', { ascending: true })
```

If auto-allocation is ever needed (e.g., "consume from cheapest batch automatically"), implement as a Postgres function with a clear audit trail — but defer until needed.

---

## Partial Tube Tracking Across Sessions

**Data model approach:** Each `shuttle_usage` row is an assertion, not a running total. The remaining inventory in a batch is computed:

```sql
-- Remaining tubes in a batch (computed at read time):
SELECT
  b.id,
  b.brand,
  b.tube_count,
  b.cost_per_tube,
  b.tube_count - COALESCE(SUM(u.tubes_used), 0) AS tubes_remaining
FROM shuttle_batches b
LEFT JOIN shuttle_usage u ON u.batch_id = b.id
GROUP BY b.id
```

This query is fast, correct, and avoids a mutable "remaining_tubes" column that can drift out of sync with usage rows.

**No need for a separate "partial tube" concept.** Using `NUMERIC(4,1)` on `tubes_used` handles e.g. "half a tube used in warm-up."

---

## Session P&L Calculation

All P&L is computed on-the-fly at read time — no stored `profit`/`loss` column needed.

```sql
-- Session P&L view (used by Finance tab for a given session_id):
SELECT
  s.id                                                        AS session_id,
  s.price                                                     AS fee_per_player,
  COUNT(sr.id) FILTER (WHERE sr.paid = true)                  AS players_paid,
  COUNT(sr.id)                                                AS players_total,
  s.price * COUNT(sr.id) FILTER (WHERE sr.paid = true)        AS revenue_collected,
  s.price * COUNT(sr.id)                                      AS revenue_expected,
  COALESCE(SUM(u.tubes_used * b.cost_per_tube), 0)            AS shuttle_cost,
  (s.price * COUNT(sr.id) FILTER (WHERE sr.paid = true))
    - COALESCE(SUM(u.tubes_used * b.cost_per_tube), 0)        AS net_pnl
FROM sessions s
LEFT JOIN session_registrations sr ON sr.session_id = s.id
LEFT JOIN shuttle_usage u           ON u.session_id  = s.id
LEFT JOIN shuttle_batches b         ON b.id           = u.batch_id
WHERE s.id = $session_id
GROUP BY s.id, s.price
```

This runs in milliseconds for typical session sizes (16–20 players, <10 shuttle usage rows).

---

## Integration Points with Existing Tables

| New Feature | Joins To | Via |
|-------------|----------|-----|
| Payment status list | `session_registrations` | `session_id` + `player_id` (existing `paid` column) |
| P&L revenue | `sessions.price` | direct column read |
| P&L shuttle cost | `shuttle_usage` → `shuttle_batches` | `batch_id` |
| Player names on payment list | `profiles` | `player_id = profiles.id` |
| Inventory remaining | `shuttle_batches` - `shuttle_usage` | aggregated |

No existing tables need new columns. The `sessions.price` and `session_registrations.paid` columns are already the integration anchors.

---

## Finance Tab: React Router Integration

**Placement:** Admin-only. Fits inside the existing `SessionView` (`/session/:sessionId`) as a tab, not a new top-level route.

**Why not a new route (`/session/:sessionId/finance`):**
- `SessionView` already owns the session context, player roster, and match controls.
- The Finance view needs the same `sessionId` and session state — duplicating that fetch in a child route adds complexity.
- A tab inside `SessionView` reuses the existing session data without a second DB query.

**Implementation pattern:**

```
SessionView (/session/:sessionId)
  ├── [tab: Matches]    — existing CourtTabs, match controls
  ├── [tab: Roster]     — existing RosterPanel (already has paid toggle)
  └── [tab: Finance]    — NEW FinancePanel component
        ├── P&L summary card (revenue, shuttle cost, net)
        ├── Payment status list (from existing session_registrations.paid)
        └── Shuttle usage log (from shuttle_usage + shuttle_batches)
```

**Standalone Inventory route** (`/admin/inventory` or `/inventory`):
- Admin-only route for managing `shuttle_batches` CRUD (buy tubes, log new batches).
- Separate from `SessionView` because batches exist independently of sessions.
- Add to `App.tsx` alongside `/admin` and `/players`.

```tsx
// App.tsx addition
const InventoryView = React.lazy(() => import('./views/InventoryView'))
// ...
<Route path="/inventory" element={<AdminRoute><InventoryView /></AdminRoute>} />
```

---

## New Hooks Required

| Hook | Responsibility |
|------|---------------|
| `useShuttleBatches.ts` | CRUD for `shuttle_batches`; returns batches sorted cheapest-first |
| `useShuttleUsage.ts` | Read/write `shuttle_usage` for a given `session_id`; computes tubes remaining per batch |
| `useSessionFinance.ts` | Computes session P&L by joining sessions + session_registrations + shuttle_usage; no separate DB view needed |

`useRoster.ts` already handles `paid` toggle (`updatePaid()`) — no changes needed there.

---

## RLS Policies (New Tables)

Both new tables are **admin-only write, admin-only read** (players have no reason to see inventory or cost data):

```sql
-- shuttle_batches: admin full access
CREATE POLICY "shuttle_batches: admin all"
  ON public.shuttle_batches
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- shuttle_usage: admin full access
CREATE POLICY "shuttle_usage: admin all"
  ON public.shuttle_usage
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
```

No anon or player-role access is needed.

---

## Suggested Build Order

Dependencies flow downward — each step unblocks the next.

```
Step 1: DB — shuttle_batches table + RLS
        (migration 053 — no dependencies)

Step 2: DB — shuttle_usage table + RLS
        (migration 054 — depends on shuttle_batches)

Step 3: Frontend — InventoryView + useShuttleBatches
        (CRUD for batches, standalone admin page)
        Unblocks: shuttle usage recording, P&L

Step 4: Frontend — useShuttleUsage + shuttle usage UI inside SessionView Finance tab
        (depends on Step 1+2+3 — needs batches to exist before logging usage)

Step 5: Frontend — useSessionFinance + FinancePanel (P&L summary card)
        (depends on Step 4 — needs usage rows to compute meaningful P&L)
        Payment status list is free — reuses existing session_registrations.paid

Step 6: Wire Finance tab into SessionView tab switcher
        (depends on Step 5 — FinancePanel must exist before tabbing to it)
```

No migration changes to existing tables are required at any step.

---

## Critical Notes

1. **`paid` column already exists** on `session_registrations` (mig 042). Do not add it again. `useRoster.ts:updatePaid()` already mutates it — reuse this in the Finance tab payment list.

2. **`sessions.price` already exists** (mig 032). The Finance tab reads this directly for revenue calculation. No new column needed.

3. **Email trigger was rolled back** (mig 050 rolled back mig 046+049). The `paid` flip no longer fires any side effects. Safe to rely on as a plain boolean.

4. **Migrations run via Supabase Dashboard SQL Editor** (CLI blocked on Windows). Number new migrations 053+ and execute manually.

5. **No Realtime subscription needed** for Finance/Inventory. This is admin-only, low-frequency data. Simple query-on-load + manual refresh is sufficient. Do not add a Realtime channel for shuttle_batches or shuttle_usage.
