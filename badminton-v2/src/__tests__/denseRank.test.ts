import { describe, expect, it } from 'vitest'
import { assignDenseRanks, cutToPlaces, groupByRank } from '@/lib/denseRank'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
/** Ordered highest-rate-first, the way every caller is required to pass it. */
function board(...rates: number[]) {
  return rates.map((rate, i) => ({ id: `row-${i}`, rate }))
}

const byRate = (row: { rate: number }) => row.rate

// ---------------------------------------------------------------------------
// assignDenseRanks
// ---------------------------------------------------------------------------
describe('assignDenseRanks', () => {
  it('numbers distinct rates 1, 2, 3', () => {
    expect(assignDenseRanks(board(90, 80, 70), byRate).map((r) => r.rank)).toEqual([1, 2, 3])
  })

  it('shares one rank across an equal rate', () => {
    expect(assignDenseRanks(board(90, 80, 80), byRate).map((r) => r.rank)).toEqual([1, 2, 2])
  })

  it('is dense, not sparse — the rate after a tie takes the next number', () => {
    expect(assignDenseRanks(board(90, 80, 80, 70), byRate).map((r) => r.rank)).toEqual([1, 2, 2, 3])
  })

  it('gives every row rank 1 when the whole board ties', () => {
    expect(assignDenseRanks(board(67, 67, 67, 67), byRate).map((r) => r.rank)).toEqual([1, 1, 1, 1])
  })

  it('treats a rate of 0 as a rate, not as absent', () => {
    expect(assignDenseRanks(board(50, 0, 0), byRate).map((r) => r.rank)).toEqual([1, 2, 2])
  })

  it('keeps the row order it was given', () => {
    const rows = board(90, 80, 80)
    expect(assignDenseRanks(rows, byRate).map((r) => r.id)).toEqual(rows.map((r) => r.id))
  })

  it('carries the original fields through', () => {
    expect(assignDenseRanks([{ id: 'a', rate: 75, extra: 'kept' }], byRate)[0])
      .toEqual({ id: 'a', rate: 75, extra: 'kept', rank: 1 })
  })

  it('does not mutate the input rows', () => {
    const rows = board(90, 80)
    assignDenseRanks(rows, byRate)
    expect(rows.every((r) => !('rank' in r))).toBe(true)
  })

  it('returns nothing for an empty board', () => {
    expect(assignDenseRanks([], byRate)).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// cutToPlaces
// ---------------------------------------------------------------------------
describe('cutToPlaces', () => {
  it('keeps places up to and including the limit', () => {
    const ranked = assignDenseRanks(board(90, 80, 70, 60), byRate)
    expect(cutToPlaces(ranked, 3).map((r) => r.rank)).toEqual([1, 2, 3])
  })

  it('cuts on places, not rows — a tie can push the row count past the limit', () => {
    // Three places, but four rows, because 80% is shared.
    const ranked = assignDenseRanks(board(90, 80, 80, 70, 60), byRate)
    const cut = cutToPlaces(ranked, 3)

    expect(cut).toHaveLength(4)
    expect(cut.map((r) => r.rank)).toEqual([1, 2, 2, 3])
  })

  it('never splits a shared place down the middle', () => {
    // Seven rows all tied for first: the cut takes all of them or none.
    const ranked = assignDenseRanks(board(67, 67, 67, 67, 67, 67, 67), byRate)
    expect(cutToPlaces(ranked, 1)).toHaveLength(7)
  })

  it('returns everything when the board is shorter than the limit', () => {
    const ranked = assignDenseRanks(board(90, 80), byRate)
    expect(cutToPlaces(ranked, 10)).toHaveLength(2)
  })

  it('returns nothing for a limit of zero', () => {
    expect(cutToPlaces(assignDenseRanks(board(90), byRate), 0)).toEqual([])
  })

  it('returns nothing for an empty board', () => {
    expect(cutToPlaces([], 10)).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// groupByRank
// ---------------------------------------------------------------------------
describe('groupByRank', () => {
  it('collapses shared ranks into one group each', () => {
    const groups = groupByRank(assignDenseRanks(board(75, 67, 67), byRate))
    expect(groups.map((g) => [g.rank, g.items.length])).toEqual([[1, 1], [2, 2]])
  })

  it('preserves the ranked order across and within groups', () => {
    const ranked = assignDenseRanks(board(75, 67, 67, 50), byRate)
    expect(groupByRank(ranked).flatMap((g) => g.items.map((i) => i.id)))
      .toEqual(ranked.map((r) => r.id))
  })

  it('makes one group when the whole board shares a place', () => {
    const groups = groupByRank(assignDenseRanks(board(67, 67, 67), byRate))
    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({ rank: 1 })
    expect(groups[0].items).toHaveLength(3)
  })

  it('makes one group per row when nothing ties', () => {
    expect(groupByRank(assignDenseRanks(board(90, 80, 70), byRate))).toHaveLength(3)
  })

  it('returns nothing for an empty board', () => {
    expect(groupByRank([])).toEqual([])
  })
})
