# Season reset and year in review — design

Status: built 2026-11-23 on branch claude/094-season-reset-ab612d (not merged); parity check skipped (owner) · designed 2026-11-19 · POC: `temporary_files/season-reset-poc.html`

## Intent

The 2026 season is over. Its last session was **2026-11-15**, and the session on **2026-11-22** opens the **2027
season**. The owner wants every leaderboard and every player's profile numbers to start again from zero with it. Players can still see their own 2026 numbers through a link on their profile, and anyone can look
back at the 2026 boards.

## Goals

- All four leaderboard tabs (Individual, Partners, Cheers, Awards) rank **the current season only**.
- **Every minimum counts the player's sessions in the past 12 months** (owner's choice, 2026-11-19). Regulars are on
  the boards from the first night of a season; someone returning after a year away starts from zero.
- A **season switcher** on the leaderboard ("2027 season | 2026") shows any past season's final boards.
- **My Profile shows the current season only**: Stats, Cheered for, and award badges.
- Each player can open a **"Your 2026 season"** page from My Profile.
- Past seasons stay correct forever. Fixing an old result later fixes the past season too.

## Non-goals

- No change to how results, cheers or registrations are recorded.
- No new tables, columns or migrations.
- No lifetime or career totals anywhere in the UI (owner's choice).
- Dropping the counter tables. They become unread (see "Counters"); removing them is a separate later decision.

## Anti-goals

These would make it a failure even if it technically works:

- **Any data deleted or any counter zeroed.** Nothing is reset in the database. A season is a date window.
- **A board that looks broken.** A board may be closed, but a closed board always says why, what it is waiting for,
  and where to look instead (last season).
- **A second definition of a rank or a stat.** Season boards, past-season boards, My Profile and the year page all go
  through the same functions in `lib/leaderboardData.ts`, `lib/awardsLeaderboard.ts` and `lib/boardEligibility.ts`,
  and through the profile's own sections, with a season window added. No copy of any logic, however small.
- **A failed load shown as "nothing yet" or "closed".** A read error renders as an error.
- **Anything that shows or implies a player's level.**

## Approaches considered

| | How a row's season is decided | Migration | Picked |
|---|---|---|---|
| **A** | At read time: every query takes a date window on the session's date | None | **Yes** |
| B | At write time: a `season` column stamped on `matches` and `cheers` | Column + backfill | No |
| C | Snapshot 2026 into a table, zero the counters | New table, destructive | No |

**Why A (owner's pick, 2026-11-19):**

- It is the only approach that changes nothing in the database.
- Any season stays viewable, and the season boundary is a date in code. That mattered as soon as the boundary turned
  out not to be 1 January.
- B's one advantage was avoiding embedded filters on Neon, and those were verified to work (below).
- C destroys data.

**Timing:** under A, a game's season is decided when it is read. Games played on Nov 22 before this ships are not lost
or misfiled; they appear in 2027 the moment the code is live. There is no deadline before Sunday.

Visual comparison: `badminton-v2/docs/visual/season-reset-approaches.html`.

## Verified evidence

All measured on 2026-11-19.

- **Embedded range filters work on Neon's Data API.** Checked on Neon dev (`ep-blue-recipe-aodxyifb`) through the
  app's own client, signed in:
  - **One level**, `matches → sessions!inner(date)` with `.gte`/`.lt` on `sessions.date`: 24 + 20 = 44 of 44
    complete matches. That equals the plain `.in('session_id', …)` query, and 0 rows leaked past the filter.
  - **Two levels**, `match_results → matches!inner → sessions!inner(date)`: 24 + 20 = 44 of 44, again 0 leaks.
  - Production already runs embedded *equality* filters on Neon (`sessions!inner(status)` in `matchAwardsData.ts`
    and `earlyBirdData.ts`).
- **Data size.** Measured on the frozen Supabase prod copy (`ensdfitpeyreunihkqkh`), which holds the same data as
  Neon `production` because no session has run since:
  - 41 sessions since 2026-03-22, 545 completed matches, 698 results, 6,177 cheers.
  - Every board can be computed from raw rows. Cheers already exceed the 1,000-row cap, so they need paging.
- **Cheers are linked two ways.**
  - The 71 cheers from 2026-03-23 to 2026-03-30 carry only `session_id`. The other 6,106 carry only `match_id`.
    No cheer has both, and none has neither.
  - A season filter on cheers therefore has two paths: `cheers → matches!inner → sessions!inner(date)` for the
    match-linked rows, and `cheers → sessions!inner(date)` for the March rows.
  - The first path resolves on Neon. Its *counts* are unverified, because Neon dev has 0 cheers.
- **The counters disagree with the rows in two places. The rows are right (owner, 2026-11-19).**
  - **Wins: 8 players differ by exactly one.** Angelo, Saul, Steph and Kianne are one higher in the rows; Ann, Sim,
    Jaz and Bogs are one lower. Games played agree for all 74 players, and the totals agree (2,792 both ways).
  - The cause is two games whose winner was corrected after recording: 2026-09-06 game #12 (one of its two sub-games)
    and 2026-10-04 game #13. The counter trigger fires on `INSERT` only, so the corrections never reached
    `player_stats`.
  - **Cheers: 15 players differ.** `player_cheer_stats` totals 6,243 received, but there are 6,177 cheer rows, and
    every player who differs received March cheers. Migration 024 let one cheer count *N* times.
  - **Correction (2026-11-19):** an earlier version of this doc said migration 036 dropped the `multiplier` column, so
    the March weights were lost. That was wrong. The column is still on prod and on Neon. 37 cheers from 2026-03-23
    to 03-30 carry a multiplier above 1; summed with their weights, all cheers total 6,249. The counter's 6,243 matches
    neither total exactly.
  - **Decision *(my call, owner to confirm)*: count each cheer with its `multiplier`.** That is how those cheers were
    deliberately given and counted at the time, and it changes only March 2026. Every cheer since 036 has
    multiplier 1, so 2027 is unaffected either way. Counting each cheer once instead is a one-line change.

## Design

### Seasons

- A season is a **named span of session dates with an explicit start**, not a calendar year. It lives as a constant
  list in one small module, `lib/season.ts`:
  - **2026**: every session before 2026-11-16
  - **2027**: every session from 2026-11-16 onward
  - Any boundary date between the last session of one season and the first of the next works.
- Starting each new season is a one-line addition to that list, and a deploy. *(my call)* It happens once a year;
  making it settable from Admin would need a table, which this design avoids. That can come later if a yearly code
  change becomes a nuisance.
- **The current season is the latest season whose start date has passed.** From 2026-11-16 that is 2027, even before
  any 2027 session has been played (see "Between seasons").
- `lib/season.ts` exposes the season list, `seasonWindow(season)`, `currentSeason()`, `pastSeasons()` and each
  season's floors. Nothing else knows a boundary date or a floor. The constants `MIN_SESSIONS_PLAYED`,
  `MIN_SESSIONS_INDIVIDUAL` and `MIN_SESSIONS_CHEERS` move there, and every board caption reads them from the season
  it shows.

### Data layer

Every fetcher takes a season window. An unbounded window must still be possible, because the parity test below depends
on it.

- **Individual** stops reading `player_stats`. It tallies games and wins from the season's `match_results` rows, the
  same unit `player_stats` counts today (games, not matches).
- **Partners**: the existing `fetchCompletedMatchesForPairs` gains the window on the `sessions!inner` embed that was
  left there for exactly this (`leaderboardData.ts`).
- Individual and Partners should share one fetch of the season's completed matches with results. Partners already
  pays for this read, including paging and the exact-count cross-check.
- **Cheers** stops reading `player_cheer_stats`. It tallies the season's `cheers` rows by both paths above, merged by
  cheer id. Reads are paged, with an exact-count cross-check that refuses to render a partial board, as Partners does.
- **Awards**: every award's source gets the window — `fetchMatchAwards` (Win Streak, Against the Odds),
  `fetchEarlyBirds`, Most Sessions Joined and Attendance Streak.

### Counters

After this work, no screen reads the stored totals in `player_stats` (games, wins, sessions), `player_pair_stats` or
`player_cheer_stats`. The triggers keep maintaining them, harmlessly. The builder must grep for every remaining reader
and move each one to raw rows. A screen still on a counter would disagree with the boards for the players listed
above.

### Who may appear — sessions in the past 12 months

**Every minimum that decides who may appear on a board counts the player's sessions in the 12 months up to `asOf`**
(owner's choice, 2026-11-19). The floors are unchanged as numbers; only what they count changes. Two rules were
considered and rejected: counting lifetime sessions (A), and counting only the current season's sessions (B, which kept
every board closed until the 4th session of the season).

`fetchEligiblePlayerIds` takes an `asOf` date and checks:

- sessions attended in the **12 months up to `asOf`** ≥ the board's floor
- registered for one of the last `RECENT_SESSIONS_WINDOW` completed sessions up to `asOf` — unchanged
- not a guest

For the current season, `asOf` is now. For a past season it is the season's end, so a past season never rewrites
itself: a regular who stopped coming keeps their 2026 places and awards.

**The floors belong to the season** and live with it in `lib/season.ts`, so changing a floor for a new season cannot
reshuffle a past one. For 2027 the owner lowered Individual and Cheers back from 4 to 3 (2026-11-19); 2026 keeps the 4
its final standings were shown with.

| Board or award | 2026 floor | 2027 floor (sessions in the past 12 months) |
|---|---|---|
| Individual (`MIN_SESSIONS_INDIVIDUAL`) | 4 | **3** |
| Cheers (`MIN_SESSIONS_CHEERS`) | 4 | **3** |
| Partners | 3 each, plus 3 games together | 3 each, plus 3 games together *in the season* |
| 📅 Joined, 🔥 Streak, ⚡ Wins, 🎲 Odds | 3 | 3 |
| 🐦 Early Bird (`EARLY_BIRD_MIN_SESSIONS`) | 8 | 8 |

For 2026 the floors count lifetime sessions, as the boards did when they were live. Since all data falls within 12
months of Nov 15, that is the same count either way.

**What this means in practice:**

- **Until March 2027 the 12-month window covers every session the app holds** (the first was 2026-03-22). So for the
  first months of the 2027 season, every regular qualifies from the first night, ranked on that night's games alone,
  and early boards are tie-heavy.
- From late March 2027 the window starts dropping old sessions. A player whose last 4 sessions are more than a year old
  no longer qualifies until they play again.
- The window is rolling, measured in days back from `asOf`, and is independent of season boundaries.
- Partners' "3 games together" stays within the season. It is part of the ranked pairing, not a measure of a player's
  attendance. *(my call)*

**One input stays lifetime** *(my call)*: 🎲 Against the Odds judges an upset by each player's win rate *going in*,
from their earlier games. That rate measures how strong a player is; it is not a floor on who may appear. Resetting it
each season would make the first month's upsets unjudgeable. It uses all games before the one being judged, across
seasons. Only the upsets *counted* are the season's.

Within a season, the ranked numbers are the season's: games, wins and win rate; cheer shares; Win Streak runs (cut at
the season boundary, so 2026 games never extend a 2027 streak); Attendance Streak (the longest run within the season);
sessions joined; early-registration points.

Sessions attended within a window cannot come from the undated counter, so eligibility is computed from registrations
in completed sessions, from raw rows.

### Players not yet on a board

- Below a board, a footer line counts who has played this season but hasn't met the floor: "1 more player appears
  once they reach 3 sessions."
- If the viewer is one of them, the same line says so: "You: 2 of 3 sessions in the past 12 months." *(my call: a new
  player otherwise has no way to know why they're missing)*
- A board can still be empty with the season under way, for example Early Bird early on. It then shows the "nobody has
  reached the minimum yet" card with the viewer's progress and a link to last season's final standings. It is never a
  blank board.

### Between seasons

From the boundary until the first session of the new season completes (Nov 16–22 this year), the current-season view
shows a card in place of every board: **"The 2027 season starts Sunday — boards fill in after the Nov 22 session"**,
with the same link to the 2026 standings. My Profile shows the season's zeros under "Your 2027 season starts with the
Nov 22 session."

### Season switcher

- On the leaderboard header: **"2027 season | 2026"**, one option per season, current season first and selected by
  default. It applies to all four tabs.
- A past season shows its **final** boards, captioned "2026 season · final · Mar 22 – Nov 15".
- Past seasons are frozen *(my call)*. They keep everyone who played in them, **including players since marked
  inactive**; today's `is_active = true` filter applies to the current season only. Guests stay excluded everywhere.
  Otherwise deactivating a 2026 top player would move everyone below them up a place.
- The season is reflected in the URL alongside `?tab=`, so a link to a 2026 board opens on 2026. *(my call)*

### Award badges

- A badge follows the current season's Awards board, as today.
- **No award badge is shown until the current season has 4 completed sessions** (owner's answer). With the 12-month
  minimum the Awards boards are populated from the first night, and after it everyone who came is tied for 📅 Most
  Sessions Joined, so about 14 players would otherwise share the badge. The Awards tab itself still shows every board
  from night one.
- A past season's badges are final and appear on that season's year page.

### Celebrations

The podium celebration remembers per player, per board, in `localStorage` (`celebrationStorage.ts`): the last
standings shown and the best rank ever held. A season rollover must:

- **stay silent**: nobody is told they "dropped" from a board just because a new season started
- **still celebrate a first 2027 podium**, even for a player whose remembered best is already a 2026 #1
- never celebrate anything seen through the season switcher; only the current season celebrates

The mechanism is the builder's: a season in the board key, or resetting the stored snapshot when the season changes.

### My Profile and the year page

- **My Profile shows the current season only** (owner's choice): Sessions Attended, Games Played, W–L and win rate,
  Best Partners, Toughest Opponents, Cheered for, and award badges. Each section header carries a **"2027 season"**
  label.
- **A "Your 2026 season" card** sits on My Profile above the Awards section, one per past season the player played in,
  so only 2026 for now. It shows a one-line summary ("21 sessions · 88 games · 4th on Wins") and opens the year page.
- **The year page is the same sections with that season's window**, plus one box at the top, **"Where you
  finished"**: the player's final place on Individual, their best Partners place and partner, and their best Cheers
  category place. *(added in the POC; the owner did not object)* A board on which the player did not place is left
  out of the box.
- One set of components, two windows: My Profile passes the current season, the year page passes 2026. There is no
  second layout to keep in sync.
- **Both are the signed-in player's own.** No player id in the route, and no one else's page can be opened. *(my call:
  best partners and toughest opponents are only ever shown to the player themselves today)*

## Changes during build (2026-11-23)

Owner rulings made after this design was written:

- **A completed session with no game results is ignored everywhere** (the Nov 22 Xmas Party was deliberately
  game-less): not attendance, floors, the recent-5 window, streaks, Early Bird, the badge hold, or "the season has
  started". "Played session" = status `complete` and at least one `match_results` row.
- **The between-seasons card is keyed on played sessions**, not completed ones. It shows while the current season has
  0 played sessions (true on prod now): "The 2027 season starts with the {date} session" plus a link to the 2026
  final standings.
- **The parity check (task 12) was skipped.** Evidence is unit tests plus a live check on Neon dev. The counter faults
  listed under "Verified evidence" (8 players at one win off, March cheers 6,249 vs 6,243) were not re-measured by the
  new code.

Difference from the POC: the "Your 2026 season" card on My Profile shows "N sessions · M games" with no board place,
so opening a profile does not load the 2026 boards. The year page `/profile/season/:seasonId` still has "Where you
finished".

## Verification the builder must run

1. **Parity:** with an unbounded season window, the 2026 floors and `asOf` = now, every new fetcher reproduces
   today's live boards and profile numbers: Individual, Partners, Cheers, all Awards, profile Stats, Cheered for and
   badges. The 12-month window covers all data today, so it counts the same sessions as the current lifetime counters. The only allowed differences are the known counter faults: the 8 players' ±1 wins and the
   15 players' March cheers. List both in the test as expected; any other difference is a bug.
2. **Cheers counts on Neon against a prod copy.** The `rehearsal` branch is a prod copy on Neon until 2026-11-30.
   Neon dev has no cheers, so it cannot prove this.
3. **Season boundary:** the 2026 and 2027 windows together cover every completed session exactly once; Nov 15 lands in
   2026 and Nov 22 in 2027.
4. **The 12-month window:** with fixture sessions, a player with 3 sessions inside the window qualifies for a 2027
   board; the same player whose 3rd-most-recent session is 366 days before `asOf` does not. Season boundaries play no
   part in this.
5. **Floors per season:** the 2026 final Individual and Cheers boards still apply 4 and match today's live boards; the
   2027 boards apply 3.
6. **A past season is frozen:** deactivating a player, or a player who stops attending, leaves the 2026 boards and
   year page unchanged.
7. **Rollover:** between seasons every board shows the "starts" card; the rollover fires no celebration and no
   "dropped" message; a first 2027 podium celebrates; nothing celebrates on a past-season view.
8. **Badge hold:** no award badge on any profile until the current season has 4 completed sessions.

## Left to the builder

Route name for the year page, module boundaries, how Individual and Partners share their fetch, the celebration
rollover mechanism, and test layout.
