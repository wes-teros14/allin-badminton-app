-- Migration: 045_enable_pgnet_email_logs
-- Enables the pg_net extension (async HTTP from Postgres) and creates:
--   email_logs  — deduplication table for sent emails
--   app_config  — key/value config store read by trigger functions
--
-- app_config stores the edge function URL and a shared auth secret.
-- The auth secret (FUNCTION_AUTH_SECRET) must ALSO be set as a Supabase
-- secret so the edge function can read it from env. They must match.

CREATE EXTENSION IF NOT EXISTS pg_net;

-- Deduplication log — unique constraint prevents duplicate sends
CREATE TABLE public.email_logs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email_type      TEXT        NOT NULL,
  idempotency_key TEXT        NOT NULL,
  recipient_email TEXT        NOT NULL,
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  resend_id       TEXT,
  error           TEXT,
  UNIQUE (email_type, idempotency_key)
);

GRANT ALL ON public.email_logs TO service_role;

-- Config store — read by SECURITY DEFINER trigger functions
CREATE TABLE public.app_config (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Only service_role and postgres (triggers run as postgres) can access
GRANT SELECT ON public.app_config TO service_role;
GRANT SELECT ON public.app_config TO postgres;

-- RLS must be disabled — SECURITY DEFINER triggers cannot read this table with RLS on
ALTER TABLE public.app_config DISABLE ROW LEVEL SECURITY;

-- Seed with placeholder values.
-- After deploying this migration, UPDATE these rows with real values
-- via the Supabase SQL Editor (no special permissions needed for UPDATE):
--
--   UPDATE public.app_config SET value = 'https://<ref>.supabase.co/functions/v1/send-email'
--     WHERE key = 'email_function_url';
--
--   UPDATE public.app_config SET value = '<your-random-secret>'
--     WHERE key = 'function_auth_secret';
--   (must match FUNCTION_AUTH_SECRET set via: npx supabase secrets set FUNCTION_AUTH_SECRET=...)
--
-- Dev URL:  https://tsvetqzkullivprbjtli.supabase.co/functions/v1/send-email
-- Prod URL: https://ensdfitpeyreunihkqkh.supabase.co/functions/v1/send-email

INSERT INTO public.app_config (key, value) VALUES
  ('email_function_url',   'REPLACE_WITH_EDGE_FUNCTION_URL'),
  ('function_auth_secret', 'REPLACE_WITH_SHARED_SECRET');
