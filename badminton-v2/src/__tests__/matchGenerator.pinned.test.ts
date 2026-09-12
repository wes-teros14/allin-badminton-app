import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  generateSchedule,
  generateScheduleOptimized,
  type PlayerInput,
  type PinnedMatch,
} from '@/lib/matchGenerator'
import { countGamesPerPlayer, getPlayersInMatch } from './fixtures/helpers'

// 16 players, 20 matches — the standard session shape. Levels 3..6 so the
// default spread limit of 3 is always satisfiable.
const ROSTER: PlayerInput[] = Array.from({ length: 16 }, (_, i) => ({
  id: `p${i + 1}`,
  nameSlug: `player-${i + 1}`,
  nickname: null,
  gender: i % 2 === 0 ? 'M' : 'F',
  level: 3 + (i % 4),
}))

const PIN_1: PinnedMatch = { team1: ['p1', 'p2'], team2: ['p3', 'p4'] }
const PIN_2: PinnedMatch = { team1: ['p5', 'p6'], team2: ['p7', 'p8'] }

const FAST = { numStarts: 5, numTrials: 200, numMatches: 20 }

function mockRandom(seed = 42) {
  vi.spyOn(Math, 'random').mockImplementation(() => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed / 0x7fffffff
  })
}

function expectMatchEquals(actual: { team1Player1: string; team1Player2: string; team2Player1: string; team2Player2: string }, pin: PinnedMatch) {
  expect(actual.team1Player1).toBe(pin.team1[0])
  expect(actual.team1Player2).toBe(pin.team1[1])
  expect(actual.team2Player1).toBe(pin.team2[0])
  expect(actual.team2Player2).toBe(pin.team2[1])
}

describe('Pinned opening games', () => {
  beforeEach(() => mockRandom())
  afterEach(() => vi.restoreAllMocks())

  it('P1 — one pin becomes game 1, in the pinned team order', () => {
    const { matches } = generateScheduleOptimized(ROSTER, { ...FAST, pinnedMatches: [PIN_1] })
    expect(matches[0].gameNumber).toBe(1)
    expectMatchEquals(matches[0], PIN_1)
  })

  it('P2 — two pins occupy games 1 and 2; the rest are engine-filled', () => {
    const { matches } = generateScheduleOptimized(ROSTER, { ...FAST, pinnedMatches: [PIN_1, PIN_2] })
    expect(matches).toHaveLength(20)
    expectMatchEquals(matches[0], PIN_1)
    expectMatchEquals(matches[1], PIN_2)
    for (const m of matches.slice(2)) {
      expect(new Set(getPlayersInMatch(m)).size).toBe(4)
    }
  })

  it('P3 — pins never drift across many seeded runs', () => {
    for (let seed = 1; seed <= 20; seed++) {
      vi.restoreAllMocks()
      mockRandom(seed)
      const { matches } = generateScheduleOptimized(ROSTER, { ...FAST, pinnedMatches: [PIN_1, PIN_2] })
      expectMatchEquals(matches[0], PIN_1)
      expectMatchEquals(matches[1], PIN_2)
    }
  })

  it('P4 — participation stays fair with two pins (gap ≤ 1)', () => {
    const { matches } = generateScheduleOptimized(ROSTER, { ...FAST, pinnedMatches: [PIN_1, PIN_2] })
    const counts = [...countGamesPerPlayer(matches).values()]
    expect(counts).toHaveLength(16)
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1)
  })

  it('P5 — the engine rests pinned players in the very next game', () => {
    const { matches } = generateScheduleOptimized(ROSTER, {
      ...FAST, maxConsecutiveGames: 1, pinnedMatches: [PIN_1],
    })
    const game2 = new Set(getPlayersInMatch(matches[1]))
    for (const id of [...PIN_1.team1, ...PIN_1.team2]) {
      expect(game2.has(id)).toBe(false)
    }
  })

  it('P6 — rejects a pin that repeats a player', () => {
    expect(() =>
      generateScheduleOptimized(ROSTER, { ...FAST, pinnedMatches: [{ team1: ['p1', 'p1'], team2: ['p3', 'p4'] }] }),
    ).toThrow(/Pinned game 1 repeats a player/)
  })

  it('P6 — rejects a pin naming a player who is not in the session', () => {
    expect(() =>
      generateScheduleOptimized(ROSTER, { ...FAST, pinnedMatches: [{ team1: ['p1', 'p2'], team2: ['p3', 'ghost'] }] }),
    ).toThrow(/Pinned game 1 names a player who is not in this session/)
  })

  it('P6 — rejects more pins than matches', () => {
    expect(() =>
      generateScheduleOptimized(ROSTER, { ...FAST, numMatches: 1, pinnedMatches: [PIN_1, PIN_2] }),
    ).toThrow(/More pinned games \(2\) than matches \(1\)/)
  })

  it('P7 — empty and undefined pins behave like today', () => {
    const a = generateScheduleOptimized(ROSTER, { ...FAST, pinnedMatches: [] })
    const b = generateScheduleOptimized(ROSTER, { ...FAST })
    expect(a.matches).toHaveLength(20)
    expect(b.matches).toHaveLength(20)
    const single = generateSchedule(ROSTER, { numMatches: 20, pinnedMatches: [] })
    expect(single).toHaveLength(20)
  })

  it('P8 — a pinned split is kept even when formTeams would rebalance it', () => {
    const lopsided: PlayerInput[] = [
      { id: 's1', nameSlug: 's1', nickname: null, gender: 'M', level: 9 },
      { id: 's2', nameSlug: 's2', nickname: null, gender: 'M', level: 9 },
      { id: 'w1', nameSlug: 'w1', nickname: null, gender: 'M', level: 3 },
      { id: 'w2', nameSlug: 'w2', nickname: null, gender: 'M', level: 3 },
      ...ROSTER.slice(4),
    ]
    const pin: PinnedMatch = { team1: ['s1', 's2'], team2: ['w1', 'w2'] }
    const { matches } = generateScheduleOptimized(lopsided, { ...FAST, maxSpreadLimit: 9, pinnedMatches: [pin] })
    expectMatchEquals(matches[0], pin)
    expect(matches[0].team1Level).toBe(18)
    expect(matches[0].team2Level).toBe(6)
    expect(matches[0].type).toBe("Men's Doubles")
  })

  it('P8 — generateSchedule (single-pass) honours pins too', () => {
    const matches = generateSchedule(ROSTER, { numMatches: 20, pinnedMatches: [PIN_1, PIN_2] })
    expectMatchEquals(matches[0], PIN_1)
    expectMatchEquals(matches[1], PIN_2)
  })
})
