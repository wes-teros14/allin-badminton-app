-- Migration: 049_cron_email_jobs
-- Registers two pg_cron jobs for time-based email scenarios.
-- pg_cron extension is already enabled (see migration 032).
-- Config values (URL + auth secret) are read from public.app_config.
--
-- Job 1: email-session-reminder-2day
--   Runs daily at 9:00 AM UTC.
--   The edge function finds sessions whose date is exactly 2 days from run_date
--   and emails all registered players for those sessions.
--
-- Job 2: email-registration-followup-24hr
--   Runs every hour at :30 past.
--   The edge function finds registrations that are 24-25 hours old with paid=false
--   and the session still in registration_open status, then sends a payment reminder.

SELECT cron.schedule(
  'email-session-reminder-2day',
  '0 9 * * *',
  $$
    SELECT net.http_post(
      url     := (SELECT value FROM public.app_config WHERE key = 'email_function_url'),
      headers := jsonb_build_object(
                   'Content-Type',  'application/json',
                   'Authorization', 'Bearer ' || (SELECT value FROM public.app_config WHERE key = 'function_auth_secret')
                 ),
      body    := jsonb_build_object(
                   'type',    'session_reminder_2day',
                   'payload', jsonb_build_object(
                     'run_date', to_char(now(), 'YYYY-MM-DD')
                   )
                 )
    )
  $$
);

SELECT cron.schedule(
  'email-registration-followup-24hr',
  '30 * * * *',
  $$
    SELECT net.http_post(
      url     := (SELECT value FROM public.app_config WHERE key = 'email_function_url'),
      headers := jsonb_build_object(
                   'Content-Type',  'application/json',
                   'Authorization', 'Bearer ' || (SELECT value FROM public.app_config WHERE key = 'function_auth_secret')
                 ),
      body    := jsonb_build_object(
                   'type',    'registration_followup_24hr',
                   'payload', jsonb_build_object(
                     'run_at', to_char(now(), 'YYYY-MM-DD"T"HH24":00:00"')
                   )
                 )
    )
  $$
);
