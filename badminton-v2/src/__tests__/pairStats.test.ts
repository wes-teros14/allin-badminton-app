import { describe, it, expect, vi } from 'vitest'
import { DEFAULT_MIN_GAMES_TOGETHER, pairKey, rankPairs, tallyPairs } from '@/lib/pairStats'
import type { PairTally, PairTallyMatch } from '@/lib/pairStats'

// pairStats reuses sortMatchResults, and matchResults.ts constructs the Supabase
// client at module scope for submitSplitResult. Same stub matchResults.test.ts uses.
vi.mock('@/lib/supabase', () => ({ supabase: { from: vi.fn() } }))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const A = 'aaaaaaaa-0000-0000-0000-000000000001'
const B = 'bbbbbbbb-0000-0000-0000-000000000002'
const C = 'cccccccc-0000-0000-0000-000000000003'
const D = 'dddddddd-0000-0000-0000-000000000004'

/** A match with the four slots filled and the given result rows. */
function match(
  slots: [string, string, string, string],
  results: Array<{ winning_pair_index: number; game_number?: number | null }> | null | undefined,
): PairTallyMatch {
  return {
    team1_player1_id: slots[0],
    team1_player2_id: slots[1],
    team2_player1_id: slots[2],
    team2_player2_id: slots[3],
    match_results: results,
  }
}

/** Team 1 = (A,B), team 2 = (C,D). */
function standard(
  results: Array<{ winning_pair_index: number; game_number?: number | null }> | null | undefined,
): PairTallyMatch {
  return match([A, B, C, D], results)
}

const team1Won = [{ winning_pair_index: 1, game_number: 1 }]
const team2Won = [{ winning_pair_index: 2, game_number: 1 }]

// ---------------------------------------------------------------------------
// pairKey — FR-004
// ---------------------------------------------------------------------------
describe('pairKey', () => {
  it('is order-independent: the same two players give one key either way round', () => {
    expect(pairKey(A, B)).toBe(pairKey(B, A))
  })

  it('is stable across calls', () => {
    expect(pairKey(A, B)).toBe(pairKey(A, B))
  })

  it('distinguishes different partnerships', () => {
    expect(pairKey(A, B)).not.toBe(pairKey(A, C))
    expect(pairKey(A, B)).not.toBe(pairKey(C, D))
  })
})

// ---------------------------------------------------------------------------
// tallyPairs — counting rules
// ---------------------------------------------------------------------------
describe('tallyPairs', () => {
  it('tallies both sides of a match: winners gain a win, losers gain a loss (FR-005, FR-008)', () => {
    const tallies = tallyPairs([standard(team1Won)])

    const winners = tallies.get(pairKey(A, B))
    const losers = tallies.get(pairKey(C, D))

    expect(winners).toMatchObject({ wins: 1, losses: 0, games: 1 })
    expect(losers).toMatchObject({ wins: 0, losses: 1, games: 1 })
  })

  it('reads winning_pair_index 2 as team 2 winning', () => {
    const tallies = tallyPairs([standard(team2Won)])

    expect(tallies.get(pairKey(A, B))).toMatchObject({ wins: 0, losses: 1, games: 1 })
    expect(tallies.get(pairKey(C, D))).toMatchObject({ wins: 1, losses: 0, games: 1 })
  })

  it('counts per recorded game, so a split 1-1 gives each pair 1W 1L (SC-005, FR-007)', () => {
    const split = standard([
      { winning_pair_index: 1, game_number: 1 },
      { winning_pair_index: 2, game_number: 2 },
    ])

    const tallies = tallyPairs([split])

    expect(tallies.get(pairKey(A, B))).toMatchObject({ wins: 1, losses: 1, games: 2 })
    expect(tallies.get(pairKey(C, D))).toMatchObject({ wins: 1, losses: 1, games: 2 })
  })

  it('counts a 2-0 split as two wins for one pair and two losses for the other', () => {
    const sweep = standard([
      { winning_pair_index: 1, game_number: 1 },
      { winning_pair_index: 1, game_number: 2 },
    ])

    const tallies = tallyPairs([sweep])

    expect(tallies.get(pairKey(A, B))).toMatchObject({ wins: 2, losses: 0, games: 2 })
    expect(tallies.get(pairKey(C, D))).toMatchObject({ wins: 0, losses: 2, games: 2 })
  })

  it('collapses the same duo across slot orders into one entry (FR-004)', () => {
    const asTeam1 = match([A, B, C, D], team1Won)
    const asTeam2 = match([C, D, B, A], team2Won) // (B,A) in team 2 slots, and they won

    const tallies = tallyPairs([asTeam1, asTeam2])

    expect(tallies.size).toBe(2)
    expect(tallies.get(pairKey(A, B))).toMatchObject({ wins: 2, losses: 0, games: 2 })
  })

  it('ignores matches with no recorded result (FR-009)', () => {
    expect(tallyPairs([standard([])]).size).toBe(0)
    expect(tallyPairs([standard(null)]).size).toBe(0)
    expect(tallyPairs([standard(undefined)]).size).toBe(0)
  })

  it('treats a missing game_number the same way the other stats surfaces do', () => {
    const tallies = tallyPairs([standard([{ winning_pair_index: 1 }])])

    expect(tallies.get(pairKey(A, B))).toMatchObject({ wins: 1, games: 1 })
  })

  it('skips a self-pair but still tallies the valid opposing pair (research R5)', () => {
    // A legacy row from before migration 079 — team 1 holds the same player twice.
    const malformed = match([A, A, C, D], team2Won)

    const tallies = tallyPairs([malformed])

    expect(tallies.get(pairKey(A, A))).toBeUndefined()
    expect([...tallies.values()].some((t) => t.playerA === t.playerB)).toBe(false)
    expect(tallies.get(pairKey(C, D))).toMatchObject({ wins: 1, losses: 0, games: 1 })
  })

  it('holds its invariants over a mixed set of matches', () => {
    const tallies = tallyPairs([
      standard(team1Won),
      standard(team2Won),
      match([A, C, B, D], team1Won),
      match([A, A, C, D], team1Won),
      standard([]),
    ])

    for (const tally of tallies.values()) {
      expect(tally.playerA).not.toBe(tally.playerB)
      expect(tally.games).toBeGreaterThan(0)
      expect(tally.wins + tally.losses).toBe(tally.games)
    }
  })

  it('is deterministic: the same input tallies identically twice', () => {
    const input = [standard(team1Won), match([A, C, B, D], team2Won)]

    expect([...tallyPairs(input).entries()]).toEqual([...tallyPairs(input).entries()])
  })
})

// ---------------------------------------------------------------------------
// rankPairs — eligibility, ordering, presentation
// ---------------------------------------------------------------------------

/** A tally built directly, so ranking can be tested without match fixtures. */
function tally(playerA: string, playerB: string, wins: number, losses: number): PairTally {
  const [low, high] = playerA < playerB ? [playerA, playerB] : [playerB, playerA]
  return { key: pairKey(low, high), playerA: low, playerB: high, wins, losses, games: wins + losses }
}

describe('rankPairs ordering', () => {
  it('ranks by win rate descending (FR-015)', () => {
    const ranked = rankPairs([tally(A, B, 4, 4), tally(C, D, 7, 1)])

    expect(ranked.map((r) => r.key)).toEqual([pairKey(C, D), pairKey(A, B)])
  })

  it('breaks a win-rate tie on wins descending (FR-015)', () => {
    // Both 100%, but one has played more.
    const ranked = rankPairs([tally(A, B, 6, 0), tally(C, D, 9, 0)])

    expect(ranked[0].key).toBe(pairKey(C, D))
    expect(ranked[1].key).toBe(pairKey(A, B))
  })

  it('breaks a full tie on the pair key, so order never depends on input order (FR-016)', () => {
    const first = rankPairs([tally(A, B, 6, 2), tally(C, D, 6, 2)])
    const reversed = rankPairs([tally(C, D, 6, 2), tally(A, B, 6, 2)])

    expect(first.map((r) => r.key)).toEqual(reversed.map((r) => r.key))
  })

  it('is deterministic across repeated calls on identical input (FR-016)', () => {
    const input = [tally(A, B, 6, 1), tally(C, D, 6, 1), tally(A, C, 8, 4)]

    expect(rankPairs(input)).toEqual(rankPairs(input))
  })

  it('accepts the Map that tallyPairs returns, and ranks the losing pair too', () => {
    // Six identical matches: (A,B) win all six, (C,D) lose all six. Both reach
    // the games floor, and a losing record does not disqualify — it ranks last.
    const tallies = tallyPairs(Array.from({ length: 6 }, () => standard(team1Won)))

    const ranked = rankPairs(tallies)

    expect(ranked).toHaveLength(2)
    expect(ranked[0]).toMatchObject({ key: pairKey(A, B), wins: 6, losses: 0, winRate: 100 })
    expect(ranked[1]).toMatchObject({ key: pairKey(C, D), wins: 0, losses: 6, winRate: 0 })
  })
})

describe('rankPairs presentation', () => {
  it('rounds win rate the same way the player board does (FR-010)', () => {
    const ranked = rankPairs([tally(A, B, 9, 0), tally(C, D, 5, 2)])

    expect(ranked.find((r) => r.key === pairKey(A, B))?.winRate).toBe(100)
    // 5/7 = 71.43% -> 71
    expect(ranked.find((r) => r.key === pairKey(C, D))?.winRate).toBe(71)
  })

  it('yields 0 rather than NaN for a zero-game tally (research R9)', () => {
    const ranked = rankPairs([tally(A, B, 0, 0)], { minGames: 0 })

    expect(ranked[0].winRate).toBe(0)
    expect(Number.isNaN(ranked[0].winRate)).toBe(false)
  })

  it('returns at most the limit (FR-017)', () => {
    const many = Array.from({ length: 25 }, (_, i) => tally(`p${i}`, `q${i}`, 6 + i, 1))

    expect(rankPairs(many)).toHaveLength(10)
    expect(rankPairs(many, { limit: 3 })).toHaveLength(3)
  })

  it('carries wins, losses and games through unchanged', () => {
    const ranked = rankPairs([tally(A, B, 7, 2)])

    expect(ranked[0]).toMatchObject({ wins: 7, losses: 2, games: 9 })
  })
})

describe('rankPairs eligibility', () => {
  it('excludes a pair below the games floor and admits one that meets it (FR-012)', () => {
    const below = tally(A, B, 2, 0) // 100%, but only 2 games together
    const meets = tally(C, D, 2, 1) // 67% over 3 games

    const ranked = rankPairs([below, meets])

    expect(ranked.map((r) => r.key)).toEqual([pairKey(C, D)])
  })

  it('defaults the floor to DEFAULT_MIN_GAMES_TOGETHER', () => {
    const atFloor = tally(A, B, DEFAULT_MIN_GAMES_TOGETHER, 0)
    const belowFloor = tally(C, D, DEFAULT_MIN_GAMES_TOGETHER - 1, 0)

    const ranked = rankPairs([atFloor, belowFloor])

    expect(ranked.map((r) => r.key)).toEqual([pairKey(A, B)])
  })

  it('excludes a qualifying pair when either player is ineligible (FR-013, FR-014)', () => {
    const pair = tally(A, B, 5, 1)

    expect(rankPairs([pair], { isEligiblePlayer: () => true })).toHaveLength(1)
    expect(rankPairs([pair], { isEligiblePlayer: (id) => id !== A })).toHaveLength(0)
    expect(rankPairs([pair], { isEligiblePlayer: (id) => id !== B })).toHaveLength(0)
    expect(rankPairs([pair], { isEligiblePlayer: () => false })).toHaveLength(0)
  })

  it('keeps a pair only when BOTH players pass, across a mixed set', () => {
    const eligibleIds = new Set([A, B])
    const ranked = rankPairs(
      [tally(A, B, 4, 0), tally(A, C, 4, 0), tally(C, D, 4, 0)],
      { isEligiblePlayer: (id) => eligibleIds.has(id) },
    )

    expect(ranked.map((r) => r.key)).toEqual([pairKey(A, B)])
  })
})
