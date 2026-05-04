# Stack: Finance & Inventory Feature

**Project:** All-In Badminton App
**Feature:** Finance tab + Shuttle Inventory
**Date:** 2026-05-04

---

## No New Dependencies Required

The existing stack handles everything needed for this feature without additions.

| Need | Existing Solution | Notes |
|------|------------------|-------|
| DB tables + queries | Supabase Postgres + PostgREST | New tables via SQL Editor migrations |
| Forms (batch entry, usage logging) | React Hook Form + Zod | Already installed and used throughout |
| UI components | shadcn/ui + Tailwind CSS v4 | Table, Card, Badge, Dialog all available |
| Monetary display | `Intl.NumberFormat` (built-in) | No library needed — native browser API |
| Data fetching | Supabase JS client (`@supabase/supabase-js`) | Already installed |
| TypeScript types | `supabase gen types` | Must re-run after finance migrations land |
| Tests | Vitest | Unit tests for P&L calculation logic |

## What NOT to Add

- **Charting library** (Recharts, Chart.js): No charts needed — P&L is a summary card, not a graph. Adding a charting lib for one number is over-engineering.
- **State management** (Zustand, Redux): Finance state is local to the Finance tab. React hooks + Supabase client are sufficient.
- **Date library** (date-fns, dayjs): Sessions already have `date` fields. No complex date math needed for finance.
- **Decimal.js**: Store monetary values as `NUMERIC(10,2)` in Postgres. Display with `Intl.NumberFormat`. No JS decimal library needed if arithmetic stays server-side.

## Integration Notes

- All monetary arithmetic should happen in Postgres (via SQL or RPC), not in JavaScript, to avoid floating-point errors.
- `supabase gen types` must be run against dev immediately after shuttle_batches and shuttle_usage migrations land — before any hook is written.
- Migrations numbered 053+ (current last known migration: ~052 based on architecture research).
