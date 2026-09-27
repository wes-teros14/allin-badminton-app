# Handoff — current snapshot

Updated: 2026-09-28. Overwrite this file on every update; it is never a running history.

## State

- On `dev`, committed and pushed this session, then merged into `main` and pushed.
- Build (`tsc -b`), lint and all 365 unit tests pass. No migrations, no prod data touched.
- `CLAUDE.md` edit (the "Git push at session end" section) committed this time, at the user's request.

## Done this session

- **Bug:** after a session, the cheer gate and the podium celebration fired together; the bunny card
  and its "View" toast came and went unseen. Fixed: cheers first, celebration after (see
  `project_memory.md` → Data conventions, "Cheers first").
- `useMatchCheers` reports loading until the current `sessionKey` is actually loaded (closed a
  one-render "nothing pending" gap).
- User-tuned: card on screen 4.5 s; confetti 240 pieces with a 3 s trickle.
- Launch backlog of received cheers → one summary toast, See → `/profile` (`lib/cheerBacklog.ts`,
  new test `cheerBacklog.test.ts`).
- POC for the user: `temporary_files/celebration-order-poc.html` (before/after, toast options).

## Verified, and how

- Local dev, Multiple Jane (16 games owed cheers): `__celebrate()` showed no card/toast while gated.
- S1 Alex (none owed): card then toast on top; card measured 5.0 s appear→gone (4.5 + 0.4 fade).
- Marked 12 of Alex's cheer notifications unread on **dev** DB → one summary toast; See → `/profile`.
- Confetti could not be watched (the preview pane was hidden, so animation frames were paused);
  on-screen counts came from simulating its physics frame by frame.

## Immediate next steps

- Watch the next real session: does a player finishing cheers now see the celebration properly?
  The release-after-cheering path was not exercised live (would need 48 test cheers).

## Open questions

- Confetti and card animation are per-frame; on 120 Hz phones confetti ends ~2x sooner. Offered to
  make it time-based; user hasn't decided.
- Carried over: no UI for abandoning a game (hand-run SQL on prod each time).
- Carried over: `temp/` at repo root — move to `temporary_files/` or commit? Unclear.
- Carried over: local Supabase CLI link still points at prod, not dev.
