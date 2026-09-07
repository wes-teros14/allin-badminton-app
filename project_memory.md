# Project Memory — All-In Badminton

Last updated: 2026-09-07

Durable knowledge only. Transient status lives in `handoff.md`.

---

## What this is

- Web app for running weekly badminton sessions: registration, payments, match scheduling, live scoring, leaderboards, finance.
- Single operator/admin (repo owner) plus players who use it on phones. Mobile-first is the default assumption, not an afterthought — the player list views render inside `max-w-sm` (384 px).
- Standard session shape: **16 players, 20 matches**. Not 15.
- Replaces an earlier single-file Python app, kept for reference at `old_badminton_web_app.py` and `old_app_references/`.

## Stack

- React + TypeScript, Vite 8, `react-router` (v7 style imports: `from 'react-router'`, not `react-router-dom`).
- Tailwind v4 — tokens declared as CSS variables in `badminton-v2/src/index.css` and mapped under `@theme inline`. A new brand token needs **both** the `--x` variable and a `--color-x: var(--x)` line, or the utility class won't exist.
- **The app has both themes as of 2026-09-05; dark is the default.** `index.html` no longer hard-codes `class="dark"` — an inline pre-paint script reads `localStorage['badminton-theme']` and only an explicit `light` turns the lights on, so an existing player who never touches the toggle sees no change. `ThemeProvider` (`src/contexts/ThemeContext.tsx`) owns the state and is mounted above `<Routes>` in `App.tsx`, deliberately *not* inside `PlayerLayout` — `/live-board`, `/live-board/:sessionId` and `/register` never mount that layout.
- **Both token blocks now matter.** A token defined in one block but not the other silently resolves to the wrong theme's value. `.live-board-dark` had exactly this bug latent: it uses `text-muted-foreground` but never defined `--muted-foreground`, which worked only while `<html>` was always dark. It now carries its own. `--muted-surface`, `--success`, `--primary-hover` and `--primary-pressed` have zero usages in `src/`, so their values cannot break anything.
- shadcn/ui in `src/components/ui`. Icons: `lucide-react`. Toasts: `sonner`.
- Supabase for auth (Google OAuth + PKCE), Postgres, Storage (receipts), and Realtime.
- Deployed on Vercel.

## Repo layout

- `badminton-v2/` — the actual app. Almost all work happens here.
- Repo root holds orchestration only: `CLAUDE.md`, `tasks/`, `specs/`, `_bmad/`, `_bmad-output/`, `graphify-out/`.
- **Two of several files are duplicated at both levels — the root copy is the live one:**
  - `tasks/lessons.md` (root) is the detailed, actively maintained log. `badminton-v2/tasks/lessons.md` is older and shorter.
  - `docs/` exists only at `badminton-v2/docs/`; there is no root `docs/`.
- BMAD framework v6.2.0 in `_bmad/` (never edit directly); its output goes to `_bmad-output/`.
- Spec Kit features live in `specs/<nnn>-<slug>/`.
- `graphify-out/` holds a generated knowledge graph. Run `graphify update .` after code changes.

## Environments

- Supabase dev project ref: `tsvetqzkullivprbjtli` (`npm run supabase:link:dev`).
- Supabase prod project ref: `ensdfitpeyreunihkqkh` (`npm run supabase:link:prod`).
- Production URL: **badmintontayo.mrkws.com**. The old `all-in-badminton-app.vercel.app` URL is superseded.
- Never read `.env`. If a value is needed, infer the variable name from config code or ask.

## Branching and commits

- Flow is `<nnn>-<feature-slug>` → `dev` → `main`. Feature branches are cut from `dev`.
- **Scan `.claude/settings*.json` before ever staging one.** The allowlist records whole shell
  commands verbatim, so any secret pasted into a command is captured there. `settings.local.json` is
  gitignored for this reason; `settings.json` (hooks only) is tracked.
- Merges into `main` are **non-fast-forward** with the message form:
  `Merge branch 'dev' into main — <short summary>`
- Commits use conventional prefixes with a scope: `feat(leaderboard):`, `fix(sessions):`, `refactor(leaderboard):`.
- Only the feature's own files get committed. Local `.claude/settings*.json` and in-progress `CLAUDE.md` edits are left out deliberately.

## Roles and access

- `Role = 'admin' | 'moderator' | 'player' | null`, read from `profiles.role` by `AuthContext`.
- `AdminRoute` (`badminton-v2/src/App.tsx:10`) admits **admin and moderator**; everything else redirects to `/`.
- Some features are admin-only and exclude moderators (receipt viewing in `RosterPanel`, several `TopNavBar` entries). Check which of the two rules a feature needs before copying either.
- Convention for an inline check is `const isAdmin = role === 'admin' || role === 'moderator'` — written out, no shared helper. Don't introduce one without a reason.

## Routing gotcha

- `/sessions` (**plural**) is the player-facing list; `/sessions/:id` is the player detail view.
- `/session/:id` (**singular**) is the admin session management page.
- The near-identical paths are easy to mix up; always check plurality before linking.
- **Never compare a path with a bare `startsWith`.** `'/sessions'.startsWith('/session')` is true, so
  the nav bar underlined Admin on the player's own session list for as long as that clause existed.
  `isUnder(pathname, base)` in `src/lib/navMatch.ts` is the only matcher to use — it accepts `base`
  itself or anything under `base + '/'`, so a match can only end on a segment boundary. All eight
  `TopNavBar` tabs go through it, not just the one that broke.

## Session lifecycle

- `session_status` enum, `sessions.status NOT NULL DEFAULT 'setup'` (`supabase/migrations/002_create_sessions.sql:21`).
- Order: `setup` → `registration_open` → `registration_closed` → `schedule_locked` → `in_progress` → `complete`.
- `usePlayerSessions` builds `/sessions` from a **union of two queries**, not one: every session with status `registration_open` or `registration_closed` (regardless of registration), plus every session the player holds a registration for (any status). A `setup` session the viewer isn't registered in appears nowhere but `/admin`.
- Creating a session from `AdminView` does not register the creator, so brand-new sessions are invisible on `/sessions` until registration opens.

## Data conventions worth not relearning

- **One derivation helper per concept.** Payment state goes through `src/lib/paymentState.ts` (`derivePaymentState`) on all three surfaces — sessions list, session card, admin panel — because divergent copies previously showed different colours for the same row (FR-020). Same pattern for `sessionStatusStyle.ts` and `sessionStamp.ts`.
- **A match's result comes from `getMatchOutcome()`** (`src/lib/matchResults.ts`), returning `'team1' | 'team2' | 'draw' | null`. `match_results` holds **one row per game inside a match**, so a split-scored match has two; a pair has beaten the other only if it took *every* row, and one game each is a draw. The personal card and the All Games list each derived this themselves until 2026-09-06, and the list read only the earliest row — so a 1-1 was shown as a win for whoever took game 1. `getLegacyWinningPairIndex()` was deleted rather than left available. Both surfaces now call the one helper even though one of the two copies had been correct: two correct copies still drift.
- **Date formatting**: always `'en-US'` and always append `'T00:00:00'` to a bare `YYYY-MM-DD`. Parsed bare, it is UTC midnight and renders as the previous day anywhere west of Greenwich.
- **Unbounded reads need paging.** Any query whose result set can exceed one screen uses `.range()` with a stable `.order()`, plus a `{ count: 'exact', head: true }` cross-check that throws on mismatch. PostgREST silently truncates at `db_max_rows` (1000) with no error. The pair leaderboard was the first such query in the codebase.
- **Invariants belong in the database.** Anything an algorithm guarantees can still be violated by a hand-edit form, so the check goes in a Postgres `CHECK` plus a shared validator for a readable error (see `matches_distinct_players_check`, migration 079, and `src/lib/matchPlayers.ts`).
- **Nicknames are not unique.** `profiles.nickname` is free text; `disambiguateDisplayNames` qualifies collisions ("Alexis (Cruz)") so two people don't collapse into one on screen.

## Theming

- Two blocks in `src/index.css`: `:root` (light) and `.dark`. Tailwind's `dark` variant is
  `&:is(.dark *)`, so the class lives on `<html>`.
- **`--muted` is a *surface*, not a text colour.** 106 uses of `bg-muted`, zero bare `text-muted` —
  every muted text in the app is `text-muted-foreground`. The light block shipped with
  `--muted: #6B7280`, a mid-grey text colour, which would have slabbed all 106. It is now
  `#F1ECF6`. If you ever see a grey block where a skeleton should be, this token is why.
- Light-mode values that deliberately differ from dark, all because they land on white:
  `--gold` `#B87A00`, `--destructive` `#B3252B` (6.55 : 1; `#DC595E` was 3.71 : 1),
  `--ring` `#6F3E87`. `--primary` `#6F3E87` is 7.69 : 1 on white and is the same in both.
- **The nav bar is `bg-primary` in both themes**, so it needs no light-mode work — but anything
  drawn on it must use `currentColor`, never `var(--foreground)` (2.37 : 1 on that purple).
  `ThemeToggle` follows this rule so it can be moved onto the nav later without a rewrite.
- **No hardcoded hex in `className`.** `#FEFE6A` (the live board's neon yellow) and `#FFB200` were
  written literally in 13 places and all of them vanished in light mode. They now use tokens. The
  two survivors are the `bg-[#FEFE6A]` notification dots in `TopNavBar`, which are correct because
  that bar is `bg-primary` in both themes. When auditing colours, sweep arbitrary values:
  `grep -rEo "(text|bg|border|fill|stroke|ring)-\[#[0-9A-Fa-f]{3,8}\]" src --include=*.tsx`.
- The toggle mark is one element, `.theme-orb`: a crescent that fills into a disc and throws eight
  rays via `box-shadow`. Not two icons crossfading — nothing pops mid-transition.
- Design options that were considered and rejected are preserved in
  `badminton-v2/docs/visual/theme-toggle-options.html`.

## Testing

- `npm run test:unit` — vitest, `include: ['src/**/*.test.ts']`, `environment: 'node'`. **Node only: there is no DOM or React Testing Library setup**, so pure functions get unit tests and components do not. Extracting logic into a testable helper is the established response to this — and the helper must live in `src/lib/`, not be exported from the component. A test importing a view or component pulls in `AuthContext` → `src/lib/supabase.ts`, which calls `createClient` at module scope and throws `supabaseUrl is required` with no env: the file fails to *collect*, reporting "no tests" rather than a failure. This is why `navMatch.ts` is a lib module.
- `npm run test:e2e` — Playwright, `tests/*.spec.ts`, boots the dev server itself and needs a live Supabase plus `npm run seed` data.
- `npm run build` runs `tsc -b && vite build`. Vercel uses the same strict flags, so an unused import that is harmless in the editor fails the deploy.
- To verify a UI change without Supabase reachable: launch Chromium via Playwright, stub `**/auth/v1/**` and `**/rest/v1/**` with `page.route`, and patch `localStorage.getItem` to answer any `sb-*-auth-token` lookup with a fake session. This renders the real component against fixed data and is how the admin-shortcut work was verified.

## Local development

- `npm run dev` in `badminton-v2/`, serves on `localhost:5173`.
- A dev-only login panel (`DevLoginPanel`) sits in the lower-right corner with one-click sign-in for seeded accounts — admin is `admin@test.local`, password `Test1234!`. Seed with `npm run seed`.
- `curl` is blocked in this environment's bash; use PowerShell `Invoke-WebRequest` to probe a local port.

## Leaderboards

- Four tabs on `/leaderboard`: **Individual** (win rate; called *Mga Lodi* until 2026-09-05), **Partners** (partnership win rate), **Cheers**, **Awards**.
- **Both ranked boards render through one component.** `RankedBoard` / `RankPlace` in `LeaderboardView.tsx` draw a medal podium for places 1–3 and a fixed 34 px numbered chip for every place below, with a divider naming the places actually on screen. Tied and untied places go through the *same* path deliberately — the previous code drew the rank inside the card for untied places and outside it for tied ones, so the rank column never lined up. Keeping the marker column a fixed width is the fix; don't reintroduce a second rendering path for ties.
- **Rank arithmetic lives in `src/lib/denseRank.ts`** (`assignDenseRanks`, `cutToPlaces`, `groupByRank`) and is shared. Equal rates take the same place; the next distinct rate takes the next number (1, 1, 2 — never 1, 1, 3); and the cut counts **places, not rows**, so a board may show twelve rows across ten places. Both boards must keep using it — index-based numbering next to dense ranks contradicts itself the moment anyone ties.
- **Eligibility lives in `src/lib/boardEligibility.ts`** — `fetchEligiblePlayerIds()` plus `MIN_SESSIONS_PLAYED` and `RECENT_SESSIONS_WINDOW`. Every surface asks that one function: Individual, Partners, Cheers, Awards, and the award badges on My Profile. The rules are 3+ sessions attended and registered for at least one of the last 4 completed sessions. Partners additionally needs 3 games together and applies the player rules to *both* partners (FR-014a). It was previously inlined four times and the copies had drifted — do not reintroduce a local copy.
- **`ATTENDANCE_AWARD_EXCLUDED` (was `BOARD_EXCLUDED`) gates only two awards** — 📅 Most Sessions Joined and 🔥 Attendance Streak — because those are still raw counts an organiser who attends everything would hold permanently. It deliberately does **not** touch any ranked board: every board scores a rate (win rate, or a cheer share of the player's own total), and a rate cannot be won by turning up more often. It was briefly moved inside `fetchEligiblePlayerIds`, which silently excluded those accounts from Individual and Partners — boards that had never excluded anyone. Do not put it back there.

- **My Profile computes its own award badges.** It has to agree with the Awards tab, so it calls the same `fetchEligiblePlayerIds` and `rankCheerShares(..., { maxPlaces: 1 })`, resolving a tie to nobody the same way. The two files diverged once already, showing badges on profiles that the leaderboard did not award. Change one, check the other.
- First place borrows the existing `--gold` token that the award toast uses, so the app has one gold. Silver and bronze use palette values; bronze is `amber-700` rather than an orange, because an orange wash on the dark card reads as the destructive red.
- **There are two gold tokens, and the split is deliberate.** `--gold` is the medal, border and wash colour (`#FFB200` dark, `#B87A00` light); `--gold-ink` is its text pair (`#FFB200` dark, `#8A5A00` light). One hex cannot do both jobs in light mode: as a border it needs 3 : 1, as text 4.5 : 1, and a gold dark enough for text (`#8A5A00`, 5.58 : 1) renders *darker* than the `amber-700` bronze medal below it on the podium. In dark, `#FFB200` clears both floors on `#1A1025` (10.8 : 1), so the two coincide. Use `text-gold-ink` for any gold lettering and `gold` for everything else.
- **Cheer boards are shares, never counts.** Cheering is compulsory — `PlayerLayout` replaces the whole page with the cheer gate until you have cheered all three other players in the match, and a skip only survives until the next reload. So `cheers_given` and `cheers_received` both come out at three per match played: they rank attendance while looking like they rank merit. Both boards and both awards (🌟/🙌) were removed for that reason; 📅 Most Sessions Joined already says the same thing honestly. The one real choice is *which of the six types*, so the six category boards score `category ÷ cheers_received` with a `MIN_CHEERS_RECEIVED` floor (15 ≈ one session). Do not reintroduce a raw cheer count as a ranking — a count still rewards whoever played most.
- `cheers_received` is exactly the sum of the six category columns (migration 036 increments the total and one category by 1 per row), which is what makes a player's six shares sum to 100%. Any new cheer type must update that trigger or the shares stop adding up.
- `RANK_ICON` (medal-then-digit) is gone. Every ranked surface uses the podium/chip treatment, and the numbered chip is one shared `RankChip` at a fixed 34 px.
- **The Cheers tab shows one category at a time**, behind a six-way switcher. Six stacked boards meant up to eighteen medals per screen — a gold that repeats six times is decoration, not a placing — and the tab measured 3,920 px with only three qualifying players. One at a time it is 1,600 px with exactly one gold. Do not restore the stacked layout.
- **The six cheer types live in `src/lib/cheerTypes.ts`** (`CHEER_CATEGORIES`, `signatureCheer`) with slug, emoji, name, short label and bar colour. Both the leaderboard switcher and the profile bar read it, so a seventh type is added once. Bar colours are fixed hex tuned against `--card`, not tokens — revisit if a light theme lands.
- **My Profile carries a "Cheered for" card** between Sign out and Awards: strongest cheer type, its share, and a bar splitting the player's cheers across all six. It replaced a Cheers section that repeated the same six percentages as stat cards.

## Match schedule board

- **`/match-schedule/session/:id?show=all` renders `AllMatchesView`, which draws
  `src/components/MatchBoard.tsx`.** The board sorts by *state*, not by game number: live games are
  full 2-versus-2 bands, the next three are medium rows, the rest are one-liners, and played games
  fold behind a disclosure with the winner. Chosen over a timeline and a person-first layout;
  options and trade-offs are preserved in `badminton-v2/docs/visual/match-schedule-*.html`.
- **Grouping by court was rejected and cannot work.** A court is assigned only when the admin sends
  a game on, so `useAdminSession` returns `queued` with no court. With two courts running, eighteen
  of twenty games would fall into an "unassigned" column. Any court label on a queued game has to
  read something honest like "first open court", never a number.
- **`--court2` exists because two tints of `--primary` are indistinguishable at 20 px.** Court 1
  uses the brand purple; court 2 is teal (`#1F6F6B` light, `#4FD1C5` dark).
- **Zone wording is status-dependent.** Before `in_progress` the headings read *Starts with* /
  *First on court*; after, *Up next* / *First open court*. Nothing is "next" and no court is open
  before the session starts.
- **`Starts with` holds exactly `sessions.court_count` games; `Up next` previews three.** These are
  two different claims, which is why one literal could not serve both: before the whistle the zone
  states what actually goes on court, and that number is the court count; during play it is just a
  queue preview, where three is arbitrary but harmless. With the zone capped at the court count,
  `Game N of the night` became unreachable and every row in it reads *First on court*.
- **The zones are suppressed when the board is filtered to one player** (`playerFiltered`), because
  they rank by position in the array `MatchBoard` is handed — and a filtered array is not the session
  queue. Game 7 was captioned *First on court* simply for being that player's earliest. A filtered
  list is one flat *Upcoming* run in queue order with no position captions. `On court now` and
  `Played` are unaffected: they read `status`, not position.
- **`Game N` is the largest text on a match card** (20 px, bold, full contrast) — it is what a player
  scans the card for. Both `MatchupBand` and `PersonalGameCard` render the shared `GameNumber`
  component; they previously held byte-identical copies of the line and one was left behind when the
  other was changed.
- **The tabs on `/sessions/:id` are `My Games` / `All Games` / `Leaderboard`** (`TAB_LABELS` in
  `SessionPlayerDetailView.tsx`). The player vocabulary is *games*, not *matches* or *schedule*. The
  `All Matches ↗` link that sat below the receipt block on that page is gone — it duplicated the tab
  directly above it. The one on `/match-schedule/:nameSlug` stays, because that page has no tab bar.
- **The payment banner links to `/sessions/:id`, it does not repeat the receipt upload.** Payment
  otherwise lives entirely on `SessionPlayerDetailView`, so a player could study their games all
  night without being told they still owe. One derivation, one upload flow.
- **Matches render on three surfaces, not two.** `/sessions/:id` → Schedule tab
  (`SessionPlayerDetailView`, and the only one with the GCash QR), `/match-schedule/session/:id/:slug`
  (`ScheduleView`), and `?show=all` (`AllMatchesView`). The first is the one players actually land
  on. All three now draw from `src/components/MatchBoard.tsx`: `PersonalGameCard` for the two
  personal lists, `MatchBoard` for all twenty. `GameCard` and `StatusChip` are gone.
- **The personal lists deliberately do not use the board's zones.** Sorting five games into
  "on court / up next / later" gains nothing and costs a predictable order. What carries over is the
  weight: your live game is a full band, everything else is a compact row.
- **A personal row must name the player.** Rendering only the partner reads as though the partner is
  playing the pair alone — "Boyet vs Chito & Dan" instead of "Ana & Boyet vs Chito & Dan".
- **`/match-schedule/session/:id` without a slug is not a dead end.** `PlayerListViewInner`
  auto-redirects a signed-in, registered player to their own slug with `replace: true`
  (`src/views/PlayerView.tsx:216`). An admin who is not registered falls through to the picker.

## Courts on player screens

- **`PlayerCourtTabs` (`src/components/`) draws every court in the session, one card each**, whether or not the viewer is playing on one. It renders through `MatchupBand` from `MatchBoard.tsx` — the same card the All matches board uses for "On court now" — so a court looks identical everywhere and there is one implementation.
- It is used by **both** `/sessions/:id` and `/match-schedule/session/:id`. It lived inside `PlayerView.tsx` while only the second route used it, so when session cards started linking to `/sessions/:id` players silently lost the overview; the single court they still saw was the `COURT n` chip on their own `PersonalGameCard`, which follows *their* game and vanishes when it ends. A per-player court chip and a session-wide court strip both say "COURT 1" — do not mistake one for the other.
- Both routes **skip the viewer's playing match** in the personal list, because the strip above already shows that court in full. An idle court still gets a card naming what is next on it, so a two-court session never visually shrinks to one.
- `useCourtState` carries `team1`/`team2` with avatars *alongside* the older `t1p1..t2p2` name fields. The names were kept so `LiveBoardView` (kiosk) and `CourtCard` are untouched — do not remove them without checking those two.

## UI copy

- **No personal names in UI text.** Write the role — `the admin`, `Admin confirms it` — and use
  they/them for it. The payment steps hardcoded "Wes confirms it" and "he checks your receipt"; the
  string is not read from a profile, so it breaks the moment anyone else administers a session.
- **GCash and bank transfer are the assumed payment methods.** Do not offer cash as the
  representative alternative — it is the rare path. Step 2's helper is one line: "A GCash or bank
  transfer screenshot is enough."
- **A helper line under a button stays one sentence.** An edge case does not earn space there; it
  makes the common case harder to read. (An admin *can* mark a player paid with no receipt, so the
  skip path is real — it just does not belong in that line.)
- **Past tense, and unambiguous.** The results list reads "A beat B" or "A tied with B". `drew` was
  correct past tense but can be read as *drawn against*; `draw` would have been wrong tense
  altogether next to `beat`.

## Decisions made, and alternatives rejected

- **Admin shortcut on `/sessions` (2026-09-04)** — chose a 44 × 44 icon button pinned to each card's bottom-right corner. Rejected: an inline "Manage" pill in the badge row (the row already carries up to two `shrink-0` pills at 384 px, so a third squeezes the title), and a full-width admin strip under a hairline rule (correct and explicit, but ~45 px taller per card). The corner button was picked because it costs the list no height and never collides with the pills. Revisit the strip if other moderators start using it, or if a second admin action joins the card.
- **The card is one `<Link>`.** An anchor cannot contain an anchor, so any in-card control is either a `<button>` calling `navigate()` with `stopPropagation()`, or an absolutely positioned sibling outside the link. The sibling form is preferred — no event plumbing and correct tab order for free.
- **Documentation standards** (from `_bmad/_memory/tech-writer-sidecar/`): CommonMark, Mermaid v10+ syntax, and **no time estimates** in generated docs.
- **Visual explanations** go in self-contained single-file HTML under `docs/visual/`, no CDN links, must render from disk offline.

## Known warts / unclear

- **A Supabase `service_role` key for the *production* project is in git history.** It sits inside a
  permission-allowlist string in `.claude/settings.local.json`, committed in `7b9c46b` (2026-04-05)
  and present on `dev`, `main` and several pushed feature branches. `service_role` bypasses all RLS.
  **The only real remediation is rotating the key in the Supabase dashboard** — history rewriting
  does not help once it is pushed. As of 2026-09-07 the file is untracked and gitignored so it cannot
  leak again, but the historical commits still contain it. Rotation status: **not done.**
- Root `node_modules/` held only a Vite cache; it and `graphify-out/` (100 MB) are now gitignored,
  so `git status` is finally quiet.
- The `supabase` MCP server currently fails to connect with HTTP 401 (`AUTH_HEADER_REJECTED`). Unrelated to app code, but it means DB inspection has to go through the CLI or the dashboard.
- Two `tasks/lessons.md` files exist (see Repo layout). Unclear whether the `badminton-v2/` copy should be merged into the root one or deleted.
