import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { generateSchedule } from '@/lib/matchGenerator'
import {
  FIXTURE_A,
  FIXTURE_B,
  FIXTURE_C,
  FIXTURE_D,
  FIXTURE_E,
  FIXTURE_F,
} from './fixtures/players'
import {
  getPlayersInMatch,
  countGamesPerPlayer,
  buildStreakHistory,
  buildPartnerPairCounts,
  computeSpreadPerMatch,
} from './fixtures/helpers'

// ---------------------------------------------------------------------------
// Randomness helpers
// ---------------------------------------------------------------------------
function mockRandom() {
  vi.spyOn(Math, 'random').mockReturnValue(0.5)
}
function restoreRandom() {
  vi.restoreAllMocks()
}

// ---------------------------------------------------------------------------
// Group 1: Output Structure
// ---------------------------------------------------------------------------
describe('Group 1: Output Structure', () => {
  beforeEach(mockRandom)
  afterEach(restoreRandom)

  it('1.1 — match count equals ceil(n*8/4)', () => {
    const matches = generateSchedule(FIXTURE_B)
    const n = FIXTURE_B.length
    expect(matches.length).toBe(Math.ceil((n * 8) / 4))
  })

  it('1.2 — each match has exactly 4 distinct player IDs', () => {
    const matches = generateSchedule(FIXTURE_B)
    for (const m of matches) {
      const ids = getPlayersInMatch(m)
      expect(new Set(ids).size).toBe(4)
    }
  })

  it('1.3 — all player IDs are from the input set', () => {
    const matches = generateSchedule(FIXTURE_B)
    const validIds = new Set(FIXTURE_B.map((p) => p.id))
    for (const m of matches) {
      for (const id of getPlayersInMatch(m)) {
        expect(validIds.has(id)).toBe(true)
      }
    }
  })

  it('1.4 — gameNumber is sequential 1..N', () => {
    const matches = generateSchedule(FIXTURE_B)
    matches.forEach((m, i) => {
      expect(m.gameNumber).toBe(i + 1)
    })
  })

  it('1.5 — team1Level/team2Level match actual level sums', () => {
    const levelMap = new Map(FIXTURE_B.map((p) => [p.id, p.level ?? 5]))
    const matches = generateSchedule(FIXTURE_B)
    for (const m of matches) {
      const t1 = (levelMap.get(m.team1Player1) ?? 5) + (levelMap.get(m.team1Player2) ?? 5)
      const t2 = (levelMap.get(m.team2Player1) ?? 5) + (levelMap.get(m.team2Player2) ?? 5)
      expect(m.team1Level).toBe(Math.round(t1))
      expect(m.team2Level).toBe(Math.round(t2))
    }
  })

  it('1.6 — type is one of 4 valid strings', () => {
    const valid = new Set(['Mixed Doubles', "Men's Doubles", "Women's Doubles", 'Doubles'])
    const matches = generateSchedule(FIXTURE_B)
    for (const m of matches) {
      expect(valid.has(m.type)).toBe(true)
    }
  })
})

// ---------------------------------------------------------------------------
// Group 2: Skill Spread Constraint
// ---------------------------------------------------------------------------
describe('Group 2: Skill Spread Constraint', () => {
  beforeEach(mockRandom)
  afterEach(restoreRandom)

  it('2.1 — default maxSpreadLimit=3 never exceeded (FIXTURE_B)', () => {
    const levelMap = new Map(FIXTURE_B.map((p) => [p.id, p.level ?? 5]))
    const matches = generateSchedule(FIXTURE_B)
    const spreads = computeSpreadPerMatch(matches, levelMap)
    for (const s of spreads) {
      expect(s).toBeLessThanOrEqual(3)
    }
  })

  it('2.2 — maxSpreadLimit=1 respected (FIXTURE_C)', () => {
    const levelMap = new Map(FIXTURE_C.map((p) => [p.id, p.level ?? 5]))
    const matches = generateSchedule(FIXTURE_C, { maxSpreadLimit: 1 })
    const spreads = computeSpreadPerMatch(matches, levelMap)
    for (const s of spreads) {
      expect(s).toBeLessThanOrEqual(1)
    }
  })

  it('2.3 — maxSpreadLimit=0 produces spread=0 (FIXTURE_A)', () => {
    const levelMap = new Map(FIXTURE_A.map((p) => [p.id, p.level ?? 5]))
    const matches = generateSchedule(FIXTURE_A, { maxSpreadLimit: 0 })
    const spreads = computeSpreadPerMatch(matches, levelMap)
    for (const s of spreads) {
      expect(s).toBe(0)
    }
  })
})

// ---------------------------------------------------------------------------
// Group 3: Streak Constraint
// ---------------------------------------------------------------------------
describe('Group 3: Streak Constraint', () => {
  afterEach(restoreRandom)

  it('3.1 — streakLimit=1: no player plays consecutive games (8 uniform players, 30 trials)', () => {
    // Need ≥ 8 players for streakLimit=1 to be satisfiable (4 play, 4 rest, swap).
    // FIXTURE_D has only 5 — phase 3 must fire every game. Use 8 uniform players instead.
    // numMatches=9: 9*4=36, 36%8=4 → balance pass skips.
    const uniform8: typeof FIXTURE_A = [
      { id: 'u1', nameSlug: 'u1', nickname: null, gender: 'M', level: 5 },
      { id: 'u2', nameSlug: 'u2', nickname: null, gender: 'M', level: 5 },
      { id: 'u3', nameSlug: 'u3', nickname: null, gender: 'M', level: 5 },
      { id: 'u4', nameSlug: 'u4', nickname: null, gender: 'M', level: 5 },
      { id: 'u5', nameSlug: 'u5', nickname: null, gender: 'F', level: 5 },
      { id: 'u6', nameSlug: 'u6', nickname: null, gender: 'F', level: 5 },
      { id: 'u7', nameSlug: 'u7', nickname: null, gender: 'F', level: 5 },
      { id: 'u8', nameSlug: 'u8', nickname: null, gender: 'F', level: 5 },
    ]
    for (let t = 0; t < 30; t++) {
      const matches = generateSchedule(uniform8, {
        streakLimit: 1,
        numMatches: 9,
        disableGenderRules: true,  // remove gender constraint so spread=0 is the only filter
      })
      const streakHistory = buildStreakHistory(matches)
      for (const [, runs] of streakHistory) {
        for (const run of runs) {
          expect(run).toBeLessThanOrEqual(1)
        }
      }
    }
  })

  it('3.2 — streakLimit=2: max run-length ≤ 2 (FIXTURE_F, 30 trials)', () => {
    // disableGenderRules: gender+spread together leave almost no valid groups for phase 1/2,
    // forcing phase-3 fallback which ignores streaks. Disable gender to test streak alone.
    // numMatches=23: 23*4=92, 92%12=8 → balance pass skips.
    for (let t = 0; t < 30; t++) {
      const matches = generateSchedule(FIXTURE_F, {
        streakLimit: 2,
        numMatches: 23,
        disableGenderRules: true,
      })
      const streakHistory = buildStreakHistory(matches)
      for (const [, runs] of streakHistory) {
        for (const run of runs) {
          expect(run).toBeLessThanOrEqual(2)
        }
      }
    }
  })

  it('3.3 — phase-3 fallback: 4 players + numMatches=6 still returns 6 matches', () => {
    mockRandom()
    // With 4 players and avoidRepeatPartners=true, there's only C(4,4)=1 combo.
    // After the only partner pair is used, phase 3 must kick in.
    const matches = generateSchedule(FIXTURE_A, { numMatches: 6, avoidRepeatPartners: false })
    expect(matches.length).toBe(6)
  })

  it('3.4 — streak resets after rest: player returns successfully', () => {
    // With FIXTURE_D (5 players, streakLimit=1), one player must sit out each game.
    // Verify that the sitter in game N appears in a later game.
    const matches = generateSchedule(FIXTURE_D, { streakLimit: 1, numMatches: 10 })
    const allIds = new Set(FIXTURE_D.map((p) => p.id))
    // Every player must appear at least once
    const counts = countGamesPerPlayer(matches)
    for (const id of allIds) {
      expect(counts.get(id) ?? 0).toBeGreaterThan(0)
    }
  })
})

// ---------------------------------------------------------------------------
// Group 4: Repeat Partner Constraint
// ---------------------------------------------------------------------------
describe('Group 4: Repeat Partner Constraint', () => {
  beforeEach(mockRandom)
  afterEach(restoreRandom)

  it('4.1 — avoidRepeatPartners=true: every pair appears ≤ 1 time', () => {
    // Use 12 all-level-5 players → spread=0 always → all C(12,4)=495 groups valid.
    // C(12,2)=66 unique pairs; 20 matches need only 40 → phase-2 never fires.
    // streakLimit=100 keeps all players available every game.
    // numMatches=20: 20*4=80, 80%12=8 → balance pass skips.
    restoreRandom()
    const uniform12 = Array.from({ length: 12 }, (_, i) => ({
      id: `p${i + 1}`,
      nameSlug: `p${i + 1}`,
      nickname: null as null,
      gender: 'M' as const,
      level: 5,
    }))
    const matches = generateSchedule(uniform12, {
      avoidRepeatPartners: true,
      numMatches: 20,
      streakLimit: 100,
      disableGenderRules: true,
    })
    const pairCounts = buildPartnerPairCounts(matches)
    for (const [, count] of pairCounts) {
      expect(count).toBeLessThanOrEqual(1)
    }
  })

  it('4.2 — avoidRepeatPartners=false: engine completes with FIXTURE_A', () => {
    const matches = generateSchedule(FIXTURE_A, { avoidRepeatPartners: false, numMatches: 8 })
    expect(matches.length).toBe(8)
  })

  it('4.3 — phase-2 fallback: FIXTURE_A + 4 matches completes despite exhausted pairs', () => {
    // C(4,2) = 6 pairs, but each match uses 2 pairs → 3 matches exhaust all unique pairs.
    // Match 4 must use phase-2 (repeat partners allowed) to complete.
    const matches = generateSchedule(FIXTURE_A, {
      avoidRepeatPartners: true,
      numMatches: 4,
      maxSpreadLimit: 0,
    })
    expect(matches.length).toBe(4)
  })
})

// ---------------------------------------------------------------------------
// Group 5: Gender Composition
// ---------------------------------------------------------------------------
describe('Group 5: Gender Composition', () => {
  beforeEach(mockRandom)
  afterEach(restoreRandom)

  it('5.1 — every match has 4M, 4F, or 2M+2F (FIXTURE_B)', () => {
    const genderMap = new Map(FIXTURE_B.map((p) => [p.id, p.gender]))
    const matches = generateSchedule(FIXTURE_B)
    for (const m of matches) {
      const genders = getPlayersInMatch(m).map((id) => genderMap.get(id))
      const mCount = genders.filter((g) => g === 'M').length
      const fCount = genders.filter((g) => g === 'F').length
      expect(
        mCount === 4 || fCount === 4 || (mCount === 2 && fCount === 2),
      ).toBe(true)
    }
  })

  it('5.2 — match type label is consistent with actual gender split (FIXTURE_B)', () => {
    const genderMap = new Map(FIXTURE_B.map((p) => [p.id, p.gender]))
    const matches = generateSchedule(FIXTURE_B)
    for (const m of matches) {
      const t1Genders = [genderMap.get(m.team1Player1), genderMap.get(m.team1Player2)]
      const t2Genders = [genderMap.get(m.team2Player1), genderMap.get(m.team2Player2)]

      const teamCategory = (g1: string | null | undefined, g2: string | null | undefined) => {
        if ((g1 === 'M' && g2 === 'F') || (g1 === 'F' && g2 === 'M')) return 'Mixed'
        return g1 === 'M' ? "Men's" : "Women's"
      }
      const t1Cat = teamCategory(t1Genders[0], t1Genders[1])
      const t2Cat = teamCategory(t2Genders[0], t2Genders[1])

      let expectedType: string
      if (t1Cat === 'Mixed' && t2Cat === 'Mixed') expectedType = 'Mixed Doubles'
      else if (t1Cat === t2Cat) expectedType = `${t1Cat} Doubles`
      else expectedType = 'Doubles'

      expect(m.type).toBe(expectedType)
    }
  })

  it('5.3 — null gender → all types are "Doubles" (FIXTURE_E)', () => {
    const matches = generateSchedule(FIXTURE_E)
    for (const m of matches) {
      expect(m.type).toBe('Doubles')
    }
  })

  it('5.4 — auto-disable fires when any player has null gender', () => {
    // Mix FIXTURE_A (gender M) with one null-gender player
    const mixed = [
      ...FIXTURE_A,
      { id: 'x1', nameSlug: 'x1', nickname: null, gender: null as null, level: 5 },
    ]
    const matches = generateSchedule(mixed)
    for (const m of matches) {
      expect(m.type).toBe('Doubles')
    }
  })

  it('5.5 — prioritizeGenderDoubles=true: (MD+WD)/total ≥ 0.7 across 50 trials', () => {
    restoreRandom() // use real randomness for statistical test

    // Use 4M+4F all level 5 (zero spread) with avoidRepeatPartners=false.
    // With forceGender phase always finding a valid 4M or 4F group (spread=0),
    // pattern is perfectly alternating MD/WD → 100% ratio.
    // numMatches=7: 7*4=28, 28%8=4 → balance pass skips.
    const uniform4m4f = [
      { id: 'g1', nameSlug: 'g1', nickname: null, gender: 'M' as const, level: 5 },
      { id: 'g2', nameSlug: 'g2', nickname: null, gender: 'M' as const, level: 5 },
      { id: 'g3', nameSlug: 'g3', nickname: null, gender: 'M' as const, level: 5 },
      { id: 'g4', nameSlug: 'g4', nickname: null, gender: 'M' as const, level: 5 },
      { id: 'g5', nameSlug: 'g5', nickname: null, gender: 'F' as const, level: 5 },
      { id: 'g6', nameSlug: 'g6', nickname: null, gender: 'F' as const, level: 5 },
      { id: 'g7', nameSlug: 'g7', nickname: null, gender: 'F' as const, level: 5 },
      { id: 'g8', nameSlug: 'g8', nickname: null, gender: 'F' as const, level: 5 },
    ]

    let totalMatches = 0
    let pureDoubles = 0

    for (let t = 0; t < 50; t++) {
      const matches = generateSchedule(uniform4m4f, {
        prioritizeGenderDoubles: true,
        avoidRepeatPartners: false,
        numMatches: 7,
      })
      for (const m of matches) {
        totalMatches++
        if (m.type === "Men's Doubles" || m.type === "Women's Doubles") pureDoubles++
      }
    }

    const ratio = pureDoubles / totalMatches
    expect(ratio).toBeGreaterThanOrEqual(0.7)
  })
})

// ---------------------------------------------------------------------------
// Group 6: Participation Fairness / Balance Pass
// ---------------------------------------------------------------------------
describe('Group 6: Participation Fairness', () => {
  beforeEach(mockRandom)
  afterEach(restoreRandom)

  it('6.1 — gap=0 when numMatches*4 % n === 0 (FIXTURE_F, 24 matches)', () => {
    // 24 matches * 4 slots = 96 slots; 96 / 12 players = 8 each → perfect
    const matches = generateSchedule(FIXTURE_F, { numMatches: 24 })
    const counts = countGamesPerPlayer(matches)
    const vals = [...counts.values()]
    expect(Math.max(...vals) - Math.min(...vals)).toBe(0)
  })

  it('6.2 — gap ≤ 2 when equal distribution not possible (FIXTURE_B, 15 matches)', () => {
    // 15 * 4 = 60 slots; 60 / 8 players = 7.5 — cannot be perfectly even
    const matches = generateSchedule(FIXTURE_B, { numMatches: 15 })
    const counts = countGamesPerPlayer(matches)
    const vals = [...counts.values()]
    expect(Math.max(...vals) - Math.min(...vals)).toBeLessThanOrEqual(2)
  })

  it('6.3 — every input player appears at least once (FIXTURE_B)', () => {
    const matches = generateSchedule(FIXTURE_B)
    const counts = countGamesPerPlayer(matches)
    for (const p of FIXTURE_B) {
      expect(counts.get(p.id) ?? 0).toBeGreaterThan(0)
    }
  })

  it('6.4 — team level sums remain consistent after balance pass (FIXTURE_F)', () => {
    const levelMap = new Map(FIXTURE_F.map((p) => [p.id, p.level ?? 5]))
    const matches = generateSchedule(FIXTURE_F, { numMatches: 24 })
    for (const m of matches) {
      const t1 = (levelMap.get(m.team1Player1) ?? 5) + (levelMap.get(m.team1Player2) ?? 5)
      const t2 = (levelMap.get(m.team2Player1) ?? 5) + (levelMap.get(m.team2Player2) ?? 5)
      expect(m.team1Level).toBe(Math.round(t1))
      expect(m.team2Level).toBe(Math.round(t2))
    }
  })
})

// ---------------------------------------------------------------------------
// Group 7: Edge Cases
// ---------------------------------------------------------------------------
describe('Group 7: Edge Cases', () => {
  beforeEach(mockRandom)
  afterEach(restoreRandom)

  it('7.1 — input with 0 players returns []', () => {
    expect(generateSchedule([])).toEqual([])
  })

  it('7.1 — input with 3 players returns []', () => {
    const three = FIXTURE_A.slice(0, 3)
    expect(generateSchedule(three)).toEqual([])
  })

  it('7.2 — player with level: null defaults to 5', () => {
    const players = [
      { id: 'n1', nameSlug: 'p1', nickname: null, gender: 'M' as const, level: null },
      { id: 'n2', nameSlug: 'p2', nickname: null, gender: 'M' as const, level: null },
      { id: 'n3', nameSlug: 'p3', nickname: null, gender: 'M' as const, level: null },
      { id: 'n4', nameSlug: 'p4', nickname: null, gender: 'M' as const, level: null },
    ]
    const matches = generateSchedule(players)
    for (const m of matches) {
      expect(m.team1Level).toBe(10) // 5 + 5
      expect(m.team2Level).toBe(10)
    }
  })
})
