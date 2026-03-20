import { describe, it, expect } from 'vitest'
import { evaluateSessionScore, DEFAULT_WEIGHTS } from '@/lib/matchGenerator'
import type { GeneratedMatch, ScoreWeights } from '@/lib/matchGenerator'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const W = DEFAULT_WEIGHTS

function makeMatch(
  gameNumber: number,
  p1: string, p2: string, p3: string, p4: string,
  t1Level = 10, t2Level = 10,
): GeneratedMatch {
  return {
    gameNumber,
    team1Player1: p1,
    team1Player2: p2,
    team2Player1: p3,
    team2Player2: p4,
    type: 'Doubles',
    team1Level: t1Level,
    team2Level: t2Level,
  }
}

const levelMap = new Map<string, number>([
  ['a', 5], ['b', 5], ['c', 5], ['d', 5],
  ['e', 5], ['f', 5], ['g', 5], ['h', 5],
  ['hi', 9], ['lo', 1],  // wide spread helpers
])

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('Scoring: evaluateSessionScore', () => {
  it('S1 — perfect match (no violations) → score=10000', () => {
    // Two matches, 8 distinct players, no repeats, no streak, no imbalance, no spread
    const matches = [
      makeMatch(1, 'a', 'b', 'c', 'd'),
      makeMatch(2, 'e', 'f', 'g', 'h'),
    ]
    const lm = new Map([...levelMap])
    const result = evaluateSessionScore(matches, lm, [], 1, W, 3)
    expect(result.score).toBe(10000)
    expect(result.streakViolations).toBe(0)
    expect(result.repeatPartners).toBe(0)
    expect(result.wideGaps).toBe(0)
    expect(result.participationGap).toBe(0)
  })

  it('S2 — streak violation → 10000 - violations * streakWeight', () => {
    // Same 4 players, 2 consecutive games using different splits → no repeat partners
    // Game 1: a+b vs c+d (pairs: a|b, c|d)
    // Game 2: a+c vs b+d (pairs: a|c, b|d) — all new pairs, no repeat partner penalty
    // streakLimit=1: game 2 streak=2 for each of a,b,c,d → 4 violations
    const matches = [
      makeMatch(1, 'a', 'b', 'c', 'd'),
      makeMatch(2, 'a', 'c', 'b', 'd'),
    ]
    const result = evaluateSessionScore(matches, levelMap, [], 1, W, 3)
    expect(result.streakViolations).toBe(4)
    expect(result.repeatPartners).toBe(0)
    expect(result.score).toBe(10000 - 4 * W.streakWeight)
  })

  it('S3 — repeat partner → exactly 1 repeat', () => {
    // Match 3 reuses only pair a|b from match 1; pair e|g is new
    const matches = [
      makeMatch(1, 'a', 'b', 'c', 'd'),
      makeMatch(2, 'e', 'f', 'g', 'h'),
      makeMatch(3, 'a', 'b', 'e', 'g'),  // a|b repeats (1), e|g is new
    ]
    const result = evaluateSessionScore(matches, levelMap, [], 1, W, 3)
    expect(result.repeatPartners).toBe(1)
    expect(result.score).toBeLessThan(10000)
  })

  it('S4 — wide skill gap → 10000 - wideGaps * spreadPenalty', () => {
    // hi=9, lo=1 → spread=8, limit=3 → 1 wide gap
    const lm = new Map([['hi', 9], ['lo', 1], ['a', 5], ['b', 5]])
    const matches = [
      makeMatch(1, 'hi', 'a', 'lo', 'b', 14, 6),
    ]
    const result = evaluateSessionScore(matches, lm, [], 1, W, 3)
    expect(result.wideGaps).toBe(1)
    expect(result.score).toBe(10000 - W.spreadPenalty - Math.abs(14 - 6) * W.imbalancePenalty)
  })

  it('S5 — level imbalance penalty → 10000 - diffSum * imbalancePenalty', () => {
    // team1Level=12, team2Level=8 → diff=4
    const lm = new Map([['a', 7], ['b', 5], ['c', 4], ['d', 4]])
    const matches = [
      makeMatch(1, 'a', 'b', 'c', 'd', 12, 8),
    ]
    const result = evaluateSessionScore(matches, lm, [], 1, W, 3)
    expect(result.levelGaps).toBe(4)
    expect(result.score).toBe(10000 - 4 * W.imbalancePenalty)
  })

  it('S6 — participation gap → 10000 - gap * fairnessWeight', () => {
    // a,b,c,d each appear twice; e,f,g,h appear once → gap=1
    const matches = [
      makeMatch(1, 'a', 'b', 'c', 'd'),
      makeMatch(2, 'a', 'b', 'c', 'd'),
      makeMatch(3, 'e', 'f', 'g', 'h'),
    ]
    const result = evaluateSessionScore(matches, levelMap, [], 1, W, 3)
    expect(result.participationGap).toBe(1)
    // streakViolations in game 2 also fire, but participation penalty is what we're checking
    expect(result.score).toBeLessThan(10000 - 1 * W.fairnessWeight)
  })

  it('S7 — wishlist reward → 10000 + wishes * wishlistReward', () => {
    const matches = [
      makeMatch(1, 'a', 'b', 'c', 'd'),
      makeMatch(2, 'e', 'f', 'g', 'h'),
    ]
    const result = evaluateSessionScore(matches, levelMap, [['a', 'b']], 1, W, 3)
    expect(result.wishesGranted).toBe(1)
    expect(result.score).toBe(10000 + W.wishlistReward)
  })

  it('S8 — combined stacking: score arithmetic is additive', () => {
    // 1 wishlist grant, 1 wide gap, 1 imbalance
    const lm = new Map([['hi', 9], ['lo', 1], ['a', 5], ['b', 5]])
    // spread = 9-1 = 8 > 3 → 1 wideGap; team sums: hi+a=14, lo+b=6 → diff=8
    const matches = [
      makeMatch(1, 'hi', 'a', 'lo', 'b', 14, 6),
    ]
    const result = evaluateSessionScore(matches, lm, [['hi', 'a']], 1, W, 3)
    const expected =
      10000
      - W.spreadPenalty        // 1 wide gap
      - 8 * W.imbalancePenalty // team diff = 8
      + W.wishlistReward       // 1 wish granted
    expect(result.score).toBe(expected)
  })

  it('S9 — spread boundary: spread==limit → no penalty; spread==limit+1 → penalty', () => {
    const lm = new Map([['a', 5], ['b', 5], ['c', 8], ['d', 5]])
    // spread=3 (8-5), limit=3 → no wide gap
    const matchAtLimit = [makeMatch(1, 'a', 'b', 'c', 'd', 10, 13)]
    const r1 = evaluateSessionScore(matchAtLimit, lm, [], 1, W, 3)
    expect(r1.wideGaps).toBe(0)

    // spread=4 (9-5), limit=3 → 1 wide gap
    const lm2 = new Map([['a', 5], ['b', 5], ['c', 9], ['d', 5]])
    const matchOverLimit = [makeMatch(1, 'a', 'b', 'c', 'd', 10, 14)]
    const r2 = evaluateSessionScore(matchOverLimit, lm2, [], 1, W, 3)
    expect(r2.wideGaps).toBe(1)
  })
})
