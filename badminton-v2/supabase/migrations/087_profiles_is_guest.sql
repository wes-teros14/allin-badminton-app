-- =============================================================
-- Migration: 087_profiles_is_guest
-- A guest account is a shared login that walk-ins play on. Its games show
-- in the session views (schedule, session Leaderboard tab), but it never
-- appears on an all-time board, award or badge: fetchEligiblePlayerIds
-- (src/lib/boardEligibility.ts) drops every profile with is_guest.
--
-- player_stats is unchanged, so the guest's opponents and partners keep
-- those games in their own all-time stats (decided 2026-10-23).
--
-- Admins toggle it on the Players page (Guest / Not guest); this sets the
-- first one. Admins can already update any profile (migration 043).
-- =============================================================

ALTER TABLE public.profiles
  ADD COLUMN is_guest BOOLEAN NOT NULL DEFAULT false;

UPDATE public.profiles SET is_guest = true WHERE email = 'workislife99@gmail.com';
