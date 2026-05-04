# Features: Finance & Inventory Tab

**Project:** All-In Badminton App
**Feature:** Finance tab + Shuttle Inventory
**Date:** 2026-05-04

---

## Feature Breakdown

### Table Stakes (must have for v1.1)

| Feature | Description | Complexity |
|---------|-------------|------------|
| Shuttle batch management | Admin logs tube purchases: date, brand, quantity, cost per tube | Low |
| Cheapest-first batch ordering | Batches sorted by cost ascending so admin draws cheapest stock first | Low (UI sort) |
| Partial tube tracking | Remaining tubes per batch computed from usage records (`NUMERIC`) | Medium |
| Session shuttle usage log | Admin records how many tubes used per session, linked to a batch | Medium |
| Session P&L summary | Revenue (price × players), shuttle COGS, net profit/loss | Medium |
| Per-player payment status | Admin marks Paid/Unpaid per player per session (moves from Admin tab) | Low (column exists) |
| Current stock level | Total shuttles remaining across all batches | Low (derived query) |

### Differentiators (nice to have, not v1.1)

| Feature | Description | Dependency |
|---------|-------------|------------|
| Session-to-session profit trend | Line chart or table showing profit over recent sessions | Needs 5+ sessions of data |
| Low stock alert | Warn admin when remaining shuttles < 1 session's worth (< 20 pcs) | After v1.1 |
| Shuttle sell price tracking | Track per-shuttle sell price in settings, show revenue from shuttle markup vs court | After v1.1 |
| Batch expiry / quality notes | Track feather vs plastic, batch quality notes | After v1.1 |

### Anti-Features (explicitly exclude)

| Feature | Why Excluded |
|---------|-------------|
| Player-visible cost breakdown | Admin-only data — players see the fee but not cost/profit details |
| Automatic shuttle consumption | "Cheapest-first" is a UI hint, not auto-allocation — admin manually selects batch |
| Multi-currency support | App is PHP only |
| Invoice / receipt generation | Out of scope for a casual weekly club |
| Realtime updates for finance | Finance is low-frequency admin data — no Realtime subscription needed |

---

## Feature Dependencies

```
shuttle_batches (CRUD)
    └── shuttle_usage (per session, references batch)
            └── Session P&L (joins sessions + registrations + usage)
                    └── Finance tab (reads P&L + payment status)

session_registrations.paid (already exists)
    └── Payment status list (reuses existing column + updatePaid mutation)
```

---

## Court Cost Handling

- Court cost is entered per session by the admin (fixed amount, overridable)
- Needs a `court_cost` column on `sessions` table OR a separate field in a `session_financials` table
- Simpler: add `court_cost NUMERIC(10,2)` directly to `sessions` — one column, no extra table
- This feeds into P&L: `net_profit = revenue - court_cost - shuttle_COGS`
