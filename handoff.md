# Handoff — current snapshot

Updated: 2026-11-24 Manila. Overwrite this file on every update; it is never a running history.

## Done this session
- Owner's 8 banned "AI design" patterns applied across the whole app (rules + keep-list in
  `project_memory.md` → "Visual rules"). POCs: `temporary_files/ai-pattern-ban-review-poc.html` (first 5 screens),
  `temporary_files/ai-pattern-full-app-poc.html` (remaining 13).
- Commit a1f2705: cheer picker, Sessions card, session page tabs/header/results, profile sections, Home notice board.
- Follow-up commit: leaderboard (underline tabs, square season switch, ruled board with `RankDisc`), cheer/award
  pickers (3-col grid, icon beside word — owner rejected scrolling), leaderboard empty states, Today, celebration
  card disc, profile season link, cheers reminder bar, `TurnBanner` (shared), fee chips, admin status (dot + text),
  Players (no outer card, underline filters, `TwoWaySwitch`), announcer button (solid, icons), toasts (`toastIcons.tsx`),
  generator/roster, Gallery "Live now", live-board reconnect notice.
- `tsc -b` clean, 715/715 unit tests (cheerBacklog test updated for emoji-free toast text), build pass.

## Current state
- Pushed to `dev` and `main` (a1f2705 first five screens, 64aee49 the rest). Vercel deploy not checked.
- Checked on localhost (Neon dev) at 375 px: admin list, Players, leaderboard Awards/Cheers (dark + light), Gallery,
  live-board announcer. **Not seen on screen** (dev data lacks them): Today with results, celebration card, toasts,
  turn banner, fee chips, ranked podium with distinct places.
- Fixed in passing: Today win-rate `text-primary` (2.4:1) → `text-primary-ink`; admin "Playing" white-on-red pill
  (3.7:1) gone; schedule-locked status used hard-coded #FFB200 (invisible in light theme) → `text-gold-ink`.
- Local stash "pre-pull local handoff/cli-latest 2026-11-24" still there (old handoff edits, likely stale).

## Next steps
1. Owner: look at the leaderboard, Today and a cheer toast on a phone after the next live session.
2. Optional: the All Games board's small monospace caps labels ("ON COURT NOW", "UP NEXT") — not one of the 8 rules.
3. Drop the stash once confirmed stale.

## Open questions
- Carried over: Supabase 500/52x token-refresh retry (undecided); iPhone Safari WebP; kiosk insert rule; offline-backup
  phone check; Nov 1 session not closed; prod `service_role` not rotated; old Neon branches.
