# Handoff — current snapshot

Updated: 2026-09-28. Overwrite this file on every update; it is never a running history.

## State

- `dev` and `main` both pushed at session end; working tree clean apart from anything a parallel
  session adds.
- Build (`tsc -b`), lint and all 365 unit tests pass. No migrations, no prod data touched.

## Done this session

- **Celebration order bug** — cheer gate, cheer-toast backlog and podium celebration fired together;
  now cheers first, celebration after (`project_memory.md` → "Cheers first").
- User-tuned: celebration card 4.5 s; confetti 240 pieces with a 3 s trickle.
- Launch backlog of received cheers → one summary toast, See → `/profile` (`lib/cheerBacklog.ts`).
- **Session Leaderboard tab** now draws through the shared `components/RankedBoard.tsx` (extracted
  from `LeaderboardView.tsx`): medal podium, ties in one box, dense ranks on win rate.
- POC: `temporary_files/celebration-order-poc.html`.

## Verified, and how

- Local dev with seeded test accounts: gated player (Multiple Jane) got no celebration while owing
  cheers; S1 Alex got card then toast on top; card measured 5.0 s appear→gone.
- 12 of Alex's cheer notifications marked unread on the **dev** DB → one summary toast; See → `/profile`.
- Session "Test Session" leaderboard at 375 px: place 6 rendered as "2 tied" (both 36%, 5W 9L);
  all-time `/leaderboard` still renders, no console errors.
- Confetti not watched live (the preview pane was hidden, so animation frames were paused); on-screen
  counts came from simulating its physics.

## Immediate next steps

- Watch the next real session: celebration after finishing cheers (release path not exercised live),
  and the session board with real ties.

## Open questions

- `TodayView` (`/today`, unlinked) still has the old index-numbered board — switch to `RankedBoard`
  or delete the view? Not decided.
- Confetti/card animation are per-frame, so on a 120 Hz phone the confetti ends about twice as soon;
  offered to make it time-based, not decided.
- Carried over: no UI for abandoning a game; `temp/` at repo root unresolved; local Supabase CLI link
  still points at prod.
