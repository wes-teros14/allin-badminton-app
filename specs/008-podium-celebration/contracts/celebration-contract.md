# Phase 1: Contracts — Leaderboard Celebrations

This feature exposes no network API. Its contracts are the boundaries between its own modules, and
the boundary it must not break in `LeaderboardView`. They are written as behaviour, not signatures, so
the tests can be derived from them directly.

---

## C1 — `lib/podiumCelebration` — the rule

Pure. No React, no Supabase, no storage. This is the module that can be tested exhaustively, and
everything subtle about the feature lives here.

**Given** a previous `RankSnapshot` (or the fact that there is none) and current standings,
**it returns** the achievements that are new, ordered best first.

| Input condition | Must return |
|---|---|
| No previous snapshot at all | Nothing. The first evaluation is always silent |
| Board absent from the previous snapshot | Nothing for that board |
| Previous `null`, now placed in top 3 | A `podium` achievement |
| Previous `null`, now placed outside top 3, first ever | A `first-appearance` achievement |
| Previous 5, now 3 | A `podium` achievement |
| Previous 3, now 1 | A `podium` achievement — improving inside the podium is news |
| Previous 2, now 2 | Nothing |
| Previous 1, now 3 | Nothing. The feature never reports bad news |
| Previous 2, now `null` | Nothing |
| Now better than `bestEver`, outside top 3 | A `personal-best` achievement |
| Improved by 3+, no personal best, outside top 3 | A `climb` achievement |
| Improved by 2, nothing else | Nothing. The threshold is 3 |
| Several at once | All of them, ordered by precedence |

**Precedence**: `podium` > `first-appearance` > `personal-best` > `climb`; better rank first within a
kind; Individual and Partners ahead of cheer categories to break a remaining tie.

**Invariant**: the function is total and side-effect free. The same inputs always give the same
output, which is what makes the three silences testable without a database.

---

## C2 — `lib/celebrationStorage` — per-player memory

**Reads and writes** one player's `PlayerCelebrationState`, keyed by player id.

| Guarantee | Why |
|---|---|
| State for player A is never returned for player B | Two accounts share a device here — the dev login panel switches test players in one browser (FR-010) |
| Absent state is distinguishable from empty state | Absent means "never evaluated" and triggers the silent first run; empty would celebrate everything |
| A read never throws | Private browsing, blocked storage and cleared data must degrade to "no state", not crash the app on launch |
| A write failure never breaks the celebration | Worst case the player sees the same celebration again next launch; that is better than an error |
| The shape carries a version | A later move to server-side storage, or adding the streak's rank history, migrates rather than resets |

**Explicitly narrow on purpose**: the whole module is a candidate for replacement by a Supabase table
if players start using several devices (research.md R3). Nothing outside it may know that
`localStorage` is involved.

---

## C3 — `lib/leaderboardData` — the shared rank definition

**Extracted, not written.** The board queries and ranking move out of `LeaderboardView.tsx`
unchanged.

| Guarantee | Why |
|---|---|
| `LeaderboardView` and the celebration hook import the same functions | Constitution III. A celebration for a place the leaderboard does not show is the bug this prevents |
| The move changes no behaviour | It is a refactor. The leaderboard must render identically before and after |
| No React imported | It is a data module; the hook and the view both consume it |

**Acceptance for the extraction itself**: the existing leaderboard renders identically, `npm run
lint` passes, `npm run test:unit` passes, and `tests/pair-leaderboard.spec.ts` still passes. *This is
currently unverified work-in-progress — it typechecks, but its lint and full test run were interrupted
and must be completed before it is trusted.*

---

## C4 — `hooks/useLeaderboardCelebration` — orchestration

**Runs** on app start and when the app returns to the foreground.

| Step | Guarantee |
|---|---|
| 1. Sentinel check | One small query. If unchanged since last evaluation, stop here — **no board computation** (FR-026, SC-007) |
| 2. Compute standings | Only when the sentinel moved. Via `leaderboardData` |
| 3. Evaluate | Via `podiumCelebration`, against stored state |
| 4. Persist | Snapshot, best-ever and sentinel update **whether or not anything is celebrated** |
| 5. Announce | At most one celebration, however many achievements (FR-016, SC-003) |
| 6. Arm the sweep | When the celebration is *shown* — not when the offer is accepted (research.md R10) |

**Must never**: initiate navigation (FR-012); block or delay the screen underneath; run while signed
out; throw into the app's render path if a query fails — a failed evaluation is a silent no-op, since
a missed celebration is not worth a broken launch.

---

## C5 — `CelebrationCard` — presentation

| Guarantee | Requirement |
|---|---|
| Appears over the current screen without navigating | FR-011 |
| Dismisses itself, no interaction required | FR-014 |
| On screen long enough to read, scaling with content | FR-015 |
| Podium: 3px border in the medal colour of the place; otherwise the ordinary 1px border | FR-017 |
| Non-podium: identical size, animation, confetti and dwell; only icon and border differ | FR-018 |
| Reduced motion: same content, no spring, no particles | FR-025 |
| Several achievements: one card listing each | FR-016 |

**Medal colours** come from the leaderboard's existing podium values, not a second palette. Bronze
stays a brown rather than an orange — the existing code records that an orange edge on a dark card
reads as the destructive red.

---

## C6 — `LeaderboardView` — the row sweep

| Guarantee | Requirement |
|---|---|
| On mount, if a sweep is owed for the board being shown, the player's own row is marked | FR-023 |
| Happens whether they accepted the offer or arrived unprompted | FR-024 |
| The debt is cleared once played, so it does not repeat | — |
| A lapsed debt plays nothing | research.md R9 |
| Reduced motion: no sweep | FR-025 |

**The two-route requirement is the one to test explicitly.** A prototype passed visual inspection
while the accept-the-offer route silently never swept, because only the other route armed the debt.

---

## Test mapping

| Contract | Level | Location |
|---|---|---|
| C1 rule table | Unit | `src/__tests__/podiumCelebration.test.ts` |
| C2 isolation, absent-vs-empty, throw safety | Unit | `src/__tests__/celebrationStorage.test.ts` |
| C3 no behaviour change | Existing suites | `npm run test:unit`, `tests/pair-leaderboard.spec.ts` |
| C4 sentinel skips computation | Unit | sentinel logic extracted pure enough to assert on |
| C5 + C6 end to end, **both arrival routes** | Playwright | `tests/leaderboard-celebration.spec.ts` |

Per the constitution's testing rules the Playwright spec is seed-backed and isolated, following
`tests/pair-leaderboard.spec.ts`. A browser-level assertion is required here because the flow spans
navigation and auth state.
