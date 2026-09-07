# Handoff — current snapshot

Updated: 2026-09-06. Overwrite this file on every update; it is never a running history.

## Just done this session

Naming + zone fixes on the player match screens, then the draw bug. **Pushed**: `origin/dev` =
`0fdeb14`, `origin/main` = `a32c638`. The two items below the rule are **working tree only**.

- **Tabs on `/sessions/:id` renamed**: `Schedule` → **My Games**, `All matches` → **All Games**
  (`SessionPlayerDetailView.tsx`, `TAB_LABELS`).
- **Removed the `All Matches ↗` link on `/sessions/:id`** (it sat below the receipt-upload block and
  duplicated the tab right above it). The one on `/match-schedule/:nameSlug` **stays** — that page
  has no tab bar — but is now plain `All Games`, no arrow. The board's back link is `← My Games`.
- **`Starts with` is now sized by `sessions.court_count`**, not a hardcoded 3. `MatchBoard` takes a
  `courtCount` prop; `zoneSize = sessionStarted ? UP_NEXT_PREVIEW(3) : max(1, courtCount)`. All rows
  in that zone read `First on court` (`Game N of the night` became unreachable once the zone is
  capped at the court count). `AllMatchesView` now selects `court_count`. See `tasks/lessons.md`.
- The in-play `Up next` zone is **deliberately still 3** — it's a queue preview, not a statement
  about courts.
- **Zones collapse when the player filter is used.** `MatchBoard` takes `playerFiltered`; with a
  single player selected the queue renders as one flat `Upcoming` section in queue order, no
  position captions, no `Later`. The zone labels rank by array index, and the filtered array is not
  the session queue — game 7 was being captioned `FIRST ON COURT`. `On court now` and `Played` read
  off `status`, not position, so they are unchanged.
- **`Game N` promoted on both match cards.** Was an 11 px muted line under the court chip; now
  20 px, bold, full contrast — the largest text on the card, because that is what a player scans it
  for. The whole phrase is enlarged, not just the digit (asked for explicitly). `MatchupBand` and
  `PersonalGameCard` held byte-identical copies of that line, so the first pass missed
  "Your next game"; both now render a shared `GameNumber` so a third copy cannot drift.

- **1-1 draws are no longer reported as wins.** `getMatchOutcome()` (`src/lib/matchResults.ts`)
  counts every `match_results` row and returns `team1 | team2 | draw | null`; **both** My Games and
  All Games call it. `BoardMatch.winningPairIndex` → `outcome`; a drawn match reads "A *tied with* B",
  neither pair gilded or greyed; the personal chip reads `Draw`, not `1–1`.
  `getLegacyWinningPairIndex()` deleted. Also cleared the 3 pre-existing `prefer-const` errors in
  `usePlayerSchedule.ts` while in that file. Docs: `docs/visual/win-loss-draw-derivation.html`,
  a Results & scoring topic in `docs/qa-log.html`, and a `tasks/lessons.md` entry.

---

- **Nav bar underlined two tabs at once.** `pathname.startsWith('/session')` also matched
  `/sessions`, so Admin lit up on the player session list. New `src/lib/navMatch.ts` exports
  `isUnder(pathname, base)`, which stops at a segment boundary; all eight tabs use it.
  `src/__tests__/navMatch.test.ts` asserts exactly one tab is active on every route in the table.
  The helper lives in `lib/`, not the component — exported from `TopNavBar.tsx` the test would not
  collect, because importing it pulls in `AuthContext` → `supabase` and vitest has no env.
- **Payment help text no longer assumes GCash, and no longer names the admin.** Step 2 is one line:
  "A GCash or bank transfer screenshot is enough." Step 3's title went `Wes confirms it` →
  `Admin confirms it` and its body dropped both "against GCash" and "he". **Copy rule: no personal
  names in UI text, bank/GCash are the assumed methods (not cash), and keep helper lines to one
  sentence.**

**Verified**: `tsc -b` clean, `vite build` clean, eslint **fully** clean, vitest
**251/251** (3 draw cases, 6 nav-match cases). The court-count fix was rendered in Chromium against the **dev database** as admin: a
`court_count = 2` session shows `STARTS WITH 2` / `LATER 15`, both rows `FIRST ON COURT`, no console
errors; proved the number comes from the column, not the `?? 2` fallback, by temporarily setting the
fallback to 9. **The filter change is not browser-verified** — Mark asked to skip e2e and test it
himself.

## Recently landed (previous sessions, merged and pushed)

Light mode + theme toggle (`ThemeProvider`, pre-paint script, `--gold` /
`--gold-ink` split, all 13 hardcoded hex in `className` tokenised). All Matches board rebuilt as
`src/components/MatchBoard.tsx` (state-sorted zones, court numbers, progress meter, empty state,
payment banner); `GameCard`/`StatusChip` deleted. Podium + dense ranks on every ranked board; cheer
boards scored by share behind a switcher; pair eligibility unified in `lib/boardEligibility.ts`.
`PlayerCourtTabs` extracted and rendered on both player routes.

## Known, not fixed

- **`Avatar.tsx` fallback is weak** — `bg-muted` + one initial, so every Ana/Ate/Alex is the same
  grey circle. Very visible now the board leads with 48 px faces. Mock of the fix (hue from name,
  white letter) is in `docs/visual/match-schedule-a1-progressive.html`, fallback toggle.
- **Nine Tailwind palette text colours are light-hostile** on admin screens — `text-amber-400`
  1.72:1, `text-green-500` 2.22:1, etc. Mostly `MatchGeneratorPanel`, plus `FinanceView`,
  `CourtTabs`, `CourtCard`, `PlayerView`, `LiveIndicator`.
- **Light mode has never been reviewed on the leaderboard screens.** `PODIUM_TINT`
  (`border-gold bg-gold/[0.07]`) was written while the app was dark-only.
- Nothing has been seen on a physical phone.

## Immediate next steps

1. **Chase the stale-game bug Mark reported** on `/session/cb4ba170-…` — one surface kept showing
   game 2 after game 3 went live. He was asked which pair of screens (`/admin` vs `/session/:id`, or
   `/session/:id` vs `/sessions/:id`) and had not answered. First suspicion: the realtime
   subscription on the stale surface not fanning out to every read, same shape as the court-strip
   bug from the previous session.
2. Open the board on a real phone with real data, especially a live session.
3. Decide on the `Avatar` fallback and the light-hostile palette list above.
4. Delete the merged `006-pair-winrate-leaderboard` branch.
5. Sanity-check `MIN_CHEERS_RECEIVED = 15` (`src/lib/cheerShare.ts`) against real
   `player_cheer_stats.cheers_received` — it was an estimate, not a measurement.

## Open questions for the next session

- **Should `ScheduleView` get the empty state and the payment banner?** It has neither; both are
  exported from `MatchBoard.tsx` and take plain props. `/sessions/:id` doesn't need the banner — its
  GCash block sits right above the list.
- Should the theme orb also go on the nav bar? It draws in `currentColor`, so it can, with no rewrite.
- Should `/sessions` show `setup` sessions to admins? Still flagged, still undecided.
- Should the two `tasks/lessons.md` files be consolidated into the root one?
- `--muted-surface` is defined only in `:root`, never in `.dark`, so it resolves near-white in dark
  mode. Nothing in `src/` uses it — fix the token or delete it?
- **Should the uncommitted `CLAUDE.md` additions be committed?** 149 lines adding the Q&A-log rule,
  Self-learning, LESSONS, `.env`, Deciding the Code Approach, Session memory, Visual Explanations
  and Plain Language Recap. Left out of every push so far per the "in-progress CLAUDE.md" convention,
  but they read as finished.
- A community post announcing the cheers revamp **and** the theme was drafted in the 2026-09-06 chat
  but never saved to a file. Ask for it again if still wanted.
