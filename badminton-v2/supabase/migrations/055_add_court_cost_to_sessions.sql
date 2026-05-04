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
