# Match Generation Engine v3 — Clean Redesign

> **Date**: 2026-04-05
> **Status**: Proposal (not implemented)

## Problem Statement

The current engine (v2) evolved incrementally: greedy builder → balance pass → relaxation retry → SA optimizer → 4 mutation types. Each layer compensates for the previous layer's blind spots. The root cause: **coupling assignment with team formation** in a single greedy loop.

---

## Architecture: Three Decoupled Phases

```
Phase 1: ASSIGNMENT     "Who plays in which match?"     → n×m matrix
Phase 2: TEAM FORMATION "Given 4 players, which 2v2?"   → 3 splits, pick best
Phase 3: OPTIMIZATION   "Reorder/reassign for quality"  → SA on the matrix
```

### Why This Order Matters

- **Fairness is guaranteed by construction** (Phase 1) — no balance pass needed
- **Team balance is locally optimal** (Phase 2) — trivial, only 3 options per match
- **Global quality** (streaks, partners, diversity) is optimized globally (Phase 3)

---

## Phase 1: Assignment Matrix

Participation fairness is a **math problem, not a search problem**.

### Even Division (e.g., 20 games, 16 players)

```
Total slots = 20 × 4 = 80
Games per player = 80 / 16 = 5 (exact)
```

Every player plays exactly 5 games. `adjustNumMatches` ensures this.

### Uneven Division (e.g., 20 games, 15 players)

```
Total slots = 20 × 4 = 80
Base games = floor(80 / 15) = 5
Remainder = 80 % 15 = 5
→ 5 players get 6 games, 10 players get 5 games
→ Max participation gap = 1 (imperceptible)
```

This makes `adjustNumMatches` **optional** — the admin picks any number and nobody
gets shorted by more than 1 game.

### Algorithm

```typescript
type Schedule = string[][]  // schedule[matchIndex] = [p1, p2, p3, p4]

function buildAssignmentMatrix(
  playerIds: string[],
  numMatches: number,
  levelMap: Map<string, number>,
  genderMap: Map<string, string>,
  config: { maxSpread: number; disableGenderRules: boolean },
): Schedule {
  const n = playerIds.length
  const totalSlots = numMatches * 4
  const base = Math.floor(totalSlots / n)
  const remainder = totalSlots % n

  // Assign target games: some players get base+1, rest get base
  const shuffled = [...playerIds].sort(() => Math.random() - 0.5)
  const remaining = new Map<string, number>()
  shuffled.forEach((id, i) => {
    remaining.set(id, i < remainder ? base + 1 : base)
  })

  const schedule: Schedule = []

  for (let m = 0; m < numMatches; m++) {
    // Sort candidates: most remaining games first, random tiebreak
    const candidates = [...remaining.entries()]
      .filter(([_, r]) => r > 0)
      .sort((a, b) => b[1] - a[1] || Math.random() - 0.5)

    // Find first valid group of 4 (respecting spread + gender)
    let assigned = false
    for (let skip = 0; skip <= candidates.length - 4; skip++) {
      const group = candidates.slice(skip, skip + 4).map(([id]) => id)

      // Hard filter: spread
      const levels = group.map(id => levelMap.get(id) ?? 5)
      const spread = Math.max(...levels) - Math.min(...levels)
      if (spread > config.maxSpread) continue

      // Hard filter: gender composition (4M, 4F, or 2M+2F)
      if (!config.disableGenderRules) {
        const mCount = group.filter(id => genderMap.get(id) === 'M').length
        const fCount = group.filter(id => genderMap.get(id) === 'F').length
        if (!(mCount === 4 || fCount === 4 || (mCount === 2 && fCount === 2))) continue
      }

      schedule.push(group)
      for (const id of group) remaining.set(id, remaining.get(id)! - 1)
      assigned = true
      break
    }

    // Relaxation fallback: if no valid group, relax constraints
    if (!assigned) {
      const group = candidates.slice(0, 4).map(([id]) => id)
      schedule.push(group)
      for (const id of group) remaining.set(id, remaining.get(id)! - 1)
    }
  }

  return schedule
}
```

**Complexity**: O(m × n log n) — one sort per match, no combinatorial search.

**Key property**: No SEARCH_LIMIT window. All players are visible. Relaxation is 3 lines,
not 70.

---

## Phase 2: Team Formation

Given 4 players, find the best 2v2 split. Only 3 options exist — evaluate all three.

```typescript
interface FormedMatch {
  team1: [string, string]
  team2: [string, string]
  type: string           // "Men's Doubles" | "Women's Doubles" | "Mixed Doubles" | "Doubles"
  team1Level: number
  team2Level: number
  imbalance: number
}

function formTeams(
  group: string[],
  levelMap: Map<string, number>,
  genderMap: Map<string, string>,
  disableGenderRules: boolean,
): FormedMatch {
  const [a, b, c, d] = group
  const splits: [[string, string], [string, string]][] = [
    [[a, b], [c, d]],
    [[a, c], [b, d]],
    [[a, d], [b, c]],
  ]

  let best: FormedMatch | null = null

  for (const [t1, t2] of splits) {
    const t1Sum = (levelMap.get(t1[0]) ?? 5) + (levelMap.get(t1[1]) ?? 5)
    const t2Sum = (levelMap.get(t2[0]) ?? 5) + (levelMap.get(t2[1]) ?? 5)
    const imbalance = Math.abs(t1Sum - t2Sum)
    const type = computeMatchType(t1[0], t1[1], t2[0], t2[1], genderMap)

    // Prefer Men's/Women's Doubles over Mixed/generic when levels are equal
    const typeBonus = (!disableGenderRules &&
      (type === "Men's Doubles" || type === "Women's Doubles")) ? 0.1 : 0

    if (!best || (imbalance - typeBonus) < (best.imbalance)) {
      best = { team1: t1, team2: t2, type, team1Level: t1Sum, team2Level: t2Sum, imbalance }
    }
  }

  return best!
}
```

**Complexity**: O(1) per match. Trivially optimal.

---

## Phase 3: Simulated Annealing on the Assignment Matrix

SA operates on the **assignment matrix**, not on formed matches. Mutations are
structurally meaningful — one type covers all quality dimensions.

### The Only Mutation You Need

```typescript
function mutateSwap(
  schedule: Schedule,
  playerIds: string[],
  genderMap: Map<string, string>,
  levelMap: Map<string, number>,
  config: { maxSpread: number; disableGenderRules: boolean },
): boolean {
  // Pick two different matches
  const i = randInt(schedule.length)
  let j = randInt(schedule.length)
  while (j === i) j = randInt(schedule.length)

  // Pick one player from each
  const si = randInt(4), sj = randInt(4)
  const pI = schedule[i][si], pJ = schedule[j][sj]

  // Can't swap if player already in the other match
  if (schedule[j].includes(pI) || schedule[i].includes(pJ)) return false

  // Gender guard (same gender swap preserves valid compositions)
  if (!config.disableGenderRules && genderMap.get(pI) !== genderMap.get(pJ)) return false

  // Spread check on both resulting groups
  const checkSpread = (group: string[], idx: number, newPlayer: string) => {
    const levels = group.map((id, k) => levelMap.get(k === idx ? newPlayer : id) ?? 5)
    return Math.max(...levels) - Math.min(...levels) <= config.maxSpread
  }
  if (!checkSpread(schedule[i], si, pJ)) return false
  if (!checkSpread(schedule[j], sj, pI)) return false

  // Apply
  schedule[i][si] = pJ
  schedule[j][sj] = pI
  return true
}
```

### Why One Mutation Is Enough

| Current v2 Mutation | Why Not Needed in v3 |
|---|---|
| Single player swap (50%) | **This IS the mutation** — cross-match swap |
| Match order swap (20%) | Swapping two rows in the matrix = same thing. Just swap `schedule[i]` and `schedule[j]` as a variant |
| Cross-match player swap (15%) | Same as the primary mutation |
| Intra-match team reshuffle (15%) | Phase 2 runs fresh after SA — always picks optimal split |

To add match-order swaps as a variant (for streak optimization):

```typescript
const r = Math.random()
if (r < 0.80) {
  // Cross-match player swap (handles partners, diversity, fairness)
  return mutateSwap(schedule, ...)
} else {
  // Row swap (handles streak/rest patterns)
  const i = randInt(schedule.length)
  let j = randInt(schedule.length)
  while (j === i) j = randInt(schedule.length)
  ;[schedule[i], schedule[j]] = [schedule[j], schedule[i]]
  return true
}
```

### SA Loop

```typescript
function optimize(
  schedule: Schedule,
  playerIds: string[],
  levelMap: Map<string, number>,
  genderMap: Map<string, string>,
  config: OptConfig,
): Schedule {
  const scoreSchedule = (s: Schedule) => {
    const matches = s.map((group, i) => {
      const formed = formTeams(group, levelMap, genderMap, config.disableGenderRules)
      return {
        gameNumber: i + 1,
        team1Player1: formed.team1[0], team1Player2: formed.team1[1],
        team2Player1: formed.team2[0], team2Player2: formed.team2[1],
        type: formed.type,
        team1Level: formed.team1Level, team2Level: formed.team2Level,
      } as GeneratedMatch
    })
    return evaluateSessionScore(matches, levelMap, config.wishlistPairs,
      config.maxConsecutiveGames, config.weights, config.maxSpread,
      playerIds, config.disableGenderRules)
  }

  let current = schedule.map(g => [...g])
  let currentScore = scoreSchedule(current).score

  const T0 = 500, Tf = 1
  const cooling = Math.pow(Tf / T0, 1 / config.numTrials)
  let T = T0

  let bestEver = current.map(g => [...g])
  let bestEverScore = currentScore

  for (let i = 0; i < config.numTrials; i++) {
    const candidate = current.map(g => [...g])

    const applied = Math.random() < 0.80
      ? mutateSwap(candidate, playerIds, genderMap, levelMap, config)
      : mutateRowSwap(candidate)

    if (!applied) { T *= cooling; continue }

    const candidateScore = scoreSchedule(candidate).score
    const delta = candidateScore - currentScore

    if (delta > 0 || Math.random() < Math.exp(delta / T)) {
      current = candidate
      currentScore = candidateScore
    }

    if (currentScore > bestEverScore) {
      bestEver = current.map(g => [...g])
      bestEverScore = currentScore
    }

    T *= cooling
  }

  return bestEver
}
```

### Multi-Start

Same as current v2: run SA N times from different random starting assignments, keep the best.

---

## Scoring Function

**Keep `evaluateSessionScore` unchanged.** It's well-designed. The weights are tuned.
Phase 3 calls it after converting the matrix → formed matches.

---

## Handling Non-Divisible Game Counts

### Current v2 Behavior

`adjustNumMatches(20, 15)` snaps to nearest clean number:
- gcd(15, 4) = 1 → step = 15
- round(20/15) × 15 = 15 matches → 4 games each
- **5 matches silently removed**

### v3 Behavior: Allow Any Number

```
20 matches × 4 slots = 80 slots
80 / 15 = 5 remainder 5
→ 5 players get 6 games, 10 players get 5 games
→ Max gap = 1
```

The admin's intent is preserved. Nobody notices a 1-game difference.

`adjustNumMatches` becomes a **suggestion** (shown in UI as "nearest perfect: 15")
rather than a **requirement**.

### Implementation

```typescript
function computeTargets(numMatches: number, n: number): Map<string, number> {
  const totalSlots = numMatches * 4
  const base = Math.floor(totalSlots / n)
  const remainder = totalSlots % n

  // Randomly select which players get the extra game
  const shuffled = [...playerIds].sort(() => Math.random() - 0.5)
  const targets = new Map<string, number>()
  shuffled.forEach((id, i) => {
    targets.set(id, i < remainder ? base + 1 : base)
  })
  return targets
}
```

---

## What This Eliminates

| Current v2 Component | Lines | v3 Status |
|---|---|---|
| SEARCH_LIMIT = 12 window | ~10 | **Gone** — assignment sees all players |
| Balance pass | ~50 | **Gone** — fairness by construction |
| Relaxation retry (3-tier) | ~70 | **Gone** — 3-line fallback in assignment |
| 4 SA mutation types | ~100 | **1 type** — cross-match swap |
| `scorePartial()` in greedy loop | ~20 | **Gone** — no greedy loop |
| `_skipBalance` flag | ~5 | **Gone** — no balance pass |
| `eligiblePlayers` filter + hard cap | ~15 | **Gone** — matrix handles this |
| `gamesPlayedCount` tracking | ~10 | **Gone** — matrix row counts = game counts |
| **Total removed** | **~280** | |

**Estimated final size: ~300 lines** (down from ~650).

---

## Complexity Comparison

| | Current v2 | v3 Rebuild |
|---|---|---|
| **Assignment** | O(m × C(12,4)) = O(495m), scoring partial schedule each time | O(m × n log n) — one sort per match |
| **SA trial** | Score full schedule + apply mutation + re-score | Same cost, but simpler mutation |
| **Balance pass** | O(m² × n³) worst case | None |
| **Total** | O(starts × trials × m × n) + balance | O(starts × trials × m × n) |

v3 is **faster per trial** (no partial-schedule scoring during construction) and
**better quality per trial** (starting point is already participation-optimal).

---

## Edge Cases

### Spread = 1, levels 1-5

With spread=1, valid groups must be same-level or adjacent-level. The assignment
phase picks 4 players with most remaining games, checks spread. If the top 4 fail,
it tries the next candidate (5th, 6th, etc.). Since it sees ALL players (no
SEARCH_LIMIT), it finds valid groups much more reliably than v2.

### Gender imbalance (e.g., 10M + 2F)

The 2F players will appear in the candidate list proportionally. The assignment
phase picks them when they have the most remaining games. Gender composition
(2M+2F) is checked — if it fails, the next group is tried. Worst case: some
matches are all-male, but both females still get their target games.

### Truly impossible constraints

When no valid group exists (e.g., 3M + 1F, spread=1, levels 1 and 5), the
assignment fallback fires: take the top 4 by remaining games regardless of
constraints. This is the same behavior as v2's relaxation, but automatic.

### Wishlists

Wishlist pairs are scored by `evaluateSessionScore`. SA naturally moves wishlist
partners into the same matches because the reward improves the score.

---

## File Structure

```
src/lib/matchGenerator/
  types.ts        — PlayerInput, GeneratedMatch, ScoreWeights, AuditData, etc.
  assign.ts       — buildAssignmentMatrix, computeTargets, adjustNumMatches
  teams.ts        — formTeams, computeMatchType
  score.ts        — evaluateSessionScore (unchanged from v2)
  optimize.ts     — SA loop, mutateSwap, mutateRowSwap
  index.ts        — generateSchedule (single-pass), generateScheduleOptimized (SA)
```

---

## Migration Path

1. Build v3 in `src/lib/matchGeneratorV3/` alongside v2
2. Add a toggle in MatchGeneratorPanel: "Engine: v2 / v3"
3. Run both on same inputs, compare scores in decision log
4. When v3 consistently wins, remove v2

---

## Summary

The current engine is a **good v2** — it works, it's tested, it's tuned. But it
carries the weight of incremental fixes (balance pass, relaxation, 4 mutations).
v3 eliminates the root cause by separating **who plays** from **who teams with whom**
from **quality optimization**. The result is half the code, better starting quality,
and the same SA optimization on top.
