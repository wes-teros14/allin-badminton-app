# Handoff — current snapshot

Updated: 2026-09-05, ~10:55. Overwrite this file on every update; it is never a running history.

## Just done this session

- **Light mode is real, and there is a toggle.** Nav orb control, in an **Appearance row above
  Sign out on My Profile**. `ThemeProvider` above `<Routes>`; pre-paint script in `index.html`.
  **Dark stays the default** — only an explicit `light` in `localStorage['badminton-theme']`
  switches, so no existing player's app changes until they choose it.
- Fixed the light token block (`--muted` had swapped roles between themes, 106 x `bg-muted`), and
  gave `.live-board-dark` its own `--muted-foreground`.
- **Follow-up fix, same session:** award badges were unreadable in light mode. Root cause was a
  hole in the colour audit — it swept named utilities but not Tailwind arbitrary values, so 13
  hardcoded hex colours in `className` were never checked. See `tasks/lessons.md`.
- **`--gold` split into `--gold` + `--gold-ink`.** One hex cannot be both a medal border (3 : 1)
  and lettering (4.5 : 1) in light mode without rendering darker than the bronze medal. All 13
  hardcoded spots now use tokens.
- Options considered are kept at `badminton-v2/docs/visual/theme-toggle-options.html`.

## Current state

- **Verified**: `tsc -b` and `vite build` clean; vitest **242 / 242**. Both themes rendered in
  Chromium; `/profile` toggle flips, persists and updates aria; `/live-board` stays `#0F0A18` with
  `<html>` light; award badge measured at **5.58 : 1** light and **10.79 : 1** dark.
- **Not verified**: nothing seen on a physical phone; the podium's light gold `#B87A00` has not
  been rendered against real leaderboard data.
- **Deliberate visual change**: the award badge in *dark* mode moved from the live board's neon
  `#FEFE6A` to the app's gold `#FFB200`, so it now matches the award toast and the podium instead
  of being a third yellow. Say if you want the neon back — it would need its own token.
- **Pre-existing lint errors** in `src/hooks/usePlayerSchedule.ts` (3 x `prefer-const`), untouched.

## Needs a decision — Tailwind palette text colours in light mode

Measured in Chromium against a white card (canvas-converted, so these numbers are real). All are on
admin / detail screens, none is a token, and each needs a judgement call on which shade to move to.
**Not changed** — they are a different decision from the gold fix, not the same bug.

| Class | sRGB | On white | Where |
|---|---|---|---|
| `text-amber-400` | 255,185,0 | **1.72 : 1** | `LiveIndicator.tsx` |
| `text-amber-500` | 254,154,0 | **2.13 : 1** | `MatchGeneratorPanel`, `MySessionsView:123`, `SessionPlayerDetailView:290` (last two already have a `dark:` pair) |
| `text-green-500` | 0,201,80 | **2.22 : 1** | `MatchGeneratorPanel` x2, `FinanceView` x2, `FinanceDetailView` |
| `text-orange-500` | 255,105,0 | **2.89 : 1** | `MatchGeneratorPanel` x3 |
| `text-blue-400` | 80,162,255 | **2.64 : 1** | `MatchGeneratorPanel` |
| `text-blue-500` | 43,127,255 | 3.76 : 1 | `MatchGeneratorPanel` |
| `text-pink-500` | 246,51,154 | 3.58 : 1 | `MatchGeneratorPanel` |
| `text-red-500` | 251,44,54 | 3.81 : 1 | `MatchGeneratorPanel` x5, `CourtTabs` x2, `CourtCard`, `PlayerView` x2 |
| `text-amber-600` | 225,113,0 | 3.20 : 1 | `MySessionsView:123`, `SessionPlayerDetailView:290` |

Suggested fix if you want it: move each to its `-600`/`-700` shade for light and keep the current
shade under `dark:`, the way `MySessionsView:123` already does.

## Immediate next steps

1. Open `/profile`, `/leaderboard` and `/sessions` in light mode on a real phone with real data —
   especially the podium, where the gold changed hex.
2. Decide on the palette table above.
3. Clear the 3 `prefer-const` errors in `usePlayerSchedule.ts`.
4. Delete the merged `006-pair-winrate-leaderboard` branch.

## Open questions for the next session

- **Should the orb also go on the nav bar?** It draws in `currentColor` specifically so it can,
  with no rewrite. The chooser flagged "both" as the recommended layout; only the profile row was
  built.
- **Should `Auto` (follow the phone) be added later?** That means swapping the orb for the
  Light/Auto/Dark segment in the same row; the state lives in `ThemeContext`, not the button.
- **Should `/sessions` show `setup` sessions to admins?** Still flagged, still undecided.
- Should the two `tasks/lessons.md` files be consolidated into the root one?
