# Handoff — current snapshot

Updated: 2026-09-07. Overwrite this file on every update; it is never a running history.

## State

- **Everything is pushed and clean.** `origin/dev` = `3a5c907`, `origin/main` = `115ba80`
  (non-ff merge). Nothing in flight.
- Working tree holds only the three deliberate exclusions — `.claude/settings.json`,
  `.claude/settings.local.json`, `CLAUDE.md` — plus an untracked `todo.md` that this session did not
  create and did not touch.
- `tsc -b` clean, `vite build` clean, eslint clean across the repo, vitest **251/251**.

## Done this session (2026-09-06/07)

All on the player match screens, in eleven commits from `cbcba67` to `3a5c907`.

- **Vocabulary**: tabs on `/sessions/:id` are now `My Games` / `All Games`; the duplicate
  `All Matches ↗` link on that page removed.
- **`Starts with` sized by `sessions.court_count`**, not a hardcoded 3. `Up next` stays at 3 —
  different claim, see `project_memory.md`.
- **Zones suppressed when the board is filtered to one player** — they rank by array position, and a
  filtered array is not the session queue.
- **`Game N` is now the headline on both match cards**, via a shared `GameNumber` component.
- **1-1 draws no longer reported as wins.** `getMatchOutcome()` is the single derivation; both views
  call it; `getLegacyWinningPairIndex()` deleted. The row reads "A tied with B".
- **Nav bar underlined two tabs at once** — `startsWith('/session')` also matched `/sessions`. Fixed
  with `isUnder()` in `src/lib/navMatch.ts`, used by all eight tabs, with 6 tests.
- **Payment copy**: no personal names, GCash/bank rather than cash, one-sentence helper.
- Cleared the 3 long-standing `prefer-const` errors in `usePlayerSchedule.ts`.

Docs written: `docs/visual/win-loss-draw-derivation.html`, a **Results & scoring** topic in
`docs/qa-log.html` (with a Correction callout), and four `tasks/lessons.md` entries.

## Not verified

- **Nothing this session was seen rendered except the court-count fix.** Mark asked to skip e2e from
  the filter change onward and verify himself. The draw row, the filtered zones, the nav fix and the
  payment copy are covered by unit tests and the compiler only.
- **No 1-1 draw has ever been seen on screen.** It needs a session with `split_match_scoring` on and
  a drawn match recorded. The derivation is unit-tested from both orderings of game 1.
- Nothing has been seen on a physical phone.

## Known, not fixed

- **`Avatar.tsx` fallback is weak** — `bg-muted` + one initial, so every Ana/Ate/Alex is the same
  grey circle. Conspicuous now the board leads with 48 px faces. Mock of the fix (hue from name,
  white letter) is in `docs/visual/match-schedule-a1-progressive.html`, fallback toggle.
- **Nine Tailwind palette text colours are light-hostile** on admin screens — `text-amber-400`
  1.72:1, `text-green-500` 2.22:1, etc. Mostly `MatchGeneratorPanel`, plus `FinanceView`,
  `CourtTabs`, `CourtCard`, `PlayerView`, `LiveIndicator`.
- **Light mode has never been reviewed on the leaderboard screens.** `PODIUM_TINT`
  (`border-gold bg-gold/[0.07]`) was written while the app was dark-only.
- The `supabase` MCP server has failed to connect all session (HTTP 401, `AUTH_HEADER_REJECTED`), so
  no DB inspection was possible — use the CLI or dashboard until it is fixed.

## Immediate next steps

1. **The stale-game report is still open and undiagnosed.** On `/session/cb4ba170-…` one surface kept
   showing game 2 after game 3 had gone live. Mark was asked which pair of screens disagreed
   (`/admin` vs `/session/:id`, or `/session/:id` vs `/sessions/:id`) and never answered, so nothing
   was touched. First suspicion: the realtime subscription on the stale surface not fanning out to
   every read — same shape as the court-strip bug before it.
2. Open the board on a real phone with real data, especially a live session.
3. Decide on the `Avatar` fallback and the light-hostile palette list above.
4. Delete the merged `006-pair-winrate-leaderboard` branch.
5. Sanity-check `MIN_CHEERS_RECEIVED = 15` (`src/lib/cheerShare.ts`) against the real spread of
   `player_cheer_stats.cheers_received` — it was an estimate, not a measurement.

## Open questions

- **Should the uncommitted `CLAUDE.md` additions be committed?** 149 lines adding the Q&A-log rule,
  Self-learning, LESSONS, `.env`, Deciding the Code Approach, Session memory, Visual Explanations and
  Plain Language Recap. Held back from every push per the "in-progress CLAUDE.md" convention, but
  they read as finished — and they only take effect elsewhere once committed. Raised twice, undecided.
- **Should the `Draw` chip on My Games instead read `Tied`,** now that the All Games row says
  "tied with"? Mark picked "tied with" for the row knowing the chip says "Draw". A chip is a category
  label and a row is a sentence, so the mismatch may be fine.
- **Should `ScheduleView` get the empty state and the payment banner?** It has neither; both are
  exported from `MatchBoard.tsx` and take plain props. `/sessions/:id` does not need the banner — its
  GCash block sits right above the list.
- Should the theme orb also go on the nav bar? It draws in `currentColor`, so it can, with no rewrite.
- Should `/sessions` show `setup` sessions to admins? Still flagged, still undecided.
- Should the two `tasks/lessons.md` files be consolidated into the root one?
- `--muted-surface` is defined only in `:root`, never in `.dark`, so it resolves near-white in dark
  mode. Nothing in `src/` uses it — fix the token or delete it?
- A community post announcing the cheers revamp **and** the theme was drafted in the 2026-09-06 chat
  but never saved to a file. Ask for it again if still wanted.
