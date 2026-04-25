-- Rollback: remove all email notification infrastructure

-- 1. Remove pg_cron jobs (migration 049)
SELECT cron.unschedule('email-session-reminder-2day');
SELECT cron.unschedule('email-registration-followup-24hr');

-- 2. Drop triggers (migrations 046, 047)
DROP TRIGGER IF EXISTS on_payment_confirmed ON session_registrations;
DROP TRIGGER IF EXISTS on_session_full ON session_registrations;
DROP TRIGGER IF EXISTS on_schedule_ready ON sessions;

-- 3. Drop trigger functions (migrations 046, 047)
DROP FUNCTION IF EXISTS notify_payment_confirmed();
DROP FUNCTION IF EXISTS notify_session_full();
DROP FUNCTION IF EXISTS notify_schedule_ready();

-- 4. Drop email tables (migration 045)
DROP TABLE IF EXISTS email_logs;
DROP TABLE IF EXISTS app_config;
