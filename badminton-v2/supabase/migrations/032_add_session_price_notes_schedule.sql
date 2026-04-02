-- =============================================================
-- Migration: 032_add_session_price_notes_schedule
-- Adds price (pesos), session_notes, and registration_opens_at
-- to sessions. Installs pg_cron job to auto-open registration
-- at the top of every hour.
-- =============================================================

-- 1. Add new columns to sessions
ALTER TABLE public.sessions
  ADD COLUMN price INT,
  ADD COLUMN session_notes TEXT,
  ADD COLUMN registration_opens_at TIMESTAMPTZ;

-- 2. Enable pg_cron extension (requires superuser / Supabase dashboard may be needed)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 3. pg_cron: auto-open registration at the top of every hour
--    Flips status from 'setup' → 'registration_open' when the
--    scheduled time has passed.
SELECT cron.schedule(
  'open-registration-hourly',
  '0 * * * *',
  $$
    UPDATE public.sessions
    SET status = 'registration_open'
    WHERE status = 'setup'
      AND registration_opens_at IS NOT NULL
      AND registration_opens_at <= now()
  $$
);
