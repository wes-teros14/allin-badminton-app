/**
 * Match Generation Engine — TypeScript port of old_badminton_web_app.py (Sections 3 + scoring)
 *
 * Two modes:
 *   generateSchedule()         — single pass, fast
 *   generateScheduleOptimized() — iterative optimizer: runs N trials, scores each, returns best
 *
 * Algorithm (single pass):
 *   A. SORT      — Prioritise players with fewest games played; random tie-breaking.
 *   B. SELECTION — Combinatorial search over top-12 eligible players (all C(n,4) groups).
 *   C. FILTER    — Hard skill-gap filter, streak limit, gender composition rules.
 *   D. OPTIMISE  — Evaluate all 3 team splits per group; pick lowest level-sum diff.
 *   E. RELAX     — 3-phase constraint relaxation guarantees a match is always found.
 *   F. BALANCE   — Post-process swap pass to equalise total game counts per player.
 */

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface PlayerInput {
  id: string
  nameSlug: string
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
  avoidRepeatPartners?: boolean // default: true
  streakLimit?: number          // default: 1 (no consecutive games)
  prioritizeGenderDoubles?: boolean // default: true (prefer MD/WD over mixed)
  disableGenderRules?: boolean  // default: false (auto-true if any player has null gender)
  maxSpreadLimit?: number       // default: 3 (max integer level diff in one match)
}

export interface ScoreWeights {
  streakWeight: number          // default: 1000 — fatigue penalty per game over streak limit
  imbalancePenalty: number      // default: 100  — per 1-point level diff between teams
  wishlistReward: number        // default: 500  — reward per wishlist pair granted
  repeatPartnerPenalty: number  // default: 200  — per repeat partnership
  fairnessWeight: number        // default: 5000 — per game-count gap between players
  spreadPenalty: number         // default: 2000 — per match exceeding maxSpreadLimit
}

export interface AuditData {
  score: number
  streakViolations: number
  repeatPartners: number
  wishesGranted: number
  levelGaps: number
  participationGap: number
  wideGaps: number
}

export interface OptimizeOptions extends GenerateOptions {
  numTrials?: number                    // default: 50, range 10–500
  wishlistPairs?: [string, string][]    // pairs of player IDs to reward being teamed
  weights?: ScoreWeights
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
// Single-pass schedule generation
// ---------------------------------------------------------------------------
export function generateSchedule(
  players: PlayerInput[],
  options: GenerateOptions = {},
): GeneratedMatch[] {
  const n = players.length
  if (n < 4) return []

  const {
    numMatches = Math.ceil((n * 8) / 4),
    avoidRepeatPartners = true,
    streakLimit = 1,
    prioritizeGenderDoubles = true,
    maxSpreadLimit = 3,
  } = options

  // Auto-disable gender rules if any player is missing gender data
  const disableGenderRules =
    options.disableGenderRules ?? players.some((p) => p.gender == null)

  const playerIds = players.map((p) => p.id)
  const genderMap = new Map(players.map((p) => [p.id, p.gender ?? 'M']))
  const levelMap  = new Map(players.map((p) => [p.id, p.level  ?? 5]))

  const gamesPlayedCount   = new Map(playerIds.map((id) => [id, 0]))
  const playerStreaks       = new Map(playerIds.map((id) => [id, 0]))
  const teamPairingHistory = new Set<string>()

  const finalSchedule: GeneratedMatch[] = []
  const SEARCH_LIMIT = 12

  function getMatchType(t1: [string, string], t2: [string, string]): string {
    function teamCategory(p1: string, p2: string): string {
      const g1 = genderMap.get(p1)
      const g2 = genderMap.get(p2)
      if ((g1 === 'M' && g2 === 'F') || (g1 === 'F' && g2 === 'M')) return 'Mixed'
      return g1 === 'M' ? "Men's" : "Women's"
    }
    const type1 = teamCategory(...t1)
    const type2 = teamCategory(...t2)
    if (type1 === 'Mixed' && type2 === 'Mixed') return 'Mixed Doubles'
    if (type1 === type2) return `${type1} Doubles`
    return 'Doubles'
  }

  for (let gameIndex = 1; gameIndex <= numMatches; gameIndex++) {
    // A. FAIRNESS SORT — fewest games first; random tie-breaking for variety
    const sortedPlayers = [...playerIds].sort((a, b) => {
      const diff = (gamesPlayedCount.get(a) ?? 0) - (gamesPlayedCount.get(b) ?? 0)
      return diff !== 0 ? diff : Math.random() - 0.5
    })

    // E. PHASES — constraint relaxation
    const phases = disableGenderRules
      ? [
          { respectRest: true,  respectPartner: true,  forceGender: false },
          { respectRest: true,  respectPartner: false, forceGender: false },
          { respectRest: false, respectPartner: false, forceGender: false },
        ]
      : [
          { respectRest: true,  respectPartner: true,  forceGender: prioritizeGenderDoubles },
          { respectRest: true,  respectPartner: false, forceGender: prioritizeGenderDoubles },
          { respectRest: false, respectPartner: false, forceGender: false },
        ]

    let matchFound = false

    for (const phase of phases) {
      if (matchFound) break

      const searchPool = sortedPlayers.slice(0, SEARCH_LIMIT)

      for (const group of combinations(searchPool, 4)) {
        const [a, b, c, d] = group as [string, string, string, string]

        // C. HARD SKILL-GAP FILTER
        const levels = group.map((id) => levelMap.get(id) ?? 5)
        const spread =
          Math.round(Math.max(...levels)) - Math.round(Math.min(...levels))
        if (spread > maxSpreadLimit) continue

        // C. STREAK FILTER
        if (phase.respectRest &&
            group.some((id) => (playerStreaks.get(id) ?? 0) >= streakLimit)) continue

        // C. GENDER COMPOSITION FILTER (4M, 4F, or 2M+2F only)
        if (!disableGenderRules) {
          const genders = group.map((id) => genderMap.get(id))
          const mCount = genders.filter((g) => g === 'M').length
          const fCount = genders.filter((g) => g === 'F').length
          if (!(mCount === 4 || fCount === 4 || (mCount === 2 && fCount === 2))) continue
        }

        // D. ALL 3 TEAM SPLITS — pick most balanced by level sum diff
        const splits: [[string, string], [string, string]][] = [
          [[a, b], [c, d]],
          [[a, c], [b, d]],
          [[a, d], [b, c]],
        ]

        type SplitOption = {
          t1: [string, string]; t2: [string, string]
          diff: number; type: string; t1Sum: number; t2Sum: number
        }
        const validOptions: SplitOption[] = []

        for (const [t1, t2] of splits) {
          const matchType = disableGenderRules ? 'Doubles' : getMatchType(t1, t2)

          if (!disableGenderRules && phase.forceGender) {
            if (matchType === 'Mixed Doubles' || matchType === 'Doubles') continue
          }

          if (phase.respectPartner && avoidRepeatPartners) {
            if (teamPairingHistory.has([...t1].sort().join('|'))) continue
          }

          const t1Sum = (levelMap.get(t1[0]) ?? 5) + (levelMap.get(t1[1]) ?? 5)
          const t2Sum = (levelMap.get(t2[0]) ?? 5) + (levelMap.get(t2[1]) ?? 5)
          validOptions.push({ t1, t2, diff: Math.abs(t1Sum - t2Sum), type: matchType, t1Sum, t2Sum })
        }

        if (validOptions.length === 0) continue

        const best = validOptions.reduce((a, b) => (a.diff <= b.diff ? a : b))

        // Update counters
        for (const id of group) {
          gamesPlayedCount.set(id, (gamesPlayedCount.get(id) ?? 0) + 1)
        }
        const playingSet = new Set(group)
        for (const id of playerIds) {
          playerStreaks.set(
            id,
            playingSet.has(id) ? (playerStreaks.get(id) ?? 0) + 1 : 0,
          )
        }
        if (avoidRepeatPartners) {
          teamPairingHistory.add([...best.t1].sort().join('|'))
          teamPairingHistory.add([...best.t2].sort().join('|'))
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

        matchFound = true
        break
      }
    }
  }

  // F. BALANCE PARTICIPATION — post-process swap pass
  balanceParticipation(finalSchedule, playerIds, gamesPlayedCount, levelMap, genderMap, disableGenderRules, maxSpreadLimit)

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

  for (const enforceSpread of [true, false]) {
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

              if (enforceSpread && !disableGenderRules) {
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
  streakLimit: number,
  weights: ScoreWeights,
  maxSpreadLimit: number,
): AuditData {
  let score = 10000
  const audit: Omit<AuditData, 'score'> = {
    streakViolations: 0,
    repeatPartners: 0,
    wishesGranted: 0,
    levelGaps: 0,
    participationGap: 0,
    wideGaps: 0,
  }

  const partnerCounts        = new Map<string, number>()
  const individualGameCounts = new Map<string, number>()
  const playerStreaks         = new Map<string, number>()

  // Collect all player IDs for streak reset tracking
  const allPlayerIds = new Set<string>()
  for (const m of matches) {
    allPlayerIds.add(m.team1Player1)
    allPlayerIds.add(m.team1Player2)
    allPlayerIds.add(m.team2Player1)
    allPlayerIds.add(m.team2Player2)
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
      if (streak > streakLimit) {
        score -= weights.streakWeight
        audit.streakViolations++
      }
    }
    // Reset streak for resting players
    for (const p of allPlayerIds) {
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
// Iterative optimizer — run N trials, score each, return best
// ---------------------------------------------------------------------------
export function generateScheduleOptimized(
  players: PlayerInput[],
  options: OptimizeOptions = {},
): { matches: GeneratedMatch[]; audit: AuditData } {
  const {
    numTrials = 50,
    wishlistPairs = [],
    weights = DEFAULT_WEIGHTS,
    streakLimit = 1,
    maxSpreadLimit = 3,
    ...genOptions
  } = options

  const levelMap = new Map(players.map((p) => [p.id, p.level ?? 5]))
  const scoreWeights = weights ?? DEFAULT_WEIGHTS

  let bestMatches: GeneratedMatch[] = []
  let bestScore = -Infinity
  let bestAudit: AuditData = {
    score: 0, streakViolations: 0, repeatPartners: 0,
    wishesGranted: 0, levelGaps: 0, participationGap: 0, wideGaps: 0,
  }

  for (let i = 0; i < numTrials; i++) {
    const matches = generateSchedule(players, { streakLimit, maxSpreadLimit, ...genOptions })
    const audit = evaluateSessionScore(
      matches, levelMap, wishlistPairs, streakLimit, scoreWeights, maxSpreadLimit,
    )
    if (audit.score > bestScore) {
      bestScore = audit.score
      bestMatches = matches
      bestAudit = audit
    }
  }

  return { matches: bestMatches, audit: bestAudit }
}
