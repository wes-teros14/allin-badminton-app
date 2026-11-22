# Season Reset and Year in Review — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every leaderboard, every award, and My Profile show the current season only, with past seasons on a season
switcher and on a private "Your 2026 season" page.

**Architecture:**
- Seasons are explicit date spans in `lib/season.ts`.
- Every board and profile number is computed at read time from raw rows (`matches`, `match_results`,
  `session_registrations`, `cheers`), filtered by session date through an embed.
- The counter tables (`player_stats`, `player_pair_stats`, `player_cheer_stats`) stop being read.
- One `BoardScope` object (season + `asOf` date) flows through every fetcher, so the current season, a past season, a
  board, a badge and a profile all use the same definitions.

**Tech Stack:** React 19, TypeScript, Vite 8, `react-router` v7, Tailwind v4, supabase-js against Neon's Data API,
vitest (`src/__tests__/*.test.ts`, node env).

**Spec:** `specs/009-season-reset/design.md` (approved 2026-11-19). POC: `temporary_files/season-reset-poc.html`.

## Global Constraints

- **No migrations, no schema change, no writes.** All reads only.
- **Seasons:**
  - `2026`: session dates `< 2026-11-16`
  - `2027`: session dates `>= 2026-11-16`
- **Floors, in sessions attended:**
  - 2026: played 3, Individual 4, Cheers 4, Early Bird 8. Window: lifetime.
  - 2027: played 3, Individual 3, Cheers 3, Early Bird 8. Window: the 365 days up to and including `asOf`.
- **Floor scope:** the floors decide who may appear. Ranked numbers (games, wins, shares, award values) count the
  season only.
- **Against the Odds:** the "win rate going in" uses all games before the one being judged, across seasons.
- **Badges:** no award badge on any profile until the current season has **4** completed sessions. Past seasons are
  never held.
- **Current season** = the latest season whose start ≤ today's local date. A past season's `asOf` = the day before the
  next season starts.
- **Past seasons** keep players since deactivated (no `is_active` filter). Guests (`profiles.is_guest`) are excluded
  everywhere.
- **Cheers are counted with `cheers.multiplier`** (weighted). Every cheer since migration 036 has multiplier 1.
- **Reads:**
  - Every read that can exceed 1,000 rows pages with `.range()` on a stable `.order()`, then checks the total with
    `{ count: 'exact', head: true }` and throws on a mismatch.
  - Every query destructures `{ data, error }` and throws `error`. Never write `data ?? []` to hide a failure.
- **A failed load renders an error state, never an empty or closed board.**
- **Never show or imply a player's level.**
- **Verify** with `npm run build` (runs `tsc -b`; `npx tsc --noEmit` checks nothing here) and `npm run test:unit`,
  both from `badminton-v2/`.
- **UI** fits a 384 px column (`max-w-sm`). Load the bencium and ui-typography skills before UI tasks.
- **Commits:** prefixes like `feat(leaderboard):`, on branch `094-season-reset`, only once the owner OKs commits for
  this build. Run `graphify update .` after code changes.

## Review Focus

1. **A cheer reachable by both paths, or by neither.** Neither exists in today's data, but the merge must not double
   count. Test in Task 2: `mergeCheerRows` de-duplicates by id.
2. **A session dated exactly on a boundary, or re-dated by an admin across one.** It belongs to the season of its
   *current* date. Test in Task 1: `seasonForDate('2026-11-16')` → 2027, `'2026-11-15'` → 2026.
3. **A player marked guest or inactive mid-season.**
   - Guest: off every board, current and past.
   - Inactive: off current boards, kept on past ones.
   - Test in Task 5: `rankIndividual` with `includeInactive`.
4. **Paging fails on page 2.** The board shows an error, not a partial count. Test in Task 2: `assertComplete` throws
   when fetched ≠ expected.
5. **A year-page URL for a season the viewer never played, or that isn't past** (`/profile/season/2025`, `/2027`).
   It redirects to `/profile`. Test in Task 10: `resolvePastSeason('2027', today)` → null.

---

### Task 1: Seasons module

**Files:**
- Create: `badminton-v2/src/lib/season.ts`
- Test: `badminton-v2/src/__tests__/season.test.ts`

**Interfaces:**
- Produces:
  - `interface SeasonFloors { played: number; individual: number; cheers: number; earlyBird: number }`
  - `interface Season { id: string; start: string; floors: SeasonFloors; floorWindowDays: number | null }`
    (`start` is an ISO date, inclusive; `floorWindowDays: null` means lifetime)
  - `const SEASONS: readonly Season[]`, oldest first
  - `const BADGE_HOLD_SESSIONS = 4`
  - `interface DateWindow { start: string | null; end: string | null }` (ISO dates; start inclusive, end exclusive;
    `null` = open)
  - `interface BoardScope { season: Season; asOf: string; isCurrent: boolean }`
  - `seasonById(id: string): Season | null`
  - `seasonForDate(date: string): Season`
  - `seasonWindow(season: Season): DateWindow`
  - `currentSeason(today: string): Season`
  - `pastSeasons(today: string): Season[]` (newest first)
  - `boardScope(seasonId: string | null, today: string): BoardScope` (`null` or an unknown id → current)
  - `floorWindow(scope: BoardScope): DateWindow`
  - `inWindow(date: string, w: DateWindow): boolean`
  - `localToday(): string` (device-local `YYYY-MM-DD`)
  - `unboundedScope(floors: SeasonFloors, asOf: string): BoardScope` (for the parity check in Task 12)

- [ ] **Step 1: Write the failing tests** in `season.test.ts`:
  - `seasonForDate('2026-11-15').id === '2026'`, `seasonForDate('2026-11-16').id === '2027'`
  - `currentSeason('2026-11-19').id === '2027'`, `currentSeason('2026-11-10').id === '2026'`
  - `pastSeasons('2026-11-19').map(s => s.id)` equals `['2026']`
  - `boardScope('2026', '2026-11-19')` → `{ isCurrent: false, asOf: '2026-11-15' }`
  - `boardScope(null, '2026-11-19')` → `{ isCurrent: true, asOf: '2026-11-19' }`
  - `boardScope('1999', '2026-11-19').season.id === '2027'`
  - `floorWindow(boardScope(null, '2027-11-20'))` equals `{ start: '2026-11-21', end: '2027-11-21' }`
    (365 days back, `asOf` inclusive)
  - `floorWindow(boardScope('2026', …))` equals `{ start: null, end: '2026-11-16' }`
  - The floors: 2026 `{ played: 3, individual: 4, cheers: 4, earlyBird: 8 }`, 2027
    `{ played: 3, individual: 3, cheers: 3, earlyBird: 8 }`
- [ ] **Step 2:** Run `npm run test:unit -- season`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement** with ISO-date string arithmetic in UTC (`Date.UTC`), so no device timezone shifts a
  boundary.
- [ ] **Step 4:** Run `npm run test:unit -- season`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(season): season spans, floors and board scope`.

### Task 2: Windowed raw-row fetchers

**Files:**
- Create: `badminton-v2/src/lib/seasonData.ts`
- Test: `badminton-v2/src/__tests__/seasonData.test.ts`

**Interfaces:**
- Consumes: `DateWindow` (Task 1).
- Produces:
  - `interface SeasonMatchRow extends PairTallyMatch { id: string; match_results: Array<{ id: string; winning_pair_index: number; game_number: number | null; completed_at: string }>; sessions: { date: string; status: string } }`
  - `fetchSeasonMatches(w: DateWindow, opts?: { finishedSessionsOnly?: boolean }): Promise<SeasonMatchRow[]>`
    - default: `matches.status = 'complete'`, today's Partners rule
    - `finishedSessionsOnly`: `sessions.status = 'complete'`, today's awards rule
    - Each fetcher keeps its own rule, unchanged.
  - `interface AttendanceRow { sessionId: string; sessionDate: string; playerId: string; source: string; registeredAt: string }`
  - `fetchAttendance(w: DateWindow): Promise<AttendanceRow[]>`: registrations in **completed** sessions.
  - `fetchCompletedSessions(w: DateWindow): Promise<Array<{ id: string; date: string }>>`, date ascending.
  - `interface CheerRow { id: string; giverId: string; receiverId: string; slug: CheerTypeSlug; weight: number }`
  - `fetchSeasonCheers(w: DateWindow): Promise<CheerRow[]>`: both paths, merged.
  - `mergeCheerRows(a: CheerRow[], b: CheerRow[]): CheerRow[]`, pure, de-duplicated by `id`.
  - `assertComplete(fetched: number, expected: number | null, what: string): void`

Filters go on the embed:
- matches: `sessions!inner(date, status)` + `.gte('sessions.date', w.start)` / `.lt('sessions.date', w.end)`.
- match-linked cheers: `matches!inner(sessions!inner(date, status))` filtered on `matches.sessions.date`.
- session-linked cheers: `sessions!inner(date, status)`.

Cheers count only in completed sessions. The slug comes from the `cheer_types(slug)` embed; the weight is the
`multiplier` column. Page at 1,000 rows and cross-check every read with the exact count (the
`fetchCompletedMatchesForPairs` pattern), then move that function onto `fetchSeasonMatches`.

- [ ] **Step 1: Write the failing tests:**
  - `mergeCheerRows` with the same id in both inputs returns it once.
  - `assertComplete(999, 1000, 'cheers')` throws an error naming `cheers` and both numbers.
  - `assertComplete(5, null, 'x')` does not throw (no count available).
- [ ] **Step 2:** Run `npm run test:unit -- seasonData`. Expected: FAIL.
- [ ] **Step 3: Implement** the fetchers and pure helpers. Mock `@/lib/supabase` in the test, as
  `boardEligibility.test.ts` does.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5: Check on Neon dev in the browser** (`badminton-v2-dev` launcher, a new tab, the dev login, then
  `await import('/src/lib/seasonData.ts')`):
  - First print `new URL(supabase.from('x').url).host`. It must be `ep-blue-recipe-aodxyifb…`.
  - `fetchSeasonMatches` with a window split at a mid date: the two halves sum to the unbounded count.
- [ ] **Step 6:** Commit `feat(season): windowed match, attendance and cheer reads`.

### Task 3: Pure tallies

**Files:**
- Create: `badminton-v2/src/lib/seasonTally.ts`
- Test: `badminton-v2/src/__tests__/seasonTally.test.ts`

**Interfaces:**
- Consumes: `SeasonMatchRow`, `AttendanceRow`, `CheerRow` (Task 2); `computeStatsFromResults` (`lib/matchResults.ts`).
- Produces:
  - `tallyPlayerGames(matches: readonly SeasonMatchRow[]): Map<string, { games: number; wins: number }>`. One game per
    `match_results` row, matching `player_stats`.
  - `countSessions(rows: readonly AttendanceRow[], w: DateWindow, filter?: (r: AttendanceRow) => boolean): Map<string, number>`
    counts distinct sessions per player.
  - `tallyCheers(rows: readonly CheerRow[]): Map<string, CheerStatsRow>`. Weighted; fills `cheers_received`, the six
    `*_received` fields and `cheers_given`, so `CheerStatsRow` consumers stay unchanged.
  - `tallyHeadToHead(matches: readonly SeasonMatchRow[], playerId: string): { partners: Map<string, number>; opponents: Map<string, number> }`,
    with `player_pair_stats` semantics:
    - partners: games won together
    - opponents: games lost, +1 against each of the two winners

- [ ] **Step 1: Write the failing tests:**
  - A two-game match (team 1 wins game 1, team 2 wins game 2) gives every player `games: 2, wins: 1`.
  - `tallyPlayerGames` on a match whose single result has `winning_pair_index: 2` credits team 2. This is the
    corrected-winner case.
  - `countSessions` counts a player registered twice for one session as 1.
  - `countSessions` with `w = { start: '2026-11-21', end: '2027-11-21' }` counts a session dated `2026-11-21` and not
    one dated `2026-11-20`. That is the 365-versus-366-days rule from the design.
  - `tallyCheers` with one `defense` cheer of weight 3 gives `cheers_received: 3, defense_received: 3`.
  - For `tallyHeadToHead`, A+B beat C+D once: for A, `partners.get(B) === 1`; for C, `opponents.get(A) === 1` and
    `opponents.get(B) === 1`.
- [ ] **Step 2:** Run `npm run test:unit -- seasonTally`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit `feat(season): game, session, cheer and head-to-head tallies`.

### Task 4: Eligibility measured "as of", per season

**Files:**
- Modify: `badminton-v2/src/lib/boardEligibility.ts`
  - replace `fetchEligiblePlayerIds()` and `selectEligible`
  - remove `MIN_SESSIONS_PLAYED` and `MIN_SESSIONS_CHEERS`, which move into season floors
  - keep `RECENT_SESSIONS_WINDOW` and `ATTENDANCE_AWARD_EXCLUDED`
- Modify: `badminton-v2/src/lib/leaderboardData.ts`: remove `MIN_SESSIONS_INDIVIDUAL`.
- Test: `badminton-v2/src/__tests__/boardEligibility.test.ts`. Rewrite the `selectEligible` cases and keep the guest
  pair case.

**Interfaces:**
- Consumes: `BoardScope`, `floorWindow`, `inWindow` (Task 1); `fetchAttendance`, `fetchCompletedSessions` (Task 2);
  `countSessions` (Task 3).
- Produces:
  - `interface EligibilityPool { qualifies(playerId: string, floor: number): boolean; sessionsInWindow(playerId: string): number }`
  - `buildEligibility(input: { sessionCounts: ReadonlyMap<string, number>; recentRegistrants: Iterable<string>; guests: Iterable<string> }): EligibilityPool`
    (pure)
  - `fetchEligibility(scope: BoardScope): Promise<EligibilityPool>`. Inputs:
    - attendance in `floorWindow(scope)`
    - the last `RECENT_SESSIONS_WINDOW` completed sessions with `date <= scope.asOf`
    - guests
  - `fetchBoardPending(scope: BoardScope, floor: number, viewerId: string | null): Promise<{ waiting: number; viewerSessions: number | null }>`
    - `waiting`: players with ≥ 1 game this season who don't qualify
    - `viewerSessions`: the viewer's count when they are one of them, otherwise `null`

- [ ] **Step 1: Write the failing tests:**
  - `qualifies('a', 3)` is true with 3 sessions plus a recent registration; false with 2; false when `a` is a guest;
    false when `a` is not a recent registrant.
  - `qualifies('a', 4)` is false with 3 sessions.
  - `sessionsInWindow('x')` is `0` for an unknown player.
  - Keep `'guest pairs on Partners'` working, with `buildEligibility(...).qualifies(id, 3)` replacing
    `eligible.has(id)`.
- [ ] **Step 2:** Run `npm run test:unit -- boardEligibility`. Expected: FAIL.
- [ ] **Step 3: Implement.** `fetchEligibility` reads attendance through `fetchAttendance(floorWindow(scope))`, so the
  365-day window and its boundary come from Task 1, which already tests them.
- [ ] **Step 4:** Run the tests. Expected: PASS. `npm run build` will fail at the callers; Tasks 5–7 fix them.
- [ ] **Step 5:** Commit `feat(season): eligibility as of a date, floors per season`.

### Task 5: Individual, Partners and Cheers boards take a scope

**Files:**
- Modify: `badminton-v2/src/lib/leaderboardData.ts`
- Modify: `badminton-v2/scripts/xmas2026/dump-prod-boards.ts`, lines 81–91. Pass the 2026 scope and use the new name.
- Test: `badminton-v2/src/__tests__/leaderboardData.test.ts` (new)

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces:
  - `fetchWinsLeaderboard(scope: BoardScope): Promise<LeaderboardEntry[]>`, which replaces `fetchAllTimeLeaderboard`
  - `fetchPairLeaderboard(scope: BoardScope): Promise<PairLeaderboardEntry[]>`
  - `fetchCheerLeaderboard(scope: BoardScope): Promise<CheerLeaderboardEntry[]>`
  - `fetchPlayerStandings(playerId: string, scope: BoardScope): Promise<RankSnapshot>`
  - `rankIndividual(tallies: ReadonlyMap<string, { games: number; wins: number }>, profiles: ReadonlyArray<{ id: string; nickname: string | null; name_slug: string; avatar_url: string | null; is_active: boolean }>, include: (id: string) => boolean, opts: { includeInactive: boolean }): LeaderboardEntry[]`
    (pure; same ordering, dense rank and `MAX_PLACES` cut as today)
- Rules:
  - The profiles read drops `.eq('is_active', true)` and selects `is_active`, so the filter can follow
    `scope.isCurrent`.
  - Floors: Individual uses `scope.season.floors.individual`, Partners `floors.played` (both partners), Cheers
    `floors.cheers`.
  - Partners' 3-games-together counts only the season's matches.

- [ ] **Step 1: Write the failing tests** for `rankIndividual`:
  - Two players on 67% share rank 1.
  - An inactive player is excluded when `includeInactive: false` and kept when `true`.
  - `include` returning false excludes a player *before* ranking, so the next player takes place 1.
- [ ] **Step 2:** Run `npm run test:unit -- leaderboardData`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Individual tallies from `fetchSeasonMatches(seasonWindow)`, shared with Partners through one call per scope.
  - Cheers from `tallyCheers(fetchSeasonCheers(seasonWindow))`.
  - Eligibility from `fetchEligibility(scope)`.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit `feat(leaderboard): Individual, Partners and Cheers per season`.

### Task 6: Awards per season

**Files:**
- Modify: `badminton-v2/src/lib/awardsLeaderboard.ts`, `matchAwardsData.ts`, `earlyBirdData.ts`, `giantSlayer.ts`,
  `earlyBird.ts`
- Test: `badminton-v2/src/__tests__/giantSlayer.test.ts`, `earlyBird.test.ts`, `awardsLeaderboard.test.ts` (new)

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces:
  - `fetchAwardsLeaderboard(scope: BoardScope): Promise<AwardEntry[]>`
  - `fetchMatchAwards(scope: BoardScope)`
  - `fetchEarlyBirds(scope: BoardScope)`
  - `SlayerGame.counts?: boolean`. Default `true`. A `false` game updates the going-in records but is never tallied.
  - `RankEarlyBirdsOptions.qualifies?: (playerId: string) => boolean`. When given, it replaces the `minSessions` check.
  - `longestAttendanceRun(sessionIdsInOrder: readonly string[], attended: ReadonlySet<string>): number` (pure,
    extracted from the inline loop)
- Rules:
  - Most Sessions Joined counts the season's attendance.
  - Attendance Streak is computed over the season's completed sessions.
  - Win Streak takes only the season's matches.
  - Against the Odds fetches finished matches up to the season's end with no lower bound. A game is marked
    `counts: sessionDate >= season.start`.
  - Early Bird scores the season's self-registrations. It qualifies on self-registered sessions in `floorWindow(scope)`
    ≥ `floors.earlyBird`.
  - All awards keep `ATTENDANCE_AWARD_EXCLUDED` as today.
  - Names follow `scope.isCurrent`, as in Task 5: a past season names and places players since deactivated; the
    current season shows active players only.
  - Rule copy reads the floors from the scope. Win Streak's rule drops "ever" for "this season".

- [ ] **Step 1: Write the failing tests:**
  - `tallyUpsets` with 4 prior games marked `counts: false` and an upset game marked `counts: true` gives the underdog
    `{ upsets: 1, underdogGames: 1 }`. The same games all marked `counts: false` give no entry.
  - `rankEarlyBirds(regs, { qualifies: id => id === 'a', minSessions: 99 })` ranks only `a`.
  - `longestAttendanceRun(['s1','s2','s3','s4'], new Set(['s1','s2','s4'])) === 2`.
- [ ] **Step 2:** Run `npm run test:unit -- giantSlayer earlyBird awardsLeaderboard`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** Run the tests. Expected: PASS. Then run `npm run build`: the only errors left should be in the
  views (Tasks 9–11).
- [ ] **Step 5:** Commit `feat(awards): every award per season`.

### Task 7: Profile badges from the boards, with the early-season hold

**Files:**
- Create: `badminton-v2/src/lib/seasonBadges.ts`
- Test: `badminton-v2/src/__tests__/seasonBadges.test.ts`

**Interfaces:**
- Consumes:
  - `fetchCheerLeaderboard`, `fetchAwardsLeaderboard` (Tasks 5–6)
  - `rankCheerShares`, `CHEER_CATEGORIES`
  - `fetchCompletedSessions`, `BADGE_HOLD_SESSIONS`
- Produces:
  - `interface Badge { emoji: string; label: string }`
  - `badgesFor(playerId: string, input: { cheerRows: readonly CheerLeaderboardEntry[]; awards: readonly AwardEntry[]; unlocked: boolean }): Badge[]`
    (pure)
    - Cheer badges go to the sole holder of a category's 1st place; a tie gives none.
    - 📅 is 1st place, shared on a tie.
    - 🐦 ⚡ 🎲 are place 1.
    - `unlocked: false` returns `[]`.
    - Emoji and labels stay exactly as in `ProfileView.tsx`'s `fetchAwards` today.
  - `fetchSeasonBadges(playerId: string, scope: BoardScope): Promise<Badge[]>`, where
    `unlocked = !scope.isCurrent || completed sessions in season >= BADGE_HOLD_SESSIONS`.

- [ ] **Step 1: Write the failing tests:**
  - `unlocked: false` with a 1st place returns `[]`.
  - A cheer category tied for 1st gives no badge.
  - 📅 tied for 1st gives the badge to both tied players.
- [ ] **Step 2:** Run `npm run test:unit -- seasonBadges`. Expected: FAIL.
- [ ] **Step 3: Implement.** Delete `fetchAwards` from `ProfileView.tsx` once Task 10 imports this.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit `feat(profile): badges derived from the season's boards`.

### Task 8: Silent season rollover for celebrations

**Files:**
- Modify: `badminton-v2/src/lib/celebrationStorage.ts`: add `season?: string` to `PlayerCelebrationState`, with no
  version bump. A missing value reads as `'2026'`.
- Modify: `badminton-v2/src/lib/podiumCelebration.ts`
- Modify: `badminton-v2/src/hooks/useLeaderboardCelebration.ts`: evaluate with `boardScope(null, localToday())`,
  compare against the baseline, and write `season`.
- Test: `badminton-v2/src/__tests__/podiumCelebration.test.ts`

**Interfaces:**
- Produces: `baselineForSeason(stored: PlayerCelebrationState, seasonId: string, boards: readonly BoardKey[]): { snapshot: RankSnapshot; bestEver: BestEver }`
  - Same season: returns the stored values.
  - Different season: every board in `boards` maps to `null` (present, unplaced), and `bestEver` is kept.

- [ ] **Step 1: Write the failing tests**, using `newPodiumPlacings(baseline.snapshot, current, baseline.bestEver)`:
  - Stored 2026 `{ wins: 1 }` and current 2027 `{ wins: 2 }` give one `podium` placing for `wins`.
  - Stored 2026 `{ wins: 1 }` and current 2027 `{ wins: 5 }` give nothing: no `drop`, and no `first-appearance`
    because `bestEver.wins` is set.
  - Stored 2026 `{}`, current 2027 `{ pairs: 6 }` and `bestEver` without `pairs` give a `first-appearance`.
  - Stored with `season` missing is treated as `'2026'`.
- [ ] **Step 2:** Run `npm run test:unit -- podiumCelebration celebrationStorage`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit `feat(celebration): silent season rollover`.

### Task 9: Leaderboard screen — season switcher, captions and the states in between

**Files:**
- Modify: `badminton-v2/src/views/LeaderboardView.tsx`
- Create: `badminton-v2/src/components/SeasonSwitcher.tsx`

**Interfaces:**
- Consumes: Tasks 1, 4, 5, 6; `useSearchParams`.
- Produces: `SeasonSwitcher({ value: string; options: Season[]; onChange: (id: string) => void })`.

**Behaviour, from the approved POC:**
- **Header:** the title "Leaderboard", replacing "All-time Leaderboard", with the switcher to its right: current
  season first ("2027 season"), then each past season ("2026").
- **URL:** `?season=` sits beside `?tab=` and `?award=`. With no `?season=`, the current season shows.
- **Captions:** they start with the season, e.g. "**2027 season** · ranked by win rate · min. 3 sessions in the past 12
  months · must be active in the last 5". A past season reads "**2026 season** · final · Mar 22 – Nov 15", with that
  season's floors. All numbers come from `scope`.
- **Between seasons:** if the current season has 0 completed sessions, every tab shows "The 2027 season starts with
  the {date} session" and a "See the 2026 final standings ›" link. The date is the first scheduled session with
  `date >= season.start`; with none, the sentence ends at "starts soon".
- **Nobody qualifies yet:** a board shows "Nobody has reached the minimum yet", the viewer's progress ("You: 2 of 3
  sessions in the past 12 months") and the same link.
- **Pending footer,** from `fetchBoardPending`: "N more players appear once they reach 3 sessions." When the viewer is
  one of them, add "You: x of 3".
- **Load error:** "Couldn't load this board" with a Retry button. Never "No stats recorded yet" after an error.
- **Celebration sweep** (`useOwedSweep`): only when the current season is shown.

- [ ] **Step 1: Implement.**
- [ ] **Step 2:** Run `npm run build`. Expected: PASS for this view.
- [ ] **Step 3: Verify in the browser.** Use a new tab, the mobile preset and the dev login. On Neon dev's seed data,
  click each tab under both seasons and check:
  - every caption and URL
  - the error state, by forcing a failure with `supabase.from = …` in the page
  - a screenshot of the switcher in both themes
- [ ] **Step 4:** Commit `feat(leaderboard): season switcher and season captions`.

### Task 10: My Profile (season) and Your 2026 season page

**Files:**
- Create: `badminton-v2/src/hooks/useSeasonStats.ts`, which replaces `useProfileStats.ts`. Delete the old hook.
- Create: `badminton-v2/src/components/profile/SeasonSections.tsx`, with `CheerSignature`, the Awards and Stats blocks
  moved out of `ProfileView.tsx` unchanged in look.
- Create: `badminton-v2/src/views/YearInReviewView.tsx`
- Modify: `badminton-v2/src/views/ProfileView.tsx`, `badminton-v2/src/App.tsx` (route)
- Test: `badminton-v2/src/__tests__/yearInReview.test.ts`

**Interfaces:**
- Consumes: Tasks 1–7.
- Produces:
  - `useSeasonStats(userId: string | undefined, scope: BoardScope): { stats: SeasonStats | null; cheers: CheerStatsRow | null; error: Error | null; isLoading: boolean; refresh(): void }`
    - `SeasonStats` has the same fields as today's `ProfileStats`.
    - Best partners and toughest opponents come from `tallyHeadToHead`: top 3 each.
  - `SeasonSections({ scope, stats, cheers, badges })`
  - `resolvePastSeason(id: string | undefined, today: string): Season | null`. It returns null unless `id` is a past
    season.
  - `whereYouFinished(playerId, { wins, pairs, cheers }): Array<{ board: string; detail: string }>` (pure):
    - Individual: place and win rate
    - Partners: best place and partner name
    - Cheers: best category place and share
    - A board on which the player is unplaced is left out.

**Behaviour:**
- **My Profile:** section headers carry a "2027 season" label.
  - While the current season has 0 completed sessions, Stats shows its zeros under "Your 2027 season starts with the
    {date} session", using the same date lookup as Task 9's between-seasons card.
  - The "Your 2026 season" card sits above Awards, one per past season with at least 1 session attended. It shows "21 sessions · 88 games" and links to
  `/profile/season/2026`.
  - The board place is *not* computed for the card. That would mean a past-season board fetch on every profile open;
    the place lives on the year page. *(builder call; tell the owner it differs from the POC)*
- **Year page:**
  - "‹ My Profile" back link, then the title "Your 2026 season", then "Mar 22 – Nov 15 · final".
  - Then "Where you finished", then the same `SeasonSections` with the 2026 scope.
  - It belongs to the signed-in player only. `resolvePastSeason` returning null redirects to `/profile`.
- The profile's live refresh on a `player_stats` message stays: the trigger still fires when a result is recorded, so
  it remains the "something changed" signal.

- [ ] **Step 1: Write the failing tests:**
  - `resolvePastSeason('2027', '2026-11-19') === null`; `resolvePastSeason('2025', …) === null`;
    `resolvePastSeason('2026', …)?.id === '2026'`
  - `whereYouFinished` omits a board where the player is unplaced, and names the partner on Partners.
- [ ] **Step 2:** Run `npm run test:unit -- yearInReview`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** Run `npm run test:unit` and `npm run build`. Expected: PASS.
- [ ] **Step 5: Verify in the browser** (new tab, mobile, dev login):
  - My Profile labels and the card
  - the card opens the year page
  - `/profile/season/2027` redirects
  - screenshots of both pages
- [ ] **Step 6:** Commit `feat(profile): season profile and Your 2026 season page`.

### Task 11: Today view and the last counter reads

**Files:**
- Modify: `badminton-v2/src/views/TodayView.tsx`, line 47. Its "career" rate becomes the current season's rate from
  `tallyPlayerGames(fetchSeasonMatches(seasonWindow(current)))`, with the label changed to "season".

- [ ] **Step 1:** Implement.
- [ ] **Step 2:** Run `grep -rn "from('player_stats')\|from('player_pair_stats')\|from('player_cheer_stats')" badminton-v2/src`.
  Expected: no matches.
- [ ] **Step 3:** Run `npm run build && npm run test:unit`. Expected: PASS.
- [ ] **Step 4:** Commit `refactor(today): season rate instead of the career counter`.

### Task 12: Parity on a prod copy, then docs

**Files:**
- Create: `badminton-v2/src/dev/seasonParity.ts`, a dev-only module that nothing in the app imports.
- Modify: `.claude/launch.json`: add a `badminton-v2-rehearsal` entry.
- Modify: `project_memory.md`, `badminton-v2/docs/qa-log.html`, `specs/009-season-reset/design.md` (status)

**Interfaces:**
- Produces: `runSeasonParity(): Promise<{ host: string; diffs: Array<{ board: string; playerId: string; old: unknown; new: unknown }> }>`.
  - It compares the new fetchers, under `unboundedScope(2026 floors, today)`, with values derived from the counter
    tables and the old gate rule (`sessions_attended >= floor` + recent 5 + not a guest).
  - It covers: Individual wins and games, the eligibility set, cheer totals per category, and profile games/wins.

- [ ] **Step 1: Owner step.** The owner supplies the `rehearsal` branch's Data API URL and an anon JWT for the launch
  entry. Never read `.env`. `rehearsal` expires **2026-11-30**; if it is gone, use `production` read-only, which is
  safe because the module only reads.
- [ ] **Step 2: Run** in a new tab: `(await import('/src/dev/seasonParity.ts')).runSeasonParity()`. Print `host`
  first; it must be the rehearsal/production endpoint, not `ep-blue-recipe-aodxyifb` (dev).
- [ ] **Step 3: Expected result.** The only Individual diffs are the 8 known players at ±1 win: Angelo, Saul, Steph
  and Kianne +1; Ann, Sim, Jaz and Bogs −1.
  - Every cheer diff belongs to a player with March cheers, and the weighted total is 6,249.
  - Any other diff is a bug: fix it and re-run.
- [ ] **Step 4: Update docs.**
  - `project_memory.md` Leaderboards section: seasons, read-time windows, counters unread, per-season floors, the
    multiplier decision.
  - qa-log: the parity result.
  - design status: "built".
- [ ] **Step 5:** Run `graphify update .` and commit `docs(season): parity result and memory`.
