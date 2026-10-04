-- =============================================================
-- Migration: 083_drop_pg_net
-- Drops the pg_net extension.
--
-- pg_net was added in 045 for the email triggers and cron jobs (046-049),
-- which 050 rolled back. Verified on 2026-10-04 in both projects: no function
-- calls net.http_*, its queues are empty, and the only cron job is
-- open-registration-hourly. pg_net runs a background worker on the database
-- server, and on the Free plan (NANO) memory is what ran out during the
-- Oct 4 outage (docs/qa-log.html).
--
-- No CASCADE on purpose: if anything still depends on pg_net, this fails
-- instead of silently dropping that dependent object.
-- =============================================================

DROP EXTENSION IF EXISTS pg_net;
