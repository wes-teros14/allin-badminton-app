-- scripts/neon/pre.sql — run FIRST on an empty Neon database, after the Data API exists
-- (the Data API creates the `anonymous` / `authenticated` roles).
--
-- Two kinds of object:
--   PERMANENT  the Supabase-compatible auth.uid()/role()/email()/jwt(). The Data API is created
--              with --skip-auth-schema, because Neon's own auth schema (pg_session_jwt) is
--              unusable with an external IdP (G0). These keep Supabase's bodies, so the 60
--              policies migrate verbatim.
--   SHIM       just enough of Supabase's auth/realtime/storage/cron and its `anon`/`service_role`
--              roles for Supabase-origin SQL (repo migrations, or a pg_dump of prod) to load.
--              transform.sql removes every shim.
--
-- Idempotent.

-- ---------------------------------------------------------------------------
-- SHIM roles
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select from pg_roles where rolname = 'service_role') then
    create role service_role nologin;
  end if;
  -- Supabase's owner role; migration 045 grants to it by name. Neon's owner is neondb_owner.
  if not exists (select from pg_roles where rolname = 'postgres') then
    create role postgres nologin;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- PERMANENT: auth.* helpers with Supabase's bodies. Neon's Data API sets
-- request.jwt.claims for every request, exactly like PostgREST on Supabase.
-- ---------------------------------------------------------------------------
create schema if not exists auth;

create or replace function auth.uid() returns uuid
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

create or replace function auth.role() returns text
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;

create or replace function auth.email() returns text
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )::text
$$;

create or replace function auth.jwt() returns jsonb
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')
  )::jsonb
$$;

-- ---------------------------------------------------------------------------
-- SHIM auth.users: only the columns the repo's SQL touches (FK target and
-- handle_new_user). transform.sql repoints the FKs to public.profiles and drops it.
-- ---------------------------------------------------------------------------
create table if not exists auth.users (
  id                 uuid primary key,
  email              text,
  raw_user_meta_data jsonb,
  raw_app_meta_data  jsonb,
  created_at         timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- SHIM realtime (Broadcast sender, private-channel policies, publication)
-- ---------------------------------------------------------------------------
create schema if not exists realtime;

create table if not exists realtime.messages (
  id         bigserial primary key,
  topic      text,
  extension  text,
  event      text,
  payload    jsonb,
  private    boolean,
  inserted_at timestamptz default now()
);
alter table realtime.messages enable row level security;

create or replace function realtime.send(payload jsonb, event text, topic text, private boolean default true)
returns void language sql as $$ select $$;

create or replace function realtime.topic() returns text
language sql stable as $$ select null::text $$;

do $$
begin
  if not exists (select from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- SHIM storage (buckets + policies on storage.objects). Storage stays on Supabase.
-- ---------------------------------------------------------------------------
create schema if not exists storage;

create table if not exists storage.buckets (
  id     text primary key,
  name   text,
  public boolean
);

create table if not exists storage.objects (
  id        uuid primary key default gen_random_uuid(),
  bucket_id text,
  name      text,
  owner     uuid
);
alter table storage.objects enable row level security;

create or replace function storage.foldername(name text) returns text[]
language sql immutable as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;

-- ---------------------------------------------------------------------------
-- SHIM pg_cron: registration opening moves to an RPC on app load (D1).
-- apply-migrations.mjs strips `CREATE EXTENSION pg_cron / pg_net`.
-- ---------------------------------------------------------------------------
create schema if not exists cron;

create or replace function cron.schedule(job_name text, schedule text, command text)
returns bigint language sql as $$ select 0::bigint $$;

create or replace function cron.unschedule(job_name text)
returns boolean language sql as $$ select true $$;
