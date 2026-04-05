/**
 * Match Generation Engine v3 — Three-Phase Architecture
 *
 * Phase 1: ASSIGNMENT     — Who plays in which match?  → string[][] matrix
 * Phase 2: TEAM FORMATION — Given 4 players, best 2v2? → GeneratedMatch[]
 * Phase 3: OPTIMIZATION   — SA on the assignment matrix → best schedule
 *
 * Fairness is guaranteed by construction (Phase 1).
 * Team balance is locally optimal (Phase 2).
 * Global quality is optimized via SA (Phase 3).
 */

// ---------------------------------------------------------------------------
// Types
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
  type: string        // "Men's Doubles" | "Women's Doubles" | 'Mixed Doubles' | 'Doubles' | 'Uneven Doubles'
  team1Level: number  // sum of team 1 levels
  team2Level: number  // sum of team 2 levels
}

export interface GenerateOptions {
  numMatches?: number           // default: ceil(n*8/4)
  maxConsecutiveGames?: number  // default: 1 (no consecutive games)
  disableGenderRules?: boolean  // default: false (auto-true if any player has null gender)
  maxSpreadLimit?: number       // default: 3 (max integer level diff in one match)
  wishlistPairs?: [string, string][]
  weights?: ScoreWeights
}

export interface ScoreWeights {
  streakWeight: number          // default: 1000
  imbalancePenalty: number      // default: 100
  wishlistReward: number        // default: 500
  repeatPartnerPenalty: number  // default: 200
  fairnessWeight: number       // default: 5000
  spreadPenalty: number         // default: 2000
  mixedDoublesPenalty: number   // default: 300  — per MF vs MF match
  genderSplitPenalty: number   // default: 300  — per MM vs FF match (boys vs girls)
  unevenGenderPenalty: number  // default: 500  — per 3M+1F or 3F+1M match
}

export interface AuditData {
  score: number
  streakViolations: number
  repeatPartners: number
  wishesGranted: number
  levelGaps: number
  participationGap: number
  wideGaps: number
  mixedDoubles: number         // MF vs MF matches
  genderSplitMatches: number   // MM vs FF matches
  unevenGenderMatches: number  // 3M+1F or 3F+1M matches
}

export interface MatchDecision {
  gameIndex: number
  candidatesEvaluated: number
  bestScore: number
  selectedGroup: string[]
}

export interface OptimizeOptions extends GenerateOptions {
  numTrials?: number  // default: 50, SA trials per start
  numStarts?: number  // default: 15, number of SA restarts
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
  genderSplitPenalty: 300,
  unevenGenderPenalty: 500,
}

// ---------------------------------------------------------------------------
// Utility: match type from player genders
// ---------------------------------------------------------------------------
function computeMatchType(
  t1p1: string, t1p2: string, t2p1: string, t2p2: string,
  genderMap: Map<string, string>,
): string {
  const genders = [t1p1, t1p2, t2p1, t2p2].map((id) => genderMap.get(id))
  const mCount = genders.filter((g) => g === 'M').length
  const fCount = genders.filter((g) => g === 'F').length

  if (mCount === 4) return "Men's Doubles"
  if (fCount === 4) return "Women's Doubles"

  if (mCount === 2 && fCount === 2) {
    // MF vs MF = Mixed Doubles; MM vs FF = Doubles (gender split)
    const t1g1 = genderMap.get(t1p1), t1g2 = genderMap.get(t1p2)
    const t1Mixed = (t1g1 === 'M' && t1g2 === 'F') || (t1g1 === 'F' && t1g2 === 'M')
    const t2g1 = genderMap.get(t2p1), t2g2 = genderMap.get(t2p2)
    const t2Mixed = (t2g1 === 'M' && t2g2 === 'F') || (t2g1 === 'F' && t2g2 === 'M')
    if (t1Mixed && t2Mixed) return 'Mixed Doubles'
    return 'Doubles'  // MM vs FF
  }

  // 3M+1F or 3F+1M
  return 'Uneven Doubles'
}

// ---------------------------------------------------------------------------
// Utility: GCD + adjustNumMatches
// ---------------------------------------------------------------------------
function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}

export function adjustNumMatches(numMatches: number, n: number): number {
  if (n < 4) return numMatches
  const step = n / gcd(n, 4)
  return Math.max(step, Math.round(numMatches / step) * step)
}

// ---------------------------------------------------------------------------
// Utility: constraint checks
// ---------------------------------------------------------------------------
function isValidGenderComposition(group: string[], genderMap: Map<string, string>): boolean {
  const mCount = group.filter((id) => genderMap.get(id) === 'M').length
  const fCount = group.filter((id) => genderMap.get(id) === 'F').length
  return mCount === 4 || fCount === 4 || (mCount === 2 && fCount === 2)
}

function getSpread(group: string[], levelMap: Map<string, number>): number {
  const levels = group.map((id) => levelMap.get(id) ?? 5)
  return Math.round(Math.max(...levels)) - Math.round(Math.min(...levels))
}

// ---------------------------------------------------------------------------
// Phase 1: Assignment Matrix
// ---------------------------------------------------------------------------

/**
 * Builds an assignment matrix: for each match, picks 4 players.
 * Guarantees participation gap ≤ 1 by construction (when allowRelaxSpread=true).
 *
 * @param allowRelaxSpread  When true, relaxes spread as last resort to fill all slots.
 *                          SA optimizer passes false to guarantee hard spread constraints.
 */
function buildAssignment(
  playerIds: string[],
  numMatches: number,
  levelMap: Map<string, number>,
  genderMap: Map<string, string>,
  maxSpreadLimit: number,
  disableGenderRules: boolean,
  allowRelaxSpread = true,
): string[][] {
  const n = playerIds.length
  const totalSlots = numMatches * 4

  // Target games: some players get base+1 to fill the remainder
  const base = Math.floor(totalSlots / n)
  const remainder = totalSlots % n
  const shuffled = [...playerIds].sort(() => Math.random() - 0.5)
  const remaining = new Map<string, number>()
  shuffled.forEach((id, i) => {
    remaining.set(id, i < remainder ? base + 1 : base)
  })

  const schedule: string[][] = []
  const prevMatchPlayers = new Set<string>()

  for (let m = 0; m < numMatches; m++) {
    // Sort candidates: most remaining games first, then deprioritize players
    // who just played (streak avoidance), then random tiebreak
    const candidates = [...remaining.entries()]
      .filter(([, r]) => r > 0)
      .sort((a, b) => {
        const remDiff = b[1] - a[1]
        if (remDiff !== 0) return remDiff
        // Deprioritize players who played in the previous match
        const aJust = prevMatchPlayers.has(a[0]) ? 1 : 0
        const bJust = prevMatchPlayers.has(b[0]) ? 1 : 0
        if (aJust !== bJust) return aJust - bJust
        return Math.random() - 0.5
      })
      .map(([id]) => id)

    const group = findValidGroup(
      candidates, levelMap, genderMap, maxSpreadLimit, disableGenderRules, allowRelaxSpread,
    )

    if (group) {
      schedule.push(group)
      for (const id of group) remaining.set(id, remaining.get(id)! - 1)
      prevMatchPlayers.clear()
      for (const id of group) prevMatchPlayers.add(id)
    } else if (allowRelaxSpread && candidates.length >= 4) {
      const fallback = candidates.slice(0, 4)
      schedule.push(fallback)
      for (const id of fallback) remaining.set(id, remaining.get(id)! - 1)
      prevMatchPlayers.clear()
      for (const id of fallback) prevMatchPlayers.add(id)
    }
  }

  return schedule
}

/**
 * Finds a valid group of 4 from sorted candidates.
 * Progressive relaxation: full → relax gender → (optionally) relax spread → relax both.
 */
function findValidGroup(
  candidates: string[],
  levelMap: Map<string, number>,
  genderMap: Map<string, string>,
  maxSpreadLimit: number,
  disableGenderRules: boolean,
  allowRelaxSpread: boolean,
): string[] | null {
  const attempts: { checkSpread: boolean; checkGender: boolean }[] = [
    { checkSpread: true,  checkGender: true  },
    { checkSpread: true,  checkGender: false },
  ]
  if (allowRelaxSpread) {
    attempts.push(
      { checkSpread: false, checkGender: true  },
      { checkSpread: false, checkGender: false },
    )
  }

  for (const { checkSpread, checkGender } of attempts) {
    const result = pickGroup(candidates, levelMap, genderMap, maxSpreadLimit,
      checkSpread, checkGender && !disableGenderRules)
    if (result) return result
  }

  return null
}

/**
 * Picks 4 players from candidates satisfying constraints.
 * Exhaustive search over top-16 candidates (sorted by need).
 */
function pickGroup(
  candidates: string[],
  levelMap: Map<string, number>,
  genderMap: Map<string, string>,
  maxSpreadLimit: number,
  checkSpread: boolean,
  checkGender: boolean,
): string[] | null {
  const n = candidates.length
  if (n < 4) return null

  const limit = Math.min(n, 16)

  for (let a = 0; a < limit - 3; a++) {
    for (let b = a + 1; b < limit - 2; b++) {
      for (let c = b + 1; c < limit - 1; c++) {
        for (let d = c + 1; d < limit; d++) {
          const group = [candidates[a], candidates[b], candidates[c], candidates[d]]
          if (checkSpread && getSpread(group, levelMap) > maxSpreadLimit) continue
          if (checkGender && !isValidGenderComposition(group, genderMap)) continue
          return group
        }
      }
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// Phase 2: Team Formation
// ---------------------------------------------------------------------------

interface FormedMatch {
  team1: [string, string]
  team2: [string, string]
  type: string
  team1Level: number
  team2Level: number
}

/**
 * Given 4 players, finds the best 2v2 split.
 * Evaluates all 3 possible splits, picks lowest level imbalance.
 */
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
  let bestDiff = Infinity

  for (const [t1, t2] of splits) {
    const t1Sum = (levelMap.get(t1[0]) ?? 5) + (levelMap.get(t1[1]) ?? 5)
    const t2Sum = (levelMap.get(t2[0]) ?? 5) + (levelMap.get(t2[1]) ?? 5)
    const diff = Math.abs(t1Sum - t2Sum)
    const type = computeMatchType(t1[0], t1[1], t2[0], t2[1], genderMap)

    const typeBonus = (!disableGenderRules &&
      (type === "Men's Doubles" || type === "Women's Doubles")) ? 0.01 : 0

    if (diff - typeBonus < bestDiff) {
      bestDiff = diff - typeBonus
      best = {
        team1: t1, team2: t2, type,
        team1Level: Math.round(t1Sum),
        team2Level: Math.round(t2Sum),
      }
    }
  }

  return best!
}

/**
 * Converts an assignment matrix into GeneratedMatch[] by forming teams for each group.
 */
function assignmentToMatches(
  assignment: string[][],
  levelMap: Map<string, number>,
  genderMap: Map<string, string>,
  disableGenderRules: boolean,
): GeneratedMatch[] {
  return assignment.map((group, i) => {
    const formed = formTeams(group, levelMap, genderMap, disableGenderRules)
    return {
      gameNumber: i + 1,
      team1Player1: formed.team1[0],
      team1Player2: formed.team1[1],
      team2Player1: formed.team2[0],
      team2Player2: formed.team2[1],
      type: formed.type,
      team1Level: formed.team1Level,
      team2Level: formed.team2Level,
    }
  })
}

// ---------------------------------------------------------------------------
// Phase 3: SA Optimization
// ---------------------------------------------------------------------------

/**
 * Cross-match player swap: swap one player from match i with one from match j.
 */
function mutateCrossSwap(
  assignment: string[][],
  genderMap: Map<string, string>,
  levelMap: Map<string, number>,
  disableGenderRules: boolean,
  maxSpreadLimit: number,
): boolean {
  if (assignment.length < 2) return false

  const i = Math.floor(Math.random() * assignment.length)
  let j = Math.floor(Math.random() * assignment.length)
  while (j === i) j = Math.floor(Math.random() * assignment.length)

  const si = Math.floor(Math.random() * 4)
  const sj = Math.floor(Math.random() * 4)
  const pI = assignment[i][si]
  const pJ = assignment[j][sj]

  if (pI === pJ) return false
  // No gender guard — scorer penalizes bad gender compositions via soft penalties
  if (assignment[j].includes(pI) || assignment[i].includes(pJ)) return false

  // Spread check on both resulting groups
  const newGroupI = assignment[i].map((id, k) => k === si ? pJ : id)
  const newGroupJ = assignment[j].map((id, k) => k === sj ? pI : id)
  if (getSpread(newGroupI, levelMap) > maxSpreadLimit) return false
  if (getSpread(newGroupJ, levelMap) > maxSpreadLimit) return false

  assignment[i][si] = pJ
  assignment[j][sj] = pI
  return true
}

/**
 * Row swap: swap the positions of two matches (for streak optimization).
 */
function mutateRowSwap(assignment: string[][]): boolean {
  if (assignment.length < 2) return false
  const i = Math.floor(Math.random() * assignment.length)
  let j = Math.floor(Math.random() * assignment.length)
  while (j === i) j = Math.floor(Math.random() * assignment.length)
  ;[assignment[i], assignment[j]] = [assignment[j], assignment[i]]
  return true
}

/**
 * SA optimization on the assignment matrix.
 */
function optimizeAssignment(
  assignment: string[][],
  playerIds: string[],
  levelMap: Map<string, number>,
  genderMap: Map<string, string>,
  disableGenderRules: boolean,
  maxSpreadLimit: number,
  numTrials: number,
  wishlistPairs: [string, string][],
  maxConsecutiveGames: number,
  weights: ScoreWeights,
): { assignment: string[][]; audit: AuditData } {
  const scoreAssignment = (a: string[][]) => {
    const matches = assignmentToMatches(a, levelMap, genderMap, disableGenderRules)
    return evaluateSessionScore(matches, levelMap, wishlistPairs, maxConsecutiveGames,
      weights, maxSpreadLimit, playerIds, disableGenderRules)
  }

  let current = assignment.map((g) => [...g])
  let currentAudit = scoreAssignment(current)

  let bestEver = current.map((g) => [...g])
  let bestEverAudit = currentAudit

  const T0 = 500, Tf = 1
  const coolingRate = numTrials > 1 ? Math.pow(Tf / T0, 1 / numTrials) : 0.995
  let temperature = T0

  for (let i = 0; i < numTrials; i++) {
    const candidate = current.map((g) => [...g])

    const applied = Math.random() < 0.80
      ? mutateCrossSwap(candidate, genderMap, levelMap, disableGenderRules, maxSpreadLimit)
      : mutateRowSwap(candidate)

    if (!applied) { temperature *= coolingRate; continue }

    const candidateAudit = scoreAssignment(candidate)
    const delta = candidateAudit.score - currentAudit.score

    if (delta > 0 || Math.random() < Math.exp(delta / temperature)) {
      current = candidate
      currentAudit = candidateAudit
    }

    if (currentAudit.score > bestEverAudit.score) {
      bestEver = current.map((g) => [...g])
      bestEverAudit = currentAudit
    }

    temperature *= coolingRate
  }

  return { assignment: bestEver, audit: bestEverAudit }
}

// ---------------------------------------------------------------------------
// Scorer: evaluateSessionScore (unchanged from v2)
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
    genderSplitMatches: 0,
    unevenGenderMatches: 0,
  }

  const partnerCounts        = new Map<string, number>()
  const individualGameCounts = new Map<string, number>()
  const playerStreaks         = new Map<string, number>()

  if (allPlayerIds) {
    for (const id of allPlayerIds) {
      individualGameCounts.set(id, 0)
    }
  }

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

    const levels = currentPlayers.map((id) => levelMap.get(id) ?? 5)
    const spread = Math.round(Math.max(...levels)) - Math.round(Math.min(...levels))
    if (spread > maxSpreadLimit) {
      score -= weights.spreadPenalty
      audit.wideGaps++
    }

    for (const p of currentPlayers) {
      individualGameCounts.set(p, (individualGameCounts.get(p) ?? 0) + 1)
    }

    for (const p of currentPlayers) {
      const streak = (playerStreaks.get(p) ?? 0) + 1
      playerStreaks.set(p, streak)
      if (streak > maxConsecutiveGames) {
        score -= weights.streakWeight
        audit.streakViolations++
      }
    }
    for (const p of knownPlayerIds) {
      if (!currentSet.has(p)) playerStreaks.set(p, 0)
    }

    for (const team of [[m.team1Player1, m.team1Player2], [m.team2Player1, m.team2Player2]]) {
      const key = [...team].sort().join('|')
      const count = (partnerCounts.get(key) ?? 0) + 1
      partnerCounts.set(key, count)
      if (count > 1) {
        score -= weights.repeatPartnerPenalty
        audit.repeatPartners++
      }
    }

    for (const [pa, pb] of wishlistPairs) {
      const t1Set = new Set([m.team1Player1, m.team1Player2])
      const t2Set = new Set([m.team2Player1, m.team2Player2])
      if ((t1Set.has(pa) && t1Set.has(pb)) || (t2Set.has(pa) && t2Set.has(pb))) {
        score += weights.wishlistReward
        audit.wishesGranted++
      }
    }

    const diff = Math.abs(m.team1Level - m.team2Level)
    score -= diff * weights.imbalancePenalty
    audit.levelGaps += diff

    // Gender composition penalties (3 types)
    if (!disableGenderRules) {
      if (m.type === 'Mixed Doubles') {
        score -= weights.mixedDoublesPenalty
        audit.mixedDoubles++
      } else if (m.type === 'Doubles') {
        score -= weights.genderSplitPenalty
        audit.genderSplitMatches++
      } else if (m.type === 'Uneven Doubles') {
        score -= weights.unevenGenderPenalty
        audit.unevenGenderMatches++
      }
    }
  }

  if (individualGameCounts.size > 0) {
    const counts = [...individualGameCounts.values()]
    const gap = Math.max(...counts) - Math.min(...counts)
    audit.participationGap = gap
    score -= gap * weights.fairnessWeight
  }

  return { ...audit, score }
}

// ---------------------------------------------------------------------------
// Public API: generateSchedule (multi-trial best-of)
// ---------------------------------------------------------------------------

/**
 * Single-pass schedule generation.
 * Builds multiple random assignments, scores each, keeps the best.
 * This gives quality awareness (streaks, partners) without full SA.
 */
export function generateSchedule(
  players: PlayerInput[],
  options: GenerateOptions = {},
  _decisionLog?: MatchDecision[],
  _skipBalance = false,  // accepted for API compat, not used in v3
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

  const disableGenderRules =
    options.disableGenderRules ?? players.some((p) => p.gender == null)

  const playerIds = players.map((p) => p.id)
  const genderMap = new Map(players.map((p) => [p.id, p.gender ?? 'M']))
  const levelMap  = new Map(players.map((p) => [p.id, p.level ?? 5]))

  const adjustedNumMatches = adjustNumMatches(numMatches, n)

  const scoreMatches = (m: GeneratedMatch[]) =>
    evaluateSessionScore(m, levelMap, wishlistPairs, maxConsecutiveGames,
      weights, maxSpreadLimit, playerIds, disableGenderRules)

  // Try multiple random assignments, keep the best
  const NUM_TRIALS = 30
  let bestAssignment: string[][] = []
  let bestMatches: GeneratedMatch[] = []
  let bestScore = -Infinity

  for (let t = 0; t < NUM_TRIALS; t++) {
    const assignment = buildAssignment(
      playerIds, adjustedNumMatches, levelMap, genderMap, maxSpreadLimit, disableGenderRules,
    )
    const matches = assignmentToMatches(assignment, levelMap, genderMap, disableGenderRules)
    const { score } = scoreMatches(matches)

    if (score > bestScore) {
      bestScore = score
      bestAssignment = assignment
      bestMatches = matches
    }
  }

  // Populate decision log if requested
  if (_decisionLog) {
    for (let i = 0; i < bestAssignment.length; i++) {
      _decisionLog.push({
        gameIndex: i + 1,
        candidatesEvaluated: NUM_TRIALS,
        bestScore,
        selectedGroup: [...bestAssignment[i]],
      })
    }
  }

  return bestMatches
}

// ---------------------------------------------------------------------------
// Public API: generateScheduleOptimized (multi-start SA)
// ---------------------------------------------------------------------------
export function generateScheduleOptimized(
  players: PlayerInput[],
  options: OptimizeOptions = {},
): { matches: GeneratedMatch[]; audit: AuditData; decisions: MatchDecision[] } {
  const {
    numTrials = 50,
    numStarts = 15,
    numMatches = Math.ceil((players.length * 8) / 4),
    wishlistPairs = [],
    weights = DEFAULT_WEIGHTS,
    maxConsecutiveGames = 1,
    maxSpreadLimit = 3,
  } = options

  const disableGenderRules =
    options.disableGenderRules ?? players.some((p) => p.gender == null)

  const playerIds = players.map((p) => p.id)
  const levelMap  = new Map(players.map((p) => [p.id, p.level ?? 5]))
  const genderMap = new Map(players.map((p) => [p.id, p.gender ?? 'M']))

  const adjustedNumMatches = adjustNumMatches(numMatches, players.length)

  const NUM_STARTS = numStarts
  const trialsPerStart = numTrials

  let bestMatches: GeneratedMatch[] = []
  let bestAudit: AuditData = {
    score: -Infinity, streakViolations: 0, repeatPartners: 0,
    wishesGranted: 0, levelGaps: 0, participationGap: 0, wideGaps: 0,
    mixedDoubles: 0, genderSplitMatches: 0, unevenGenderMatches: 0,
  }
  const decisions: MatchDecision[] = []

  for (let start = 0; start < NUM_STARTS; start++) {
    // Phase 1: Build assignment — never relax spread (SA preserves it)
    const assignment = buildAssignment(
      playerIds, adjustedNumMatches, levelMap, genderMap,
      maxSpreadLimit, disableGenderRules, false,
    )

    // Phase 3: SA optimization
    const { assignment: optimized, audit } = optimizeAssignment(
      assignment, playerIds, levelMap, genderMap, disableGenderRules,
      maxSpreadLimit, trialsPerStart, wishlistPairs, maxConsecutiveGames, weights,
    )

    if (audit.score > bestAudit.score) {
      bestAudit = audit
      bestMatches = assignmentToMatches(optimized, levelMap, genderMap, disableGenderRules)

      decisions.length = 0
      for (let i = 0; i < optimized.length; i++) {
        decisions.push({
          gameIndex: i + 1,
          candidatesEvaluated: trialsPerStart,
          bestScore: audit.score,
          selectedGroup: [...optimized[i]],
        })
      }
    }
  }

  // Re-score final formed matches
  const finalAudit = evaluateSessionScore(
    bestMatches, levelMap, wishlistPairs, maxConsecutiveGames,
    weights, maxSpreadLimit, playerIds, disableGenderRules,
  )

  return { matches: bestMatches, audit: finalAudit, decisions }
}
