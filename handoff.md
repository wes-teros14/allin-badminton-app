# Handoff — current snapshot

Updated: 2026-09-06. Overwrite this file on every update; it is never a running history.

> **Two Claude sessions ran in parallel on 2026-09-05/06** — one on theming and the All Matches
> board (below), one on leaderboards, cheers and courts (further down). Both are merged and pushed.
> `origin/dev` = `f6f1e13`, `origin/main` = `321e036`; every commit on dev is in main.

## Just done this session

- **Light mode + theme toggle.** Nav orb in an Appearance row above Sign out on My Profile.
  `ThemeProvider` above `<Routes>`; pre-paint script in `index.html`. Dark stays the default.
- **Gold split into `--gold` + `--gold-ink`** after award badges came out invisible in light mode.
  All 13 hardcoded hex colours in `className` now use tokens.
- **All Matches rebuilt (direction A3).** `AllMatchesView` no longer renders twenty identical
  cards. New `src/components/MatchBoard.tsx` holds the board; `PlayerView` keeps the data layer.
- **Leaderboard tab renamed** `Mga Lodi` → `Individual` (`LeaderboardView.tsx:909`).

## Also done — leaderboards, cheers, courts (second session)

- **Podium + 34 px rank chips on every ranked board**; a tie is drawn once with an "N tied" caption.
  The Individual board gained **dense ranks** (it had numbered by array index) and now cuts on
  **places, not rows**. `RANK_ICON` is gone.
- **Cheer boards scored by share, not count.** "Most Cheers Received/Given" removed — cheering is
  compulsory after every game, so both were 3-per-match attendance counts. The six categories sit
  behind a switcher, one at a time (six stacked boards meant up to 18 medals and ~3,900 px).
- **"Cheered for" card on My Profile** — signature cheer plus a distribution bar.
- **Pair eligibility**: both partners need 3+ sessions (FR-014a). Eligibility unified in
  `src/lib/boardEligibility.ts`; `ATTENDANCE_AWARD_EXCLUDED` now gates only the two count-based
  attendance awards, never a ranked board.
- **Admin shortcut button** on each `/sessions` card.
- **Courts on `/sessions/:id`**: that page had *no* court overview at all — a player saw only the
  court chip on their own card, and nothing once their game ended. `PlayerCourtTabs` extracted to
  `src/components/` and rendered on both player routes, one `MatchupBand` card per court. Verified
  against the **real dev database**, unlike most of the rest.

## What the new board does

- Sorted by **state**: live games as 2-v-2 matchup bands (48 px avatars), the next three as medium
  rows, the rest one line each, everything played folded behind a disclosure **with the winner**.
- **Court number** now shown at all — it was only on the other schedule view before. `--court2`
  token added (teal) because two tints of the brand purple are not tellable apart at 20 px.
- **Progress meter** and a status line (date · status · venue) in the header.
- **Empty state** for `registration_open` / `registration_closed`. The page used to render a header
  over blank space for those two statuses; there was no empty state anywhere.
- **Payment banner** under the header when `derivePaymentState() !== 'paid'` — amount, a line tying
  it to the player's own games, and a hand-off to `/sessions/:id`. It does **not** duplicate the
  receipt upload.
- Zone wording changes before the session starts: **Starts with** / *First on court* instead of
  **Up next** / *First open court*, because no court is running yet.

## Current state

- **Verified**: `tsc -b` and `vite build` clean; vitest **242/242**. The real route rendered in
  Chromium against stubbed Supabase across all five session states — correct zones, band count,
  meter, and payment banner in each; zero page errors.
- **Not verified**: nothing seen on a physical phone. **Light mode has not been reviewed by the
  leaderboard session at all** — the podium's `PODIUM_TINT` (`border-gold bg-gold/[0.07]`) was
  written while the app was still dark-only. The courts fix is the one piece checked against real
  data.
- **All three matches surfaces now use the new look.** `GameCard` and `StatusChip` are deleted.
  `PersonalGameCard` (in `MatchBoard.tsx`) draws a player's own games on both
  `/sessions/:id` → Schedule tab and `/match-schedule/session/:id/:nameSlug`; `MatchBoard` draws
  all twenty on `?show=all`.
- `usePlayerSchedule` gained `courtNumber` on each match and `playerAvatarUrl` on the result — both
  additive.
- **Still not on the personal screens**: the empty state and the payment banner. `/sessions/:id`
  already has its own GCash block so it does not need one; `ScheduleView` has neither.
- **Pre-existing lint errors** in `src/hooks/usePlayerSchedule.ts` (3 x `prefer-const`), untouched.

## Known, not fixed

- **`Avatar.tsx` fallback is weak.** `bg-muted` + `text-muted-foreground` + a *single* initial, so
  every Ana/Ate/Alex is the same grey circle. Very visible now that the board leads with 48 px
  faces. Suggested fix (hue from the name, white letter) is mocked in
  `docs/visual/match-schedule-a1-progressive.html` — press the fallback toggle.
- **Nine Tailwind palette text colours are light-hostile** on admin screens — `text-amber-400`
  1.72:1, `text-green-500` 2.22:1, and so on. Measured list was in the previous handoff; mostly
  `MatchGeneratorPanel`, plus `FinanceView`, `CourtTabs`, `CourtCard`, `PlayerView`, `LiveIndicator`.

## Immediate next steps

1. Open the board on a real phone with real data — especially a live session, where the two bands
   take most of the first screen.
2. Decide on the `Avatar` fallback and the palette list above.
3. Clear the 3 `prefer-const` errors in `usePlayerSchedule.ts`.
4. Delete the merged `006-pair-winrate-leaderboard` branch.
5. Sanity-check `MIN_CHEERS_RECEIVED = 15` (`src/lib/cheerShare.ts`) against the real spread of
   `player_cheer_stats.cheers_received` — it was an estimate, not a measurement.
6. Check the leaderboard podium and the two court cards **in light mode** on a phone.

## Open questions for the next session

- **Should `ScheduleView` get the empty state and the payment banner?** It has neither. Both are
  exported from `MatchBoard.tsx` and take plain props. `/sessions/:id` does not need the banner —
  its GCash block is right above the list.
- **Should the orb also go on the nav bar?** It draws in `currentColor` so it can, with no rewrite.
- **Should `/sessions` show `setup` sessions to admins?** Still flagged, still undecided.
- Should the two `tasks/lessons.md` files be consolidated into the root one?
- `--muted-surface` is defined only in `:root`, never in `.dark`, so it resolves near-white in dark
  mode. Nothing in `src/` uses it — fix the token or delete it?
- A community post announcing the cheers revamp **and** the theme was drafted in the 2026-09-06 chat
  but never saved to a file. Ask for it again if still wanted.
