-- 090: only admins and moderators may delete a session.
--
-- Found 2026-11-16: prod had a policy "sessions: admin delete" FOR DELETE TO authenticated
-- USING (true) — added outside the migrations, so any signed-in player could delete any
-- session and, by cascade, its games, results and registrations. The Admin screen's Delete
-- button is shown to admins and moderators (AdminRoute), and moderators' deletes only
-- worked through that open policy, so the replacement keeps both roles (owner's choice)
-- and closes it for players. "sessions: admin all" still covers admins as before.

drop policy if exists "sessions: admin delete" on public.sessions;
drop policy if exists "sessions: staff delete" on public.sessions;

create policy "sessions: staff delete" on public.sessions
  for delete to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role in ('admin', 'moderator')
    )
  );
