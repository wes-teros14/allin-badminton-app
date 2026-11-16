-- scripts/neon/transform.sql — turn a Supabase-shaped public schema into the Neon one.
--
-- Runs after the schema is loaded (repo migrations, or a pg_dump of prod) on top of pre.sql's
-- shims. Driven by the catalog, not by migration text, so both load paths get the same result.
-- Idempotent. Every step here is listed in the G3 report as a required schema transform.

-- ---------------------------------------------------------------------------
-- 1. Profile creation moves to the app (src/lib/ensureProfile.ts) — G4.
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('auth.users') is not null then
    drop trigger if exists on_auth_user_created on auth.users;
  end if;
end
$$;
drop function if exists public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 2. FKs to auth.users -> public.profiles(id), generated from pg_constraint.
--    profiles.id -> auth.users is dropped (it would point at itself).
--    ON DELETE / ON UPDATE / DEFERRABLE carry over because the definition is reused.
--    Validated (not NOT VALID): on a prod copy an orphan user id fails loudly here.
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
  def text;
  n int := 0;
begin
  if to_regclass('auth.users') is null then
    return;
  end if;
  for r in
    select c.conname, c.conrelid::regclass as tbl, pg_get_constraintdef(c.oid) as def,
           (select array_agg(a.attname order by a.attnum) from pg_attribute a
             where a.attrelid = c.conrelid and a.attnum = any (c.conkey)) as cols
    from pg_constraint c
    where c.contype = 'f' and c.confrelid = 'auth.users'::regclass
    order by 2::text, 1
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
    n := n + 1;
    if r.tbl = 'public.profiles'::regclass and r.cols = array['id']::name[] then
      continue;
    end if;
    def := regexp_replace(r.def, 'REFERENCES auth\.users\(id\)', 'REFERENCES public.profiles(id)');
    if def = r.def then
      raise exception 'transform: unexpected FK definition on %: %', r.tbl, r.def;
    end if;
    execute format('alter table %s add constraint %I %s', r.tbl, r.conname, def);
  end loop;
  raise notice 'transform: % FKs to auth.users handled', n;
end
$$;

-- ---------------------------------------------------------------------------
-- 3. Policies: Supabase's `anon` is Neon's `anonymous`.
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
  new_roles text;
begin
  for r in
    select schemaname, tablename, policyname, roles
    from pg_policies
    where schemaname = 'public' and 'anon' = any (roles)
  loop
    select string_agg(case when x = 'anon' then 'anonymous' else quote_ident(x) end, ', ')
      into new_roles
      from unnest(r.roles) as x;
    execute format('alter policy %I on %I.%I to %s', r.policyname, r.schemaname, r.tablename, new_roles);
  end loop;

  if exists (select from pg_policies where schemaname = 'public'
             and roles && array['anon', 'service_role', 'postgres']::name[]) then
    raise exception 'transform: a policy still names a Supabase-only role';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 4. Live updates: Broadcast (realtime.send) -> append-only public.live_messages,
--    read by Neon Realtime. No RLS (Realtime cannot use RLS tables), no grants to
--    API roles (grants.sql). The per-table rt_* triggers are unchanged; only the two
--    senders change. rt_send_once keeps its once-per-transaction dedupe.
-- ---------------------------------------------------------------------------
create table if not exists public.live_messages (
  id         bigserial   primary key,
  topic      text        not null,
  msg        jsonb       not null,
  created_at timestamptz not null default now()
);
alter table public.live_messages disable row level security;
create index if not exists live_messages_topic_id on public.live_messages (topic, id);
create index if not exists live_messages_created_at on public.live_messages (created_at);

create or replace function public.live_send(p_topic text, p_msg jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.live_messages (topic, msg) values (p_topic, p_msg);
  -- Subscribers only need recent rows (catch-up after reconnect refetches anyway).
  delete from public.live_messages where created_at < now() - interval '10 minutes';
end;
$$;

create or replace function public.rt_send_once(p_topic text, p_payload jsonb, p_dedupe_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  guard text := 'rt_sent.k' || md5(p_topic || '|' || p_dedupe_key);
begin
  if current_setting(guard, true) = '1' then
    return;
  end if;
  perform set_config(guard, '1', true);
  perform public.live_send(p_topic, p_payload);
end;
$$;

create or replace function public.rt_notification_inserted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.live_send(
    'user:' || new.user_id,
    jsonb_build_object('table', 'notifications', 'op', tg_op, 'record', to_jsonb(new))
  );
  return null;
end;
$$;

do $$
begin
  if exists (select from pg_proc where pronamespace = 'public'::regnamespace
             and prosrc ~ '\mrealtime\.') then
    raise exception 'transform: a public function still calls realtime.*';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 5. Supabase-only machinery
-- ---------------------------------------------------------------------------
drop publication if exists supabase_realtime;

-- ensure_rls only exists in a prod dump; event triggers need superuser on Neon anyway.
-- verify.sql asserts RLS on every public table instead.
drop event trigger if exists ensure_rls;
drop function if exists public.rls_auto_enable();

-- The email system (045-050) was rolled back; drop its leftovers if a load brought them.
drop table if exists public.email_logs;
drop table if exists public.app_config;

drop schema if exists realtime cascade;
drop schema if exists storage cascade;
drop schema if exists cron cascade;

-- Scheduled registration opening (D1, owner 2026-11-16). Supabase ran pg_cron hourly
-- (migration 032); pg_cron only runs while a Neon compute is awake, so the app calls this
-- instead whenever a player loads their sessions (src/lib/openDueRegistrations.ts).
-- Idempotent, one UPDATE; the rt_* trigger on sessions tells open screens.
create or replace function public.open_due_registrations()
returns integer
language sql
security definer
set search_path = ''
as $fn$
  with opened as (
    update public.sessions
    set status = 'registration_open'
    where status = 'setup'
      and registration_opens_at is not null
      and registration_opens_at <= now()
    returning 1
  )
  select count(*)::integer from opened;
$fn$;
drop table if exists auth.users;

-- Supabase-only keep-alive target (migration 091); the keepalive Function calls it on Supabase, never here.
drop function if exists public.keepalive_ping();

-- ---------------------------------------------------------------------------
-- 6. Shim roles. DROP OWNED revokes every privilege granted to them.
-- ---------------------------------------------------------------------------
do $$
declare
  r text;
begin
  foreach r in array array['anon', 'service_role', 'postgres'] loop
    if exists (select from pg_roles where rolname = r) then
      -- DROP OWNED needs the role's privileges; the creator only holds ADMIN on it.
      execute format('grant %I to current_user', r);
      execute format('drop owned by %I', r);
      execute format('drop role %I', r);
    end if;
  end loop;
end
$$;
