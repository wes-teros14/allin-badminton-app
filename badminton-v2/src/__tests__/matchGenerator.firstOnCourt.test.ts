import { describe, it, expect } from 'vitest'
import {
  evaluateSessionScore,
  generateScheduleOptimized,
  firstOnCourtGames,
  openingGameLimit,
  DEFAULT_WEIGHTS,
} from '@/lib/matchGenerator'
import type { GeneratedMatch, PlayerInput } from '@/lib/matchGenerator'
import { getPlayersInMatch } from './fixtures/helpers'

const W = DEFAULT_WEIGHTS

/** 15 uniform players — the real session shape. */
const FIFTEEN: PlayerInput[] = Array.from({ length: 15 }, (_, i) => ({
  id: `p${i + 1}`,
  nameSlug: `p${i + 1}`,
  nickname: null,
  gender: 'M' as const,
  level: 3,
}))

function makeMatch(gameNumber: number, ids: string[]): GeneratedMatch {
  return {
    gameNumber,
    team1Player1: ids[0],
    team1Player2: ids[1],
    team2Player1: ids[2],
    team2Player2: ids[3],
    type: "Men's Doubles",
    team1Level: 10,
    team2Level: 10,
  }
}

/**
 * Six matches of otherwise-unique players, with player `x` planted in game 1 and
 * again `gap` games later. Everything else — team levels, spreads, partnerships,
 * participation — is held constant, so score differences between two gaps come
 * only from the rule under test.
 */
function scheduleWithGap(gap: number): GeneratedMatch[] {
  const matches: GeneratedMatch[] = []
  for (let m = 0; m < 6; m++) {
    matches.push(makeMatch(m + 1, [`m${m}a`, `m${m}b`, `m${m}c`, `m${m}d`]))
  }
  const plant = (index: number) =>
    (matches[index] = makeMatch(index + 1, ['x', `m${index}b`, `m${index}c`, `m${index}d`]))
  plant(0)
  plant(gap)
  return matches
}

const uniformLevels = (matches: GeneratedMatch[]) =>
  new Map(matches.flatMap(getPlayersInMatch).map((id) => [id, 3]))

/** Scores `scheduleWithGap(gap)` with everything but the court count fixed. */
function audit(gap: number, courtCount: number, weights = W) {
  const matches = scheduleWithGap(gap)
  return evaluateSessionScore(
    matches, uniformLevels(matches), [], 1, weights, 3,
    undefined, true, 2, 20, courtCount,
  )
}

/** First-on-court players who reappear at or below the window limit. */
function countOpeningRepeats(matches: GeneratedMatch[], courtCount: number): number {
  const firstOnCourt = firstOnCourtGames(courtCount)
  const gameLimit = openingGameLimit(courtCount)
  const openers = new Set(matches.slice(0, firstOnCourt).flatMap(getPlayersInMatch))
  let n = 0
  for (const m of matches.slice(firstOnCourt, gameLimit)) {
    for (const id of getPlayersInMatch(m)) if (openers.has(id)) n++
  }
  return n
}

// ---------------------------------------------------------------------------
// F1 — the window
// ---------------------------------------------------------------------------

describe('First on court — the window', () => {
  it('F1.1 — First on court is one game per court', () => {
    expect(firstOnCourtGames(1)).toBe(1)   // game 1
    expect(firstOnCourtGames(2)).toBe(2)   // games 1-2, started together
    expect(firstOnCourtGames(3)).toBe(3)
  })

  it('F1.2 — the window is court count x 2', () => {
    expect(openingGameLimit(1)).toBe(2)    // games 1-2
    expect(openingGameLimit(2)).toBe(4)    // games 1-4
    expect(openingGameLimit(3)).toBe(6)    // games 1-6
  })

  it('F1.3 — a court count of 0 or junk is treated as 1', () => {
    expect(firstOnCourtGames(0)).toBe(1)
    expect(openingGameLimit(0)).toBe(2)
    expect(firstOnCourtGames(-3)).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// F2 — the penalty
// ---------------------------------------------------------------------------

describe('First on court — the penalty', () => {
  it('F2.1 — fires for a First-on-court player back inside the window', () => {
    // 2 courts: openers are games 1-2, the window ends at game 4.
    expect(audit(2, 2).openingRepeats).toBe(1)  // games 1 & 3
    expect(audit(3, 2).openingRepeats).toBe(1)  // games 1 & 4 — the reported case
    expect(audit(4, 2).openingRepeats).toBe(0)  // game 5 is outside the window
  })

  it('F2.2 — at one court the window is games 1-2', () => {
    expect(audit(1, 1).openingRepeats).toBe(1)  // games 1 & 2
    expect(audit(2, 1).openingRepeats).toBe(0)  // game 3 is outside
  })

  it('F2.3 — at three courts the window runs to game 6', () => {
    expect(audit(4, 3).openingRepeats).toBe(1)  // games 1 & 5
    expect(audit(5, 3).openingRepeats).toBe(1)  // games 1 & 6
  })

  it('F2.4 — a wider gap inside the window always costs less', () => {
    // With 14-15 players a repeat is forced, so the penalty has to RANK them:
    // game 1 -> 4 must beat game 1 -> 3, or the optimiser may pick the worse one.
    expect(audit(3, 2).score).toBeGreaterThan(audit(2, 2).score)
    expect(audit(4, 2).score).toBeGreaterThan(audit(3, 2).score)
  })

  it('F2.5 — the cost is penalty x games short of the window limit', () => {
    const off = { ...W, openingRepeatPenalty: 0 }
    // gap 3 of a 4-game window is 1 short; gap 2 is 2 short.
    expect(audit(3, 2, off).score - audit(3, 2).score).toBe(W.openingRepeatPenalty * 1)
    expect(audit(2, 2, off).score - audit(2, 2).score).toBe(W.openingRepeatPenalty * 2)
  })

  it('F2.6 — it outweighs the Clean Start bonus it has to fight', () => {
    // The general rest target is court-blind, so at ideal rest 2 a gap of 3 still
    // collects earlyRestReward. The penalty must exceed it or the pairing stays
    // profitable and nothing changes.
    const off = audit(3, 2, { ...W, openingRepeatPenalty: 0 })
    expect(off.earlyRestClean).toBe(1)                       // +300 still paid
    expect(audit(3, 2).score).toBeLessThan(off.score - W.earlyRestReward)
  })

  it('F2.7 — counted even when the weight is switched off', () => {
    // A disabled weight must not be able to make the audit read zero.
    const off = audit(3, 2, { ...W, openingRepeatPenalty: 0 })
    expect(off.openingRepeats).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// F3 — generated schedules
// ---------------------------------------------------------------------------

describe('First on court — generated schedules', () => {
  it('F3.1 — 15 players on 2 courts reach the forced floor of 1', () => {
    // Games 1-4 hold 16 seats against 15 players, so exactly one repeat is
    // unavoidable. Best of a few runs, since the annealer varies.
    const runs = Array.from({ length: 5 }, () => generateScheduleOptimized(FIFTEEN, {
      numMatches: 15, courtCount: 2, disableGenderRules: true,
      numTrials: 400, numStarts: 5,
    }))
    const best = Math.min(...runs.map((r) => r.audit.openingRepeats))
    expect(best).toBe(1)
  })

  it('F3.2 — the reported count matches the schedule it came with', () => {
    const { matches, audit: a } = generateScheduleOptimized(FIFTEEN, {
      numMatches: 15, courtCount: 2, disableGenderRules: true,
      numTrials: 400, numStarts: 3,
    })
    expect(a.openingRepeats).toBe(countOpeningRepeats(matches, 2))
  })

  it('F3.3 — the audit equals an independent re-score of the returned matches', () => {
    // generateScheduleOptimized re-scores the winner at the end to build the
    // audit the panel shows. That call is easy to leave court-blind while the
    // optimiser is court-aware, which reports zero over a schedule full of them.
    const levelMap = new Map(FIFTEEN.map((p) => [p.id, p.level ?? 5]))
    const ids = FIFTEEN.map((p) => p.id)
    const { matches, audit: a } = generateScheduleOptimized(FIFTEEN, {
      numMatches: 15, courtCount: 2, disableGenderRules: true,
      numTrials: 400, numStarts: 3,
    })
    const rescored = evaluateSessionScore(
      matches, levelMap, [], 1, W, 3, ids, true, 2, 4, 2,
    )
    expect(a.openingRepeats).toBe(rescored.openingRepeats)
    expect(a.score).toBe(rescored.score)
  })

  it('F3.4 — participation stays even with the rule on', () => {
    const { matches } = generateScheduleOptimized(FIFTEEN, {
      numMatches: 15, courtCount: 2, disableGenderRules: true,
      numTrials: 400, numStarts: 3,
    })
    const counts = new Map<string, number>()
    for (const m of matches) {
      for (const id of getPlayersInMatch(m)) counts.set(id, (counts.get(id) ?? 0) + 1)
    }
    expect(counts.size).toBe(15)
    const values = [...counts.values()]
    expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(1)
  })

  it('F3.5 — omitting courtCount behaves exactly like passing 1', () => {
    const matches = scheduleWithGap(2)
    const withOut = evaluateSessionScore(
      matches, uniformLevels(matches), [], 1, W, 3, undefined, true, 2, 20,
    )
    const withOne = evaluateSessionScore(
      matches, uniformLevels(matches), [], 1, W, 3, undefined, true, 2, 20, 1,
    )
    expect(withOut.score).toBe(withOne.score)
  })
})
