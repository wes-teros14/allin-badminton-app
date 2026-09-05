# Handoff — current snapshot

Updated: 2026-09-05, ~10:20. Overwrite this file on every update; it is never a running history.

## Just done this session

- **Light mode is real, and there is a toggle.** Chosen from the options sheet: the **nav orb**
  control, in an **Appearance row above Sign out on My Profile**.
- `index.html` no longer hard-codes `class="dark"`; an inline pre-paint script reads
  `localStorage['badminton-theme']`. **Dark stays the default** — only an explicit `light` switches.
  Existing players see no change until they touch the toggle.
- New: `src/contexts/ThemeContext.tsx`, `src/hooks/useTheme.ts`, `src/components/ThemeToggle.tsx`.
  `ThemeProvider` is mounted above `<Routes>` in `App.tsx`, not inside `PlayerLayout`.
- `src/index.css`: fixed the light block (see the table in `tasks/todo.md` for each token and why),
  added the `.theme-orb` styles, and gave `.live-board-dark` its own `--muted-foreground`.
- Earlier in the session: the toggle **chooser** at
  `badminton-v2/docs/visual/theme-toggle-options.html` — three controls x four locations, live in
  both themes.

## Current state

- **Verified**: `tsc -b` and `vite build` clean; vitest **242/242**. Rendered `/profile` in
  Chromium against stubbed Supabase in both themes — orb 44 x 44 button, correct crescent/disc
  geometry, `aria-checked` and `aria-label` flip, choice persists to `localStorage`, zero page
  errors. `/live-board` verified to stay `#0F0A18` with white text while `<html>` is light.
- **Not verified**: nothing seen on a physical phone; the leaderboard podium's new light gold
  (`#B87A00`) has not been rendered against real data, only computed (3.61 : 1 on white).
- `text-amber-600 dark:text-amber-500` in `MySessionsView.tsx:123` and
  `SessionPlayerDetailView.tsx:290` now actually take their light branch. Amber-600 on white is
  roughly 3.3 : 1 on `text-xs` — under AA. Pre-existing pair, left alone, worth a look.
- **Pre-existing lint errors** in `src/hooks/usePlayerSchedule.ts` (3 x `prefer-const`), untouched,
  still failing `npm run lint`.
- Pushed to `dev` and merged into `main`.

## Immediate next steps

1. Open `/profile`, `/leaderboard` and `/sessions` in light mode on a real phone with real data —
   especially the podium, where the gold changed hex.
2. Decide on the two `text-amber-600` spots above.
3. Clear the 3 `prefer-const` errors in `usePlayerSchedule.ts`.
4. Delete the merged `006-pair-winrate-leaderboard` branch.

## Open questions for the next session

- **Should the orb also go on the nav bar?** It draws in `currentColor` specifically so it can,
  with no rewrite. The chooser flagged "both" as the recommended layout; only the profile row was
  built. Ask players whether two taps is too many.
- **Should `Auto` (follow the phone) be added later?** The orb is two-state by nature, so this
  would mean swapping it for the Light/Auto/Dark segment in the same row.
- **Should `/sessions` show `setup` sessions to admins?** Still flagged, still undecided.
- Should the two `tasks/lessons.md` files be consolidated into the root one?
