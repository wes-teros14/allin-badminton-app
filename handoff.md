# Handoff — current snapshot

Updated: 2026-11-23 Manila. Overwrite this file on every update; it is never a running history.

## Done this session (2026-11-22 → 11-23)
- Explained the Nov 22 outage (owner paused Supabase prod) and the logout on resume (auth-js drops the session on
  non-retryable 500/521; only the owner's browser hit it — 20 failed refreshes from 1 IP, 9 others got 200).
- Xmas Party (Nov 22) finished with Finish Session only: 18 queued + 2 playing games, 0 results, 0 cheers.
- Gallery: photos now open until the session is **closed** (was: until Finish Session). Migration 093 applied to
  Neon dev + production (rules verified both), app code deployed (commit `463d8e5`, main `e06b08f`).

## Current state
- Live: Xmas Party album accepts photos until the owner closes the session.
- Supabase DEV looks paused (hostname doesn't resolve) → Dev Login on localhost fails.
- Neon dev: "Dev Session 4" left finished-not-closed for testing the Gallery window.
- Unrelated untracked files left alone: `badminton-v2/5`, `badminton-v2/docs/lessons.md`, `supabase/.temp/cli-latest`.

## Next steps
1. Owner: resume Supabase DEV in the dashboard if localhost testing is needed; then check the Gallery screens
   (finished-not-closed album shows Add + "Open until closed").
2. Owner: close the Xmas Party session when photos are in.
3. Season reset (parked, `specs/009-season-reset/plan.md`) — Nov 22 is the first 2027 session.

## Open questions
- Offered, not decided: treat Supabase 500/52x token-refresh errors as retryable so a brief outage doesn't sign
  players out.
- Season plan: cheers counted with their March `multiplier` weights — owner hasn't confirmed; task 12 needs a
  prod Data API URL + anon JWT from the owner.
- Carried over: iPhone Safari WebP untested on a real phone; kiosk insert rule; offline-backup phone check;
  Broadcast/share on phones; Nov 1 session not closed; prod `service_role` key not rotated; old Neon test
  branches cleanup (owner: maybe later).
