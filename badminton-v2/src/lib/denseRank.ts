/**
 * Ranking primitives shared by every leaderboard.
 *
 * The all-time player board and the partnership board show the same shape of
 * thing: rows ordered by a rate, where an equal rate is one shared place. That
 * arithmetic lives here so the two cannot drift into disagreeing — a board that
 * prints the same percentage twice and then ranks those rows apart reads as
 * broken to the person looking at it.
 */

export interface RankGroup<T> {
  rank: number
  items: T[]
}

/**
 * Dense rank over an already-ordered list: an equal rate shares a rank, and the
 * next distinct rate takes the next number — 1, 1, 2, not 1, 1, 3.
 *
 * Ordering is the caller's job, because what settles the sequence *within* a
 * shared rank differs per board (wins then pair key for partnerships, wins then
 * player id for individuals). Passing an unordered list produces nonsense
 * rather than an error, so sort first.
 */
export function assignDenseRanks<T>(
  ordered: readonly T[],
  rateOf: (item: T) => number,
): (T & { rank: number })[] {
  let rank = 0
  let previousRate: number | null = null

  return ordered.map((item) => {
    const rate = rateOf(item)
    if (rate !== previousRate) {
      rank++
      previousRate = rate
    }
    return { ...item, rank }
  })
}

/**
 * Cuts on *place*, not row count: "top ten" means the ten best placings,
 * however many rows those hold. Seven pairs tied for first still leave nine
 * more places to show, and a place is never split down the middle by the cut.
 */
export function cutToPlaces<T extends { rank: number }>(
  ranked: readonly T[],
  maxPlaces: number,
): T[] {
  return ranked.filter((item) => item.rank <= maxPlaces)
}

/**
 * Collapses ranked rows into one entry per shared rank, so a view can draw the
 * rank once for a tie group instead of repeating it on every row.
 *
 * Generic over anything carrying a rank, so a view can group its own
 * display-ready rows without converting back to the source shape.
 */
export function groupByRank<T extends { rank: number }>(ranked: readonly T[]): RankGroup<T>[] {
  const groups: RankGroup<T>[] = []

  for (const item of ranked) {
    const current = groups[groups.length - 1]
    if (current && current.rank === item.rank) current.items.push(item)
    else groups.push({ rank: item.rank, items: [item] })
  }

  return groups
}
