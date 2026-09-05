# Light/dark mode — Nav orb in My Profile

Chosen from `badminton-v2/docs/visual/theme-toggle-options.html`:
**Nav orb control, in an Appearance row above Sign out on My Profile.**

## Plan

- [x] `index.html` — drop the hard-coded `class="dark"`; add a pre-paint inline script so a
      light-mode user never sees a dark flash. Dark stays the default: only an explicit
      `light` in storage turns the lights on.
- [x] `src/contexts/ThemeContext.tsx` (new) — `'light' | 'dark'`, writes the class onto
      `documentElement`, sets `color-scheme`, persists to `localStorage`. Matches the
      `AuthContext` shape exactly (provider + `useTheme` in the same file).
- [x] `src/hooks/useTheme.ts` (new) — thin re-export, matching `src/hooks/useAuth.ts`.
- [x] `src/App.tsx` — mount `ThemeProvider` above `<Routes>`, not inside `PlayerLayout`:
      `/live-board`, `/live-board/:sessionId` and `/register` never mount that layout.
- [x] `src/components/ThemeToggle.tsx` (new) — the 44 x 44 orb button.
- [x] `src/index.css` — `.theme-orb` styles; fix the light token block; give
      `.live-board-dark` its own `--muted-foreground`.
- [x] `src/views/ProfileView.tsx` — Appearance row directly above the Sign out button.
- [x] Verify: `tsc -b`, `vite build`, `npm run test:unit`, and both themes rendered in Chromium.
- [x] Commit, push `dev`, merge `dev` into `main` non-fast-forward, push `main`.

## Token changes, and why each one is necessary

Measured against the surfaces they actually land on. Only tokens the app really uses are touched.

| Token | Light was | Light now | Why |
|---|---|---|---|
| `--muted` | `#6B7280` | `#F1ECF6` | **The critical one.** It is a mid-grey *text* colour in the light block and a *surface* in the dark block. The app uses it as a surface **106 times** (`bg-muted`) and as text **0 times**, so every skeleton, hover state and table header would have rendered as a grey slab. |
| `--gold` | `#FFB200` | `#B87A00` | Used as `border-gold` + `bg-gold/[0.07]` on the podium. `#FFB200` on white is 1.81 : 1 — the first-place medal border would be invisible. `#B87A00` is 3.61 : 1, clearing the 3 : 1 floor for non-text UI. |
| `--destructive` | `#DC595E` | `#B3252B` | 3.71 : 1 on white fails AA for the `text-destructive` Sign out button and the unpaid pills. `#B3252B` is 6.55 : 1. |
| `--background` | `#FFFFFF` | `#FAF7FB` | `--card` is also white, so cards had nothing but a border separating them from the page. A barely-violet ground matches the brand and gives the cards a surface to sit on. |
| `--foreground`, `--card-foreground`, `--popover-foreground` | `#18181B` / `oklch(.145 0 0)` | `#1B1220` | Three near-blacks doing one job, none matching. One violet-tinted near-black at 17.1 : 1 on the new ground. |
| `--ring` | `oklch(.708 0 0)` | `#6F3E87` | Dark mode already uses `--primary` for the focus ring; light used a grey that barely reads. |
| `.live-board-dark --muted-foreground` | (inherited) | `#B39DBB` | **Regression guard.** `LiveBoardView` uses `text-muted-foreground` three times and the scoped block never defined it — it worked only because `<html>` was always `.dark`. Without this the projector board gets dark-grey text on a near-black ground. |

Left alone deliberately: `--success`, `--primary-hover`, `--primary-pressed` and `--muted-surface`
have **zero** usages in `src/`, so their light values cannot break anything. `--primary #6F3E87`
already measures 7.69 : 1 against white and needs no change.

## Review

**Shipped.** Nav orb in an Appearance row above Sign out on My Profile. Dark stays the default —
only an explicit `light` in `localStorage['badminton-theme']` turns the lights on, so no existing
player's app changes appearance until they choose to.

**Verified**
- `tsc -b` and `vite build` clean; vitest **242 / 242**.
- `/profile` rendered in Chromium against stubbed Supabase in both themes: 44 x 44 button, orb
  geometry correct in each state (22 px crescent rotated -25 deg -> 29.2 px box; 0.52 scaled disc ->
  11.4 px box, rays as box-shadows), `aria-checked` and `aria-label` both flip, the choice persists
  to `localStorage`, zero page errors.
- `/live-board` rendered with `<html>` in light mode: still `#0F0A18` with white text and
  `--muted-foreground: #B39DBB`. The regression guard works.

**Not verified**
- Nothing has been seen on a physical phone.
- The podium's new light gold `#B87A00` has been computed (3.61 : 1 on white) but never rendered
  against real leaderboard data.

**Found but deliberately not fixed**
- `text-amber-600 dark:text-amber-500` in `MySessionsView.tsx:123` and
  `SessionPlayerDetailView.tsx:290` now actually take their light branch for the first time.
  Amber-600 on white is roughly 3.3 : 1 at `text-xs`, under the 4.5 : 1 floor. It is a
  deliberately-authored light/dark pair, so it is flagged in `handoff.md` rather than changed here.
- 3 pre-existing `prefer-const` errors in `src/hooks/usePlayerSchedule.ts`, unrelated to this work.
