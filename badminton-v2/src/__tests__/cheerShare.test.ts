import { describe, expect, it } from 'vitest'
import { cheerSharePct, MIN_CHEERS_RECEIVED, rankCheerShares } from '@/lib/cheerShare'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
function row(playerId: string, categoryCount: number, totalReceived: number) {
  return { playerId, categoryCount, totalReceived }
}

// ---------------------------------------------------------------------------
// cheerSharePct
// ---------------------------------------------------------------------------
describe('cheerSharePct', () => {
  it('is the category as a whole percent of the total', () => {
    expect(cheerSharePct(30, 60)).toBe(50)
    expect(cheerSharePct(15, 60)).toBe(25)
  })

  it('rounds to the nearest whole percent', () => {
    expect(cheerSharePct(1, 3)).toBe(33)
    expect(cheerSharePct(2, 3)).toBe(67)
  })

  it('returns 0 rather than NaN when nothing was received', () => {
    expect(cheerSharePct(0, 0)).toBe(0)
  })

  it('returns 0 for a negative total rather than a negative percent', () => {
    expect(cheerSharePct(5, -1)).toBe(0)
  })

  it('reaches 100 when every cheer was this category', () => {
    expect(cheerSharePct(20, 20)).toBe(100)
  })
})

// ---------------------------------------------------------------------------
// Eligibility
// ---------------------------------------------------------------------------
describe('rankCheerShares eligibility', () => {
  it('drops a player below the received floor however good their share', () => {
    // 4 of 4 is a perfect 100%, and is exactly the sample the floor exists for.
    const ranked = rankCheerShares([row('a', 4, 4), row('b', 10, 40)])

    expect(ranked.map((r) => r.playerId)).toEqual(['b'])
  })

  it('admits a player sitting exactly on the floor', () => {
    const ranked = rankCheerShares([row('a', 5, MIN_CHEERS_RECEIVED)])
    expect(ranked).toHaveLength(1)
  })

  it('drops a player with none of this category rather than showing 0%', () => {
    const ranked = rankCheerShares([row('a', 0, 60), row('b', 6, 60)])
    expect(ranked.map((r) => r.playerId)).toEqual(['b'])
  })

  it('honours an overridden floor', () => {
    expect(rankCheerShares([row('a', 2, 4)], { minReceived: 4 })).toHaveLength(1)
    expect(rankCheerShares([row('a', 2, 4)], { minReceived: 5 })).toHaveLength(0)
  })

  it('returns nothing for an empty board', () => {
    expect(rankCheerShares([])).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Ordering and ranking
// ---------------------------------------------------------------------------
describe('rankCheerShares ordering', () => {
  it('ranks by share, not by raw count', () => {
    // b has more Offense cheers, but a smaller proportion of their own total.
    const ranked = rankCheerShares([row('a', 20, 40), row('b', 30, 90)])

    expect(ranked.map((r) => r.playerId)).toEqual(['a', 'b'])
    expect(ranked.map((r) => r.sharePct)).toEqual([50, 33])
  })

  it('puts the larger sample first when two shares are equal', () => {
    const ranked = rankCheerShares([row('small', 10, 20), row('big', 30, 60)])

    expect(ranked.map((r) => r.playerId)).toEqual(['big', 'small'])
  })

  it('shares one rank across an equal share', () => {
    const ranked = rankCheerShares([row('a', 30, 60), row('b', 10, 20), row('c', 6, 30)])

    expect(ranked.map((r) => r.rank)).toEqual([1, 1, 2])
  })

  it('is deterministic regardless of input order', () => {
    const a = row('a', 10, 20)
    const b = row('b', 10, 20)

    expect(rankCheerShares([a, b]).map((r) => r.playerId))
      .toEqual(rankCheerShares([b, a]).map((r) => r.playerId))
  })

  it('cuts on places, so a tie can carry more rows than the place limit', () => {
    const tied = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id) => row(id, 10, 20))

    expect(rankCheerShares(tied, { maxPlaces: 1 })).toHaveLength(7)
  })

  it('shows five places by default', () => {
    const rows = [90, 80, 70, 60, 50, 40, 30].map((pct, i) => row(`p${i}`, pct, 100))

    expect(rankCheerShares(rows).map((r) => r.sharePct)).toEqual([90, 80, 70, 60, 50])
  })
})

// ---------------------------------------------------------------------------
// The property that makes shares meaningful
// ---------------------------------------------------------------------------
describe('rankCheerShares vs raw counts', () => {
  it('no longer ranks the player who simply attended most', () => {
    // regular played four times as much; both spread their cheers identically.
    const regular = row('regular', 24, 120)   // 20%
    const occasional = row('occasional', 12, 30) // 40%

    const ranked = rankCheerShares([regular, occasional])

    // The raw count would have put `regular` first with 24 against 12.
    expect(ranked[0].playerId).toBe('occasional')
  })
})
