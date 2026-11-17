-- Per-table row count + content hash of every app table (public, except live_messages).
-- Run on Supabase prod (SQL editor / MCP) and on the Neon branch; outputs must match line for line.
set timezone = 'UTC';
select t, n, h from (
  select 'announcements' t, count(*) n, md5(coalesce(string_agg(md5(x::text), '' order by md5(x::text)), '')) h from public.announcements x
  union all select 'announcer_clips' t, count(*) n, md5(coalesce(string_agg(md5(x::text), '' order by md5(x::text)), '')) h from public.announcer_clips x
  union all select 'cheer_later_players' t, count(*) n, md5(coalesce(string_agg(md5(x::text), '' order by md5(x::text)), '')) h from public.cheer_later_players x
  union all select 'cheer_types' t, count(*) n, md5(coalesce(string_agg(md5(x::text), '' order by md5(x::text)), '')) h from public.cheer_types x
  union all select 'cheers' t, count(*) n, md5(coalesce(string_agg(md5(x::text), '' order by md5(x::text)), '')) h from public.cheers x
  union all select 'generator_presets' t, count(*) n, md5(coalesce(string_agg(md5(x::text), '' order by md5(x::text)), '')) h from public.generator_presets x
  union all select 'match_results' t, count(*) n, md5(coalesce(string_agg(md5(x::text), '' order by md5(x::text)), '')) h from public.match_results x
  union all select 'matches' t, count(*) n, md5(coalesce(string_agg(md5(x::text), '' order by md5(x::text)), '')) h from public.matches x
  union all select 'notifications' t, count(*) n, md5(coalesce(string_agg(md5(x::text), '' order by md5(x::text)), '')) h from public.notifications x
  union all select 'payment_exempt_players' t, count(*) n, md5(coalesce(string_agg(md5(x::text), '' order by md5(x::text)), '')) h from public.payment_exempt_players x
  union all select 'payment_settings' t, count(*) n, md5(coalesce(string_agg(md5(x::text), '' order by md5(x::text)), '')) h from public.payment_settings x
  union all select 'player_cheer_stats' t, count(*) n, md5(coalesce(string_agg(md5(x::text), '' order by md5(x::text)), '')) h from public.player_cheer_stats x
  union all select 'player_pair_stats' t, count(*) n, md5(coalesce(string_agg(md5(x::text), '' order by md5(x::text)), '')) h from public.player_pair_stats x
  union all select 'player_stats' t, count(*) n, md5(coalesce(string_agg(md5(x::text), '' order by md5(x::text)), '')) h from public.player_stats x
  union all select 'profiles' t, count(*) n, md5(coalesce(string_agg(md5(x::text), '' order by md5(x::text)), '')) h from public.profiles x
  union all select 'session_finance_notes' t, count(*) n, md5(coalesce(string_agg(md5(x::text), '' order by md5(x::text)), '')) h from public.session_finance_notes x
  union all select 'session_invitations' t, count(*) n, md5(coalesce(string_agg(md5(x::text), '' order by md5(x::text)), '')) h from public.session_invitations x
  union all select 'session_receipts' t, count(*) n, md5(coalesce(string_agg(md5(x::text), '' order by md5(x::text)), '')) h from public.session_receipts x
  union all select 'session_registrations' t, count(*) n, md5(coalesce(string_agg(md5(x::text), '' order by md5(x::text)), '')) h from public.session_registrations x
  union all select 'sessions' t, count(*) n, md5(coalesce(string_agg(md5(x::text), '' order by md5(x::text)), '')) h from public.sessions x
  union all select 'shuttle_batches' t, count(*) n, md5(coalesce(string_agg(md5(x::text), '' order by md5(x::text)), '')) h from public.shuttle_batches x
  union all select 'shuttle_usage' t, count(*) n, md5(coalesce(string_agg(md5(x::text), '' order by md5(x::text)), '')) h from public.shuttle_usage x
) s order by t;
