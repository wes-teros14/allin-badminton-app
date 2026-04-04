/**
 * Match Generation Engine — TypeScript port of old_badminton_web_app.py (Sections 3 + scoring)
 *
 * Two modes:
 *   generateSchedule()         — single pass, fast
 *   generateScheduleOptimized() — iterative optimizer: runs N trials, scores each, returns best
 *
 * Algorithm (single pass):
 *   A. SORT      — Eligible players only (under target games cap); fewest games first.
 *   B. SELECTION — Combinatorial search over top-12 eligible players (all C(n,4) groups).
 *   C. FILTER    — Hard skill-gap filter, gender composition rules.
 *   D. OPTIMISE  — Evaluate all 3 team splits per group; score partial schedule with evaluateSessionScore.
 *   E. COMMIT    — Pick best-scoring candidate, append to schedule.
 *   F. BALANCE   — Post-process swap pass (no-op when cap produces exact distribution).
 */

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface PlayerInput {
  id: string
  nameSlug: string
  nickname: string | null
  gender: 'M' | 'F' | null
  level: number | null  // integer 1–10; null treated as 5
}

export interface GeneratedMatch {
  gameNumber: number
  team1Player1: string
  team1Player2: string
  team2Player1: string
  team2Player2: string
  type: string        // 'Mixed Doubles' | "Men's Doubles" | "Women's Doubles" | 'Doubles'
  team1Level: number  // sum of team 1 levels
  team2Level: number  // sum of team 2 levels
}

export interface GenerateOptions {
  numMatches?: number           // default: ceil(n*8/4)
  maxConsecutiveGames?: number          // default: 1 (no consecutive games)
  disableGenderRules?: boolean  // default: false (auto-true if any player has null gender)
  maxSpreadLimit?: number       // default: 3 (max integer level diff in one match)
  wishlistPairs?: [string, string][]    // pairs of player IDs to reward being teamed
  weights?: ScoreWeights                // scoring weights (shared with SA optimizer)
}

export interface ScoreWeights {
  streakWeight: number          // default: 1000 — fatigue penalty per game over streak limit
  imbalancePenalty: number      // default: 100  — per 1-point level diff between teams
  wishlistReward: number        // default: 500  — reward per wishlist pair granted
  repeatPartnerPenalty: number  // default: 200  — per repeat partnership
  fairnessWeight: number        // default: 5000 — per game-count gap between players
  spreadPenalty: number         // default: 2000 — per match exceeding maxSpreadLimit
  mixedDoublesPenalty: number   // default: 300  — per Mixed Doubles match (prefer MD/WD)
}

export interface AuditData {
  score: number
  streakViolations: number
  repeatPartners: number
  wishesGranted: number
  levelGaps: number
  participationGap: number
  wideGaps: number
  mixedDoubles: number
}

export interface MatchDecision {
  gameIndex: number
  candidatesEvaluated: number
  bestScore: number
  selectedGroup: string[]
}

export interface OptimizeOptions extends GenerateOptions {
  numTrials?: number                    // default: 50, range 10–500
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export const DEFAULT_WEIGHTS: ScoreWeights = {
  streakWeight: 1000,
  imbalancePenalty: 100,
  wishlistReward: 500,
  repeatPartnerPenalty: 200,
  fairnessWeight: 5000,
  spreadPenalty: 2000,
  mixedDoublesPenalty: 300,
}

// ---------------------------------------------------------------------------
// Utility: compute match type from 4 player IDs
// ---------------------------------------------------------------------------
function computeMatchType(
  t1p1: string, t1p2: string, t2p1: string, t2p2: string,
  genderMap: Map<string, string>,
): string {
  const teamCat = (p1: string, p2: string) => {
    const g1 = genderMap.get(p1), g2 = genderMap.get(p2)
    if ((g1 === 'M' && g2 === 'F') || (g1 === 'F' && g2 === 'M')) return 'Mixed'
    return g1 === 'M' ? "Men's" : "Women's"
  }
  const c1 = teamCat(t1p1, t1p2)
  const c2 = teamCat(t2p1, t2p2)
  if (c1 === 'Mixed' && c2 === 'Mixed') return 'Mixed Doubles'
  if (c1 === c2) return `${c1} Doubles`
  return 'Doubles'
}

// ---------------------------------------------------------------------------
// Utility: itertools.combinations equivalent
// ---------------------------------------------------------------------------
function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]]
  if (arr.length < k) return []
  const [first, ...rest] = arr
  const withFirst = combinations(rest, k - 1).map((c) => [first, ...c])
  const withoutFirst = combinations(rest, k)
  return [...withFirst, ...withoutFirst]
}

// ---------------------------------------------------------------------------
// Helpers: target games per player
// ---------------------------------------------------------------------------
function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}

/** Returns the nearest numMatches where (numMatches × 4) divides evenly by n players. */
export function adjustNumMatches(numMatches: number, n: number): number {
  if (n < 4) return numMatches
  const step = n / gcd(n, 4)  // smallest increment = 1 whole game per player
  return Math.max(step, Math.round(numMatches / step) * step)
}

// ---------------------------------------------------------------------------
// Single-pass schedule generation
// ---------------------------------------------------------------------------
export function generateSchedule(
  players: PlayerInput[],
  options: GenerateOptions = {},
  _decisionLog?: MatchDecision[],
  _skipBalance = false,
): GeneratedMatch[] {
  const n = players.length
  if (n < 4) return []

  const {
    numMatches = Math.ceil((n * 8) / 4),
    maxConsecutiveGames = 1,
    maxSpreadLimit = 3,
    wishlistPairs = [],
    weights = DEFAULT_WEIGHTS,
  } = options

  // Auto-disable gender rules when any player is missing gender data
  const disableGenderRules =
    options.disableGenderRules ?? players.some((p) => p.gender == null)

  const playerIds = players.map((p) => p.id)
  const genderMap = new Map(players.map((p) => [p.id, p.gender ?? 'M']))
  const levelMap  = new Map(players.map((p) => [p.id, p.level  ?? 5]))

  const gamesPlayedCount   = new Map(playerIds.map((id) => [id, 0]))

  const finalSchedule: GeneratedMatch[] = []
  const SEARCH_LIMIT = 12

  // Hard cap: auto-adjust numMatches so slots divide evenly → exact target per player
  const adjustedNumMatches = adjustNumMatches(numMatches, n)
  const targetGamesPerPlayer = (adjustedNumMatches * 4) / n  // always an integer

  const getMatchType = (t1: [string, string], t2: [string, string]) =>
    computeMatchType(t1[0], t1[1], t2[0], t2[1], genderMap)

  // Unified scorer — evaluates partial schedule during generation
  // Pass playerIds so unplayed players count as 0 games in fairness calculation
  const scorePartial = (schedule: GeneratedMatch[]) =>
    evaluateSessionScore(schedule, levelMap, wishlistPairs, maxConsecutiveGames, weights, maxSpreadLimit, playerIds, disableGenderRules)

  for (let gameIndex = 1; gameIndex <= adjustedNumMatches; gameIndex++) {
    // A. ELIGIBILITY + FAIRNESS SORT — capped players excluded, fewest games first
    const eligiblePlayers = playerIds.filter(
      (id) => (gamesPlayedCount.get(id) ?? 0) < targetGamesPerPlayer
    )
    // Fallback: if fewer than 4 eligible, allow any player (over-cap as last resort)
    const pool = eligiblePlayers.length >= 4 ? eligiblePlayers : playerIds

    const sortedPlayers = [...pool].sort((a, b) => {
      const diff = (gamesPlayedCount.get(a) ?? 0) - (gamesPlayedCount.get(b) ?? 0)
      return diff !== 0 ? diff : Math.random() - 0.5
    })

    const searchPool = sortedPlayers.slice(0, SEARCH_LIMIT)

    // B. SCORED SELECTION — evaluate all valid groups using unified scorer
    type SplitOption = {
      t1: [string, string]; t2: [string, string]
      diff: number; type: string; t1Sum: number; t2Sum: number
    }
    let bestCandidate: { group: string[]; split: SplitOption } | null = null
    let bestScore = -Infinity
    let candidatesEvaluated = 0

    for (const group of combinations(searchPool, 4)) {
      const [a, b, c, d] = group as [string, string, string, string]

      // HARD FILTER: skill spread (unplayable if exceeded)
      const levels = group.map((id) => levelMap.get(id) ?? 5)
      const spread =
        Math.round(Math.max(...levels)) - Math.round(Math.min(...levels))
      if (spread > maxSpreadLimit) continue

      // HARD FILTER: gender composition (4M, 4F, or 2M+2F only)
      if (!disableGenderRules) {
        const genders = group.map((id) => genderMap.get(id))
        const mCount = genders.filter((g) => g === 'M').length
        const fCount = genders.filter((g) => g === 'F').length
        if (!(mCount === 4 || fCount === 4 || (mCount === 2 && fCount === 2))) continue
      }

      candidatesEvaluated++

      // C. ALL 3 TEAM SPLITS — evaluate all, find the best by level-sum diff
      const splits: [[string, string], [string, string]][] = [
        [[a, b], [c, d]],
        [[a, c], [b, d]],
        [[a, d], [b, c]],
      ]

      const validOptions: SplitOption[] = []

      for (const [t1, t2] of splits) {
        const matchType = getMatchType(t1, t2)
        const t1Sum = (levelMap.get(t1[0]) ?? 5) + (levelMap.get(t1[1]) ?? 5)
        const t2Sum = (levelMap.get(t2[0]) ?? 5) + (levelMap.get(t2[1]) ?? 5)
        validOptions.push({ t1, t2, diff: Math.abs(t1Sum - t2Sum), type: matchType, t1Sum, t2Sum })
      }

      const bestSplit = validOptions.reduce((a, b) => (a.diff <= b.diff ? a : b))

      // D. SCORE using unified evaluateSessionScore on partial schedule
      const tentativeMatch: GeneratedMatch = {
        gameNumber:   gameIndex,
        team1Player1: bestSplit.t1[0],
        team1Player2: bestSplit.t1[1],
        team2Player1: bestSplit.t2[0],
        team2Player2: bestSplit.t2[1],
        type:         bestSplit.type,
        team1Level:   Math.round(bestSplit.t1Sum),
        team2Level:   Math.round(bestSplit.t2Sum),
      }
      const { score } = scorePartial([...finalSchedule, tentativeMatch])

      if (score > bestScore) {
        bestScore = score
        bestCandidate = { group, split: bestSplit }
      }
    }

    // E. RELAXATION RETRY — fires when eligible (under-target) pool produced no valid group.
    // Three attempts, each relaxing one more hard filter, so under-target players always get
    // their games. In real sessions levels are 1–5, so forced matches are rarely severe.
    if (!bestCandidate && eligiblePlayers.length >= 4) {
      const relaxPool = [...eligiblePlayers].sort((a, b) => {
        const diff = (gamesPlayedCount.get(a) ?? 0) - (gamesPlayedCount.get(b) ?? 0)
        return diff !== 0 ? diff : Math.random() - 0.5
      })
      const relaxSearch = relaxPool.slice(0, SEARCH_LIMIT)

      // Attempt 1: relax gender only (spread still enforced)
      // Attempt 2: relax spread only (gender still enforced, skip if gender already disabled)
      // Attempt 3: relax both — force whatever group the eligible players can form
      const relaxAttempts = [
        { relaxSpread: false, relaxGender: true  },
        { relaxSpread: true,  relaxGender: false },
        { relaxSpread: true,  relaxGender: true  },
      ]

      for (const { relaxSpread, relaxGender } of relaxAttempts) {
        if (bestCandidate) break

        for (const group of combinations(relaxSearch, 4)) {
          const [a, b, c, d] = group as [string, string, string, string]

          if (!relaxSpread) {
            const levels = group.map((id) => levelMap.get(id) ?? 5)
            const spread = Math.round(Math.max(...levels)) - Math.round(Math.min(...levels))
            if (spread > maxSpreadLimit) continue
          }

          if (!relaxGender && !disableGenderRules) {
            const genders = group.map((id) => genderMap.get(id))
            const mCount = genders.filter((g) => g === 'M').length
            const fCount = genders.filter((g) => g === 'F').length
            if (!(mCount === 4 || fCount === 4 || (mCount === 2 && fCount === 2))) continue
          }

          candidatesEvaluated++

          const splits: [[string, string], [string, string]][] = [
            [[a, b], [c, d]], [[a, c], [b, d]], [[a, d], [b, c]],
          ]
          const validOptions = splits.map(([t1, t2]) => {
            const matchType = getMatchType(t1, t2)
            const t1Sum = (levelMap.get(t1[0]) ?? 5) + (levelMap.get(t1[1]) ?? 5)
            const t2Sum = (levelMap.get(t2[0]) ?? 5) + (levelMap.get(t2[1]) ?? 5)
            return { t1, t2, diff: Math.abs(t1Sum - t2Sum), type: matchType, t1Sum, t2Sum }
          })
          const bestSplit = validOptions.reduce((a, b) => (a.diff <= b.diff ? a : b))

          const tentativeMatch: GeneratedMatch = {
            gameNumber:   gameIndex,
            team1Player1: bestSplit.t1[0],
            team1Player2: bestSplit.t1[1],
            team2Player1: bestSplit.t2[0],
            team2Player2: bestSplit.t2[1],
            type:         bestSplit.type,
            team1Level:   Math.round(bestSplit.t1Sum),
            team2Level:   Math.round(bestSplit.t2Sum),
          }
          const { score } = scorePartial([...finalSchedule, tentativeMatch])

          if (score > bestScore) {
            bestScore = score
            bestCandidate = { group, split: bestSplit }
          }
        }
      }
    }

    // F. COMMIT the best candidate
    if (bestCandidate) {
      const { group, split: best } = bestCandidate

      if (_decisionLog) {
        _decisionLog.push({
          gameIndex,
          candidatesEvaluated,
          bestScore,
          selectedGroup: [...group],
        })
      }

      // Update game count for fairness sort
      for (const id of group) {
        gamesPlayedCount.set(id, (gamesPlayedCount.get(id) ?? 0) + 1)
      }

      finalSchedule.push({
        gameNumber:   gameIndex,
        team1Player1: best.t1[0],
        team1Player2: best.t1[1],
        team2Player1: best.t2[0],
        team2Player2: best.t2[1],
        type:         best.type,
        team1Level:   Math.round(best.t1Sum),
        team2Level:   Math.round(best.t2Sum),
      })
    }
  }

  // Balance participation for single-pass mode (optimizer runs its own final pass)
  if (!_skipBalance) {
    balanceParticipation(finalSchedule, playerIds, gamesPlayedCount, levelMap, genderMap, disableGenderRules, maxSpreadLimit)
  }

  return finalSchedule
}

// ---------------------------------------------------------------------------
// Post-process: equalise game counts (mirrors balance_participation)
// ---------------------------------------------------------------------------
function balanceParticipation(
  schedule: GeneratedMatch[],
  playerIds: string[],
  counts: Map<string, number>,
  levelMap: Map<string, number>,
  genderMap: Map<string, string>,
  disableGenderRules: boolean,
  maxSpreadLimit: number,
): void {
  const totalSlots = schedule.length * 4
  if (playerIds.length === 0 || totalSlots % playerIds.length !== 0) return

  const target = totalSlots / playerIds.length

  for (const enforceSpread of [true]) {
    if (!playerIds.some((p) => (counts.get(p) ?? 0) !== target)) break

    let improved = true
    while (improved) {
      improved = false

      outer: for (const match of schedule) {
        const sides: ['team1' | 'team2', [string, string], [string, string]][] = [
          ['team1', [match.team1Player1, match.team1Player2], [match.team2Player1, match.team2Player2]],
          ['team2', [match.team2Player1, match.team2Player2], [match.team1Player1, match.team1Player2]],
        ]

        for (const [teamKey, teamPlayers, otherPlayers] of sides) {
          for (let i = 0; i < teamPlayers.length; i++) {
            const oldPlayer = teamPlayers[i]
            if ((counts.get(oldPlayer) ?? 0) <= target) continue

            const matchSet = new Set([...teamPlayers, ...otherPlayers])

            for (const newPlayer of playerIds) {
              if (matchSet.has(newPlayer)) continue
              if ((counts.get(newPlayer) ?? 0) >= target) continue

              if (!disableGenderRules) {
                if (genderMap.get(newPlayer) !== genderMap.get(oldPlayer)) continue
              }

              const newTeam = [...teamPlayers] as [string, string]
              newTeam[i] = newPlayer
              const newFour = [...newTeam, ...otherPlayers]
              const newLevels = newFour.map((id) => levelMap.get(id) ?? 5)
              if (enforceSpread &&
                  Math.round(Math.max(...newLevels)) - Math.round(Math.min(...newLevels)) > maxSpreadLimit) continue

              if (teamKey === 'team1') {
                match.team1Player1 = newTeam[0]
                match.team1Player2 = newTeam[1]
                match.team1Level = Math.round((levelMap.get(newTeam[0]) ?? 5) + (levelMap.get(newTeam[1]) ?? 5))
                match.team2Level = Math.round((levelMap.get(otherPlayers[0]) ?? 5) + (levelMap.get(otherPlayers[1]) ?? 5))
              } else {
                match.team2Player1 = newTeam[0]
                match.team2Player2 = newTeam[1]
                match.team1Level = Math.round((levelMap.get(otherPlayers[0]) ?? 5) + (levelMap.get(otherPlayers[1]) ?? 5))
                match.team2Level = Math.round((levelMap.get(newTeam[0]) ?? 5) + (levelMap.get(newTeam[1]) ?? 5))
              }

              // Recompute match type after swap
              match.type = computeMatchType(
                match.team1Player1, match.team1Player2,
                match.team2Player1, match.team2Player2,
                genderMap,
              )

              counts.set(oldPlayer, (counts.get(oldPlayer) ?? 0) - 1)
              counts.set(newPlayer, (counts.get(newPlayer) ?? 0) + 1)
              improved = true
              break outer
            }
          }
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Score evaluation (mirrors evaluate_session_score)
// Grades a schedule on 6 factors: Participation, Fatigue, Partners, Wishes, Balance, Skill Gap
// ---------------------------------------------------------------------------
export function evaluateSessionScore(
  matches: GeneratedMatch[],
  levelMap: Map<string, number>,
  wishlistPairs: [string, string][],
  maxConsecutiveGames: number,
  weights: ScoreWeights,
  maxSpreadLimit: number,
  allPlayerIds?: string[],
  disableGenderRules?: boolean,
): AuditData {
  let score = 10000
  const audit: Omit<AuditData, 'score'> = {
    streakViolations: 0,
    repeatPartners: 0,
    wishesGranted: 0,
    levelGaps: 0,
    participationGap: 0,
    wideGaps: 0,
    mixedDoubles: 0,
  }

  const partnerCounts        = new Map<string, number>()
  const individualGameCounts = new Map<string, number>()
  const playerStreaks         = new Map<string, number>()

  // Initialize counts for all known players (critical for partial schedule fairness)
  if (allPlayerIds) {
    for (const id of allPlayerIds) {
      individualGameCounts.set(id, 0)
    }
  }

  // Collect all player IDs for streak reset tracking
  const knownPlayerIds = new Set<string>(allPlayerIds ?? [])
  for (const m of matches) {
    knownPlayerIds.add(m.team1Player1)
    knownPlayerIds.add(m.team1Player2)
    knownPlayerIds.add(m.team2Player1)
    knownPlayerIds.add(m.team2Player2)
  }

  for (const m of matches) {
    const currentPlayers = [m.team1Player1, m.team1Player2, m.team2Player1, m.team2Player2]
    const currentSet = new Set(currentPlayers)

    // Skill spread check
    const levels = currentPlayers.map((id) => levelMap.get(id) ?? 5)
    const spread = Math.round(Math.max(...levels)) - Math.round(Math.min(...levels))
    if (spread > maxSpreadLimit) {
      score -= weights.spreadPenalty
      audit.wideGaps++
    }

    // Participation tracking
    for (const p of currentPlayers) {
      individualGameCounts.set(p, (individualGameCounts.get(p) ?? 0) + 1)
    }

    // Streak tracking — penalise consecutive games over limit
    for (const p of currentPlayers) {
      const streak = (playerStreaks.get(p) ?? 0) + 1
      playerStreaks.set(p, streak)
      if (streak > maxConsecutiveGames) {
        score -= weights.streakWeight
        audit.streakViolations++
      }
    }
    // Reset streak for resting players
    for (const p of knownPlayerIds) {
      if (!currentSet.has(p)) playerStreaks.set(p, 0)
    }

    // Repeat partner check
    for (const team of [[m.team1Player1, m.team1Player2], [m.team2Player1, m.team2Player2]]) {
      const key = [...team].sort().join('|')
      const count = (partnerCounts.get(key) ?? 0) + 1
      partnerCounts.set(key, count)
      if (count > 1) {
        score -= weights.repeatPartnerPenalty
        audit.repeatPartners++
      }
    }

    // Wishlist reward
    for (const [pa, pb] of wishlistPairs) {
      const t1Set = new Set([m.team1Player1, m.team1Player2])
      const t2Set = new Set([m.team2Player1, m.team2Player2])
      if ((t1Set.has(pa) && t1Set.has(pb)) || (t2Set.has(pa) && t2Set.has(pb))) {
        score += weights.wishlistReward
        audit.wishesGranted++
      }
    }

    // Level imbalance penalty
    const diff = Math.abs(m.team1Level - m.team2Level)
    score -= diff * weights.imbalancePenalty
    audit.levelGaps += diff

    // Mixed doubles penalty — prefer Men's/Women's Doubles (skip when gender rules disabled)
    if (!disableGenderRules && (m.type === 'Mixed Doubles' || m.type === 'Doubles')) {
      score -= weights.mixedDoublesPenalty
      audit.mixedDoubles++
    }
  }

  // Fairness hammer — penalise uneven participation
  if (individualGameCounts.size > 0) {
    const counts = [...individualGameCounts.values()]
    const gap = Math.max(...counts) - Math.min(...counts)
    audit.participationGap = gap
    score -= gap * weights.fairnessWeight
  }

  return { ...audit, score }
}

// ---------------------------------------------------------------------------
// SA mutation helpers
// ---------------------------------------------------------------------------
const SA_SLOTS = ['team1Player1', 'team1Player2', 'team2Player1', 'team2Player2'] as const

/** Mutation A: swap positions of two matches (fixes streak/rest issues) */
function mutateMatchOrder(mutated: GeneratedMatch[]): boolean {
  if (mutated.length < 2) return false
  const i = Math.floor(Math.random() * mutated.length)
  let j = Math.floor(Math.random() * mutated.length)
  while (j === i) j = Math.floor(Math.random() * mutated.length)
  ;[mutated[i], mutated[j]] = [mutated[j], mutated[i]]
  mutated[i].gameNumber = i + 1
  mutated[j].gameNumber = j + 1
  return true
}

/** Mutation B: swap one player between two different matches (breaks repeat partners) */
function mutateCrossMatchSwap(
  mutated: GeneratedMatch[],
  genderMap: Map<string, string>,
  levelMap: Map<string, number>,
  disableGenderRules: boolean,
  maxSpreadLimit: number,
): boolean {
  if (mutated.length < 2) return false
  const i = Math.floor(Math.random() * mutated.length)
  let j = Math.floor(Math.random() * mutated.length)
  while (j === i) j = Math.floor(Math.random() * mutated.length)

  const si = Math.floor(Math.random() * 4)
  const sj = Math.floor(Math.random() * 4)
  const playerI = mutated[i][SA_SLOTS[si]]
  const playerJ = mutated[j][SA_SLOTS[sj]]

  // Gender filter
  if (!disableGenderRules && genderMap.get(playerI) !== genderMap.get(playerJ)) return false

  // Duplicate check — no player can appear twice in the same match
  const matchIAfter = SA_SLOTS.map((s) => (s === SA_SLOTS[si] ? playerJ : mutated[i][s]))
  const matchJAfter = SA_SLOTS.map((s) => (s === SA_SLOTS[sj] ? playerI : mutated[j][s]))
  if (new Set(matchIAfter).size !== 4 || new Set(matchJAfter).size !== 4) return false

  // Spread check for both matches
  const levelsI = matchIAfter.map((p) => levelMap.get(p) ?? 5)
  const spreadI = Math.round(Math.max(...levelsI)) - Math.round(Math.min(...levelsI))
  if (spreadI > maxSpreadLimit) return false
  const levelsJ = matchJAfter.map((p) => levelMap.get(p) ?? 5)
  const spreadJ = Math.round(Math.max(...levelsJ)) - Math.round(Math.min(...levelsJ))
  if (spreadJ > maxSpreadLimit) return false

  // Apply swap
  mutated[i][SA_SLOTS[si]] = playerJ
  mutated[j][SA_SLOTS[sj]] = playerI

  // Recompute team levels + type for both matches
  for (const idx of [i, j]) {
    const m = mutated[idx]
    m.team1Level = Math.round((levelMap.get(m.team1Player1) ?? 5) + (levelMap.get(m.team1Player2) ?? 5))
    m.team2Level = Math.round((levelMap.get(m.team2Player1) ?? 5) + (levelMap.get(m.team2Player2) ?? 5))
    m.type = computeMatchType(m.team1Player1, m.team1Player2, m.team2Player1, m.team2Player2, genderMap)
  }
  return true
}

/** Mutation C: reshuffle teams within a single match (fixes level imbalance) */
function mutateTeamReshuffle(
  mutated: GeneratedMatch[],
  levelMap: Map<string, number>,
  genderMap: Map<string, string>,
): boolean {
  const mi = Math.floor(Math.random() * mutated.length)
  const match = mutated[mi]
  const four = [match.team1Player1, match.team1Player2, match.team2Player1, match.team2Player2]

  // 3 possible splits: (0,1 vs 2,3), (0,2 vs 1,3), (0,3 vs 1,2)
  const splitOptions: [number, number, number, number][] = [
    [0, 1, 2, 3],
    [0, 2, 1, 3],
    [0, 3, 1, 2],
  ]
  const pick = splitOptions[Math.floor(Math.random() * 3)]

  match.team1Player1 = four[pick[0]]
  match.team1Player2 = four[pick[1]]
  match.team2Player1 = four[pick[2]]
  match.team2Player2 = four[pick[3]]

  match.team1Level = Math.round((levelMap.get(match.team1Player1) ?? 5) + (levelMap.get(match.team1Player2) ?? 5))
  match.team2Level = Math.round((levelMap.get(match.team2Player1) ?? 5) + (levelMap.get(match.team2Player2) ?? 5))
  match.type = computeMatchType(match.team1Player1, match.team1Player2, match.team2Player1, match.team2Player2, genderMap)
  return true
}

// ---------------------------------------------------------------------------
// Simulated annealing optimizer — mutate a schedule, accept improvements
// (and occasional downgrades to escape local optima), track best-ever
// ---------------------------------------------------------------------------
export function generateScheduleOptimized(
  players: PlayerInput[],
  options: OptimizeOptions = {},
): { matches: GeneratedMatch[]; audit: AuditData; decisions: MatchDecision[] } {
  const {
    numTrials = 50,
    wishlistPairs = [],
    weights = DEFAULT_WEIGHTS,
    maxConsecutiveGames = 1,
    maxSpreadLimit = 3,
    ...genOptions
  } = options

  const levelMap = new Map(players.map((p) => [p.id, p.level ?? 5]))
  const genderMap = new Map(players.map((p) => [p.id, p.gender ?? 'M']))
  const disableGenderRules =
    options.disableGenderRules ?? players.some((p) => p.gender == null)
  const playerIds = players.map((p) => p.id)

  const scoreSchedule = (m: GeneratedMatch[]) =>
    evaluateSessionScore(m, levelMap, wishlistPairs, maxConsecutiveGames, weights, maxSpreadLimit, playerIds, disableGenderRules)

  // Multi-start SA: run multiple SA passes from different starting schedules
  // and keep the best result. This smooths out variance from bad initial schedules.
  const NUM_STARTS = 15
  const trialsPerStart = numTrials

  let bestMatches: GeneratedMatch[] = []
  let bestAudit: AuditData = { score: -Infinity, streakViolations: 0, repeatPartners: 0, wishesGranted: 0, levelGaps: 0, participationGap: 0, wideGaps: 0, mixedDoubles: 0 }
  let bestScore = -Infinity
  const decisions: MatchDecision[] = []

  for (let start = 0; start < NUM_STARTS; start++) {
    const startDecisions: MatchDecision[] = []
    let current = generateSchedule(
      players,
      { maxConsecutiveGames, maxSpreadLimit, wishlistPairs, weights, ...genOptions },
      startDecisions,
      true, // _skipBalance — balance pass runs once at the end after SA
    )
    let currentAudit = scoreSchedule(current)

    // Track best for this SA pass
    if (currentAudit.score > bestScore) {
      bestScore = currentAudit.score
      bestMatches = current.map((m) => ({ ...m }))
      bestAudit = currentAudit
      decisions.length = 0
      decisions.push(...startDecisions)
    }

    // SA parameters — cooling rate adapts to numTrials so temperature always
    // drops from T0 → T_final over the full trial budget, regardless of count.
    const T0 = 500
    const T_final = 1
    const coolingRate = trialsPerStart > 1 ? Math.pow(T_final / T0, 1 / trialsPerStart) : 0.995
    let temperature = T0

  for (let i = 0; i < trialsPerStart; i++) {
    // Clone current schedule
    const mutated = current.map((m) => ({ ...m }))

    // Randomly select mutation type
    const r = Math.random()
    let applied: boolean

    if (r < 0.50) {
      // Single player swap (existing mutation)
      const mi = Math.floor(Math.random() * mutated.length)
      const match = mutated[mi]
      const si = Math.floor(Math.random() * 4)
      const oldPlayer = match[SA_SLOTS[si]]

      const inMatch = new Set(SA_SLOTS.map((s) => match[s]))
      const candidates = playerIds.filter((id) => {
        if (inMatch.has(id)) return false
        if (!disableGenderRules && genderMap.get(id) !== genderMap.get(oldPlayer)) return false
        const newFour = SA_SLOTS.map((s) => (s === SA_SLOTS[si] ? id : match[s]))
        const levels = newFour.map((p) => levelMap.get(p) ?? 5)
        const spread = Math.round(Math.max(...levels)) - Math.round(Math.min(...levels))
        if (spread > maxSpreadLimit) return false
        return true
      })

      if (candidates.length === 0) { applied = false } else {
        const newPlayer = candidates[Math.floor(Math.random() * candidates.length)]
        match[SA_SLOTS[si]] = newPlayer
        match.team1Level = Math.round((levelMap.get(match.team1Player1) ?? 5) + (levelMap.get(match.team1Player2) ?? 5))
        match.team2Level = Math.round((levelMap.get(match.team2Player1) ?? 5) + (levelMap.get(match.team2Player2) ?? 5))
        match.type = computeMatchType(match.team1Player1, match.team1Player2, match.team2Player1, match.team2Player2, genderMap)
        applied = true
      }
    } else if (r < 0.70) {
      // Mutation A: match order swap
      applied = mutateMatchOrder(mutated)
    } else if (r < 0.85) {
      // Mutation B: cross-match player swap
      applied = mutateCrossMatchSwap(mutated, genderMap, levelMap, disableGenderRules, maxSpreadLimit)
    } else {
      // Mutation C: intra-match team reshuffle
      applied = mutateTeamReshuffle(mutated, levelMap, genderMap)
    }

    if (!applied) { temperature *= coolingRate; continue }

    const mutatedAudit = scoreSchedule(mutated)
    const delta = mutatedAudit.score - currentAudit.score

    // Accept if better, or with SA probability if worse
    if (delta > 0 || Math.random() < Math.exp(delta / temperature)) {
      current = mutated
      currentAudit = mutatedAudit
    }

    // Track best-ever across all starts
    if (currentAudit.score > bestScore) {
      bestScore = currentAudit.score
      bestMatches = current.map((m) => ({ ...m }))
      bestAudit = currentAudit
      decisions.length = 0
      decisions.push(...startDecisions)
    }

    temperature *= coolingRate
  }
  } // end multi-start loop

  // G. BALANCE PARTICIPATION — final pass on the best schedule from all SA starts
  const finalCounts = new Map(playerIds.map((id) => [id, 0]))
  for (const m of bestMatches) {
    for (const id of [m.team1Player1, m.team1Player2, m.team2Player1, m.team2Player2]) {
      finalCounts.set(id, (finalCounts.get(id) ?? 0) + 1)
    }
  }
  balanceParticipation(bestMatches, playerIds, finalCounts, levelMap, genderMap, disableGenderRules, maxSpreadLimit)
  bestAudit = scoreSchedule(bestMatches)

  return { matches: bestMatches, audit: bestAudit, decisions }
}
