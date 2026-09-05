# Project Memory — All-In Badminton

Last updated: 2026-09-04

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
- **The app is permanently dark.** `index.html` hard-codes `<html class="dark">` and there is no toggle, so only the `.dark` token block matters in practice. A token defined in `:root` but not in `.dark` still resolves — to its light value — which is a live trap: `--muted-surface` is light-only and would render near-white.
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

## Session lifecycle

- `session_status` enum, `sessions.status NOT NULL DEFAULT 'setup'` (`supabase/migrations/002_create_sessions.sql:21`).
- Order: `setup` → `registration_open` → `registration_closed` → `schedule_locked` → `in_progress` → `complete`.
- `usePlayerSessions` builds `/sessions` from a **union of two queries**, not one: every session with status `registration_open` or `registration_closed` (regardless of registration), plus every session the player holds a registration for (any status). A `setup` session the viewer isn't registered in appears nowhere but `/admin`.
- Creating a session from `AdminView` does not register the creator, so brand-new sessions are invisible on `/sessions` until registration opens.

## Data conventions worth not relearning

- **One derivation helper per concept.** Payment state goes through `src/lib/paymentState.ts` (`derivePaymentState`) on all three surfaces — sessions list, session card, admin panel — because divergent copies previously showed different colours for the same row (FR-020). Same pattern for `sessionStatusStyle.ts` and `sessionStamp.ts`.
- **Date formatting**: always `'en-US'` and always append `'T00:00:00'` to a bare `YYYY-MM-DD`. Parsed bare, it is UTC midnight and renders as the previous day anywhere west of Greenwich.
- **Unbounded reads need paging.** Any query whose result set can exceed one screen uses `.range()` with a stable `.order()`, plus a `{ count: 'exact', head: true }` cross-check that throws on mismatch. PostgREST silently truncates at `db_max_rows` (1000) with no error. The pair leaderboard was the first such query in the codebase.
- **Invariants belong in the database.** Anything an algorithm guarantees can still be violated by a hand-edit form, so the check goes in a Postgres `CHECK` plus a shared validator for a readable error (see `matches_distinct_players_check`, migration 079, and `src/lib/matchPlayers.ts`).
- **Nicknames are not unique.** `profiles.nickname` is free text; `disambiguateDisplayNames` qualifies collisions ("Alexis (Cruz)") so two people don't collapse into one on screen.

## Testing

- `npm run test:unit` — vitest, `include: ['src/**/*.test.ts']`, `environment: 'node'`. **Node only: there is no DOM or React Testing Library setup**, so pure functions get unit tests and components do not. Extracting logic into a testable helper is the established response to this.
- `npm run test:e2e` — Playwright, `tests/*.spec.ts`, boots the dev server itself and needs a live Supabase plus `npm run seed` data.
- `npm run build` runs `tsc -b && vite build`. Vercel uses the same strict flags, so an unused import that is harmless in the editor fails the deploy.
- To verify a UI change without Supabase reachable: launch Chromium via Playwright, stub `**/auth/v1/**` and `**/rest/v1/**` with `page.route`, and patch `localStorage.getItem` to answer any `sb-*-auth-token` lookup with a fake session. This renders the real component against fixed data and is how the admin-shortcut work was verified.

## Local development

- `npm run dev` in `badminton-v2/`, serves on `localhost:5173`.
- A dev-only login panel (`DevLoginPanel`) sits in the lower-right corner with one-click sign-in for seeded accounts — admin is `admin@test.local`, password `Test1234!`. Seed with `npm run seed`.
- `curl` is blocked in this environment's bash; use PowerShell `Invoke-WebRequest` to probe a local port.

## Leaderboards

- Four tabs on `/leaderboard`: **Mga Lodi** (individual win rate), **Partners** (partnership win rate), **Cheers**, **Awards**.
- **Both ranked boards render through one component.** `RankedBoard` / `RankPlace` in `LeaderboardView.tsx` draw a medal podium for places 1–3 and a fixed 34 px numbered chip for every place below, with a divider naming the places actually on screen. Tied and untied places go through the *same* path deliberately — the previous code drew the rank inside the card for untied places and outside it for tied ones, so the rank column never lined up. Keeping the marker column a fixed width is the fix; don't reintroduce a second rendering path for ties.
- **Rank arithmetic lives in `src/lib/denseRank.ts`** (`assignDenseRanks`, `cutToPlaces`, `groupByRank`) and is shared. Equal rates take the same place; the next distinct rate takes the next number (1, 1, 2 — never 1, 1, 3); and the cut counts **places, not rows**, so a board may show twelve rows across ten places. Both boards must keep using it — index-based numbering next to dense ranks contradicts itself the moment anyone ties.
- **Eligibility lives in `src/lib/boardEligibility.ts`** — `fetchEligiblePlayerIds()` plus `MIN_SESSIONS_PLAYED`, `RECENT_SESSIONS_WINDOW` and `BOARD_EXCLUDED`. Every surface asks that one function: Mga Lodi, Partners, Cheers, Awards, and the award badges on My Profile. The rules are 3+ sessions attended and registered for at least one of the last 4 completed sessions. Partners additionally needs 3 games together and applies the player rules to *both* partners (FR-014a). It was previously inlined four times and the copies had drifted — do not reintroduce a local copy.
- **My Profile computes its own award badges.** It has to agree with the Awards tab, so it calls the same `fetchEligiblePlayerIds` and `rankCheerShares(..., { maxPlaces: 1 })`, resolving a tie to nobody the same way. The two files diverged once already, showing badges on profiles that the leaderboard did not award. Change one, check the other.
- First place borrows the existing `--gold` token that the award toast uses, so the app has one gold. Silver and bronze use palette values; bronze is `amber-700` rather than an orange, because an orange wash on the dark card reads as the destructive red.
- **Cheer boards are shares, never counts.** Cheering is compulsory — `PlayerLayout` replaces the whole page with the cheer gate until you have cheered all three other players in the match, and a skip only survives until the next reload. So `cheers_given` and `cheers_received` both come out at three per match played: they rank attendance while looking like they rank merit. Both boards and both awards (🌟/🙌) were removed for that reason; 📅 Most Sessions Joined already says the same thing honestly. The one real choice is *which of the six types*, so the six category boards score `category ÷ cheers_received` with a `MIN_CHEERS_RECEIVED` floor (15 ≈ one session). Do not reintroduce a raw cheer count as a ranking — a count still rewards whoever played most.
- `cheers_received` is exactly the sum of the six category columns (migration 036 increments the total and one category by 1 per row), which is what makes a player's six shares sum to 100%. Any new cheer type must update that trigger or the shares stop adding up.
- `RANK_ICON` (medal-then-digit) is gone. Every ranked surface uses the podium/chip treatment, and the numbered chip is one shared `RankChip` at a fixed 34 px.
- **The Cheers tab shows one category at a time**, behind a six-way switcher. Six stacked boards meant up to eighteen medals per screen — a gold that repeats six times is decoration, not a placing — and the tab measured 3,920 px with only three qualifying players. One at a time it is 1,600 px with exactly one gold. Do not restore the stacked layout.
- **The six cheer types live in `src/lib/cheerTypes.ts`** (`CHEER_CATEGORIES`, `signatureCheer`) with slug, emoji, name, short label and bar colour. Both the leaderboard switcher and the profile bar read it, so a seventh type is added once. Bar colours are fixed hex tuned against `--card`, not tokens — revisit if a light theme lands.
- **My Profile carries a "Cheered for" card** between Sign out and Awards: strongest cheer type, its share, and a bar splitting the player's cheers across all six. It replaced a Cheers section that repeated the same six percentages as stat cards.

## Decisions made, and alternatives rejected

- **Admin shortcut on `/sessions` (2026-09-04)** — chose a 44 × 44 icon button pinned to each card's bottom-right corner. Rejected: an inline "Manage" pill in the badge row (the row already carries up to two `shrink-0` pills at 384 px, so a third squeezes the title), and a full-width admin strip under a hairline rule (correct and explicit, but ~45 px taller per card). The corner button was picked because it costs the list no height and never collides with the pills. Revisit the strip if other moderators start using it, or if a second admin action joins the card.
- **The card is one `<Link>`.** An anchor cannot contain an anchor, so any in-card control is either a `<button>` calling `navigate()` with `stopPropagation()`, or an absolutely positioned sibling outside the link. The sibling form is preferred — no event plumbing and correct tab order for free.
- **Documentation standards** (from `_bmad/_memory/tech-writer-sidecar/`): CommonMark, Mermaid v10+ syntax, and **no time estimates** in generated docs.
- **Visual explanations** go in self-contained single-file HTML under `docs/visual/`, no CDN links, must render from disk offline.

## Known warts / unclear

- `node_modules/` shows as untracked at the repo root rather than ignored. Unclear whether that is deliberate; it has not caused a problem, but it means `git status` is always noisy.
- The `supabase` MCP server currently fails to connect with HTTP 401 (`AUTH_HEADER_REJECTED`). Unrelated to app code, but it means DB inspection has to go through the CLI or the dashboard.
- Two `tasks/lessons.md` files exist (see Repo layout). Unclear whether the `badminton-v2/` copy should be merged into the root one or deleted.
