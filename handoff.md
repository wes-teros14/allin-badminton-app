# Handoff — current snapshot

Updated: 2026-09-05, ~12:10. Overwrite this file on every update; it is never a running history.

## Just done this session

- **Light mode + theme toggle.** Nav orb in an Appearance row above Sign out on My Profile.
  `ThemeProvider` above `<Routes>`; pre-paint script in `index.html`. Dark stays the default.
- **Gold split into `--gold` + `--gold-ink`** after award badges came out invisible in light mode.
  All 13 hardcoded hex colours in `className` now use tokens.
- **All Matches rebuilt (direction A3).** `AllMatchesView` no longer renders twenty identical
  cards. New `src/components/MatchBoard.tsx` holds the board; `PlayerView` keeps the data layer.
- **Leaderboard tab renamed** `Mga Lodi` → `Individual` (`LeaderboardView.tsx:909`).

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
- **Not verified**: nothing seen on a physical phone or against real data.
- **Unchanged on purpose**: `ScheduleView` (the default per-player view at
  `/match-schedule/session/:id/:nameSlug`) still uses `GameCard` and still has **no empty state and
  no payment prompt**. Porting those two is a small step if wanted — see open questions.
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

## Open questions for the next session

- **Should `ScheduleView` get the empty state and payment banner too?** It is the page players
  actually land on, so both fixes matter more there. Both components are already exported from
  `MatchBoard.tsx` and take plain props.
- **Should the orb also go on the nav bar?** It draws in `currentColor` so it can, with no rewrite.
- **Should `/sessions` show `setup` sessions to admins?** Still flagged, still undecided.
- Should the two `tasks/lessons.md` files be consolidated into the root one?
