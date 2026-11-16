-- scripts/neon/verify.sql — assertions after pre + load + transform + grants. Raises on failure.

do $$
declare
  bad text;
begin
  -- RLS on every public table except live_messages (replaces the ensure_rls event trigger).
  select string_agg(relname, ', ') into bad
  from pg_class
  where relnamespace = 'public'::regnamespace and relkind in ('r', 'p')
    and relname <> 'live_messages' and not relrowsecurity;
  if bad is not null then raise exception 'verify: RLS off on %', bad; end if;

  -- No Supabase leftovers.
  select string_agg(nspname, ', ') into bad from pg_namespace where nspname in ('realtime', 'storage', 'cron');
  if bad is not null then raise exception 'verify: shim schemas left: %', bad; end if;
  if to_regclass('auth.users') is not null then raise exception 'verify: auth.users shim left'; end if;
  select string_agg(rolname, ', ') into bad from pg_roles where rolname in ('anon', 'service_role', 'postgres');
  if bad is not null then raise exception 'verify: shim roles left: %', bad; end if;
  select string_agg(conrelid::regclass::text || '.' || conname, ', ') into bad
  from pg_constraint where contype = 'f' and confrelid in
    (select oid from pg_class where relnamespace not in ('public'::regnamespace));
  if bad is not null then raise exception 'verify: FKs outside public: %', bad; end if;
  if exists (select from pg_publication where pubname = 'supabase_realtime') then
    raise exception 'verify: supabase_realtime publication left';
  end if;

  -- live_messages is invisible to API roles.
  if has_table_privilege('anonymous', 'public.live_messages', 'select,insert,update,delete')
     or has_table_privilege('authenticated', 'public.live_messages', 'select,insert,update,delete') then
    raise exception 'verify: API role can touch live_messages';
  end if;

  -- No API role may run a SECURITY DEFINER / trigger function except the listed RPCs.
  select string_agg(p.oid::regprocedure::text, ', ') into bad
  from pg_proc p
  where p.pronamespace = 'public'::regnamespace
    and (p.prosecdef or p.prorettype = 'trigger'::regtype)
    and p.proname not in ('unfinish_match', 'reverse_session_stats')
    and (has_function_privilege('anonymous', p.oid, 'execute')
         or has_function_privilege('authenticated', p.oid, 'execute'));
  if bad is not null then raise exception 'verify: API role can execute %', bad; end if;
  if has_function_privilege('anonymous', 'public.unfinish_match(uuid)', 'execute') then
    raise exception 'verify: anonymous can execute unfinish_match';
  end if;

  -- anonymous writes only where the live board needs them.
  select string_agg(c.relname || ':' || priv, ', ') into bad
  from pg_class c
  cross join unnest(array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) as priv
  where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
    and has_table_privilege('anonymous', c.oid, priv)
    and (c.relname, priv) not in (('match_results', 'INSERT'));
  if bad is not null then raise exception 'verify: unexpected anonymous write grants: %', bad; end if;

  -- Policies migrated in full.
  if (select count(*) from pg_policies where schemaname = 'public') <> 60 then
    raise exception 'verify: expected 60 public policies, found %',
      (select count(*) from pg_policies where schemaname = 'public');
  end if;

  raise notice 'verify: all checks passed';
end
$$;
