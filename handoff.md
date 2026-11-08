# Handoff — current snapshot

Updated: 2026-11-08. Overwrite this file on every update; it is never a running history.

## Done this session

- New app logo (bunny "Badminton Tayo!"): favicon + apple-touch + 192/512 icons in `public/`, nav home button uses `src/assets/logo-nav.png` (rounded square). HomeView 80 px logos still `pp-logo.jpeg` (not asked).

## Not verified

- New favicon on real phones / iOS home-screen icon.

- Edit button on a **Live** session (DEV had none) — the live view's refetch after save is untested.
- Price warning with real paid players only tested via a temporary DEV flag (reverted).

## Immediate next steps

- Owner: try Edit on the next live session.
- Nov 1 still finished-not-closed: close it from `/admin` when payments are confirmed.

## Open questions

- Jey's receipt image still in storage (`f4ab4482-…/92801dac-…/282c895d-….jpg`) — delete from Supabase dashboard?
- If Sim recalls the real pairs/winners for Nov 1, results could be added (needs manual `match_results` + match rows edit).
- Carried over: Spotify vs announcer volume; game numbers > 9 use computer voice; Clean Sweep parked; prod migration history out of sync (never `db push` to prod); `temp/` at repo root; prod `service_role` key not rotated; `sessions: admin delete` policy has `qual true` (any authenticated user can delete sessions?) — unclear, not checked.
