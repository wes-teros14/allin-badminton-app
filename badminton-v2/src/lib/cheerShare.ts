/**
 * Cheer boards, scored as a share rather than a count.
 *
 * Giving a cheer is not optional: after every game the app blanks out behind
 * the cheer gate until you have cheered all three other players in that match,
 * and a skip only survives until the next reload. So both `cheers_given` and
 * `cheers_received` come out at three per match played — they rank attendance
 * while looking like they rank merit, which is why neither has a board any
 * more.
 *
 * The one real choice in the flow is *which of the six types* to give. That
 * choice is what these boards read, and it has to be read as a proportion:
 * a raw category count still rewards whoever played most, since 20 matches
 * yield 60 cheers spread over six categories and 6 matches yield 18.
 *
 * `cheers_received` is exactly the sum of the six category columns — the
 * trigger in migration 036 increments the total and one category by 1 for
 * every row — so a player's six shares add up to 100%.
 */

import { assignDenseRanks, cutToPlaces } from '@/lib/denseRank'

/**
 * Cheers a player must have received before any of their shares is ranked.
 *
 * A share needs a denominator worth dividing by: without a floor, four cheers
 * that all happened to be Offense reads as a perfect 100% and takes the board.
 * Fifteen is roughly one full session's worth — 16 players over 20 matches is
 * about five matches each, at three cheers a match — so it clears inside a
 * night of play while ruling out a two-game sample.
 */
export const MIN_CHEERS_RECEIVED = 15

/** Places to show per cheer board. Places, not rows: a tie is never split. */
export const CHEER_MAX_PLACES = 5

export interface CheerShareInput {
  playerId: string
  /** Cheers received in the one category this board is about. */
  categoryCount: number
  /** Cheers received across all six categories. */
  totalReceived: number
}

export interface CheerShareRow extends CheerShareInput {
  /** categoryCount as a whole percent of totalReceived. */
  sharePct: number
  rank: number
}

/** Whole-percent share, and 0 rather than NaN when a player has no cheers. */
export function cheerSharePct(categoryCount: number, totalReceived: number): number {
  if (totalReceived <= 0) return 0
  return Math.round((categoryCount / totalReceived) * 100)
}

export interface RankCheerSharesOptions {
  minReceived?: number
  maxPlaces?: number
}

/**
 * Eligibility, ordering and dense ranking for one cheer category.
 *
 * Ordering is share first, then the raw count, then player id — so between two
 * players both reading 40%, the one with more cheers behind that 40% comes
 * first, and the sequence never depends on the order rows arrived in. Players
 * with none of this category are dropped rather than shown as a row of 0%.
 */
export function rankCheerShares(
  rows: readonly CheerShareInput[],
  options: RankCheerSharesOptions = {},
): CheerShareRow[] {
  const { minReceived = MIN_CHEERS_RECEIVED, maxPlaces = CHEER_MAX_PLACES } = options

  const ordered = rows
    .filter((row) => row.totalReceived >= minReceived && row.categoryCount > 0)
    .map((row) => ({ ...row, sharePct: cheerSharePct(row.categoryCount, row.totalReceived) }))
    .sort(
      (a, b) =>
        b.sharePct - a.sharePct ||
        b.categoryCount - a.categoryCount ||
        a.playerId.localeCompare(b.playerId),
    )

  return cutToPlaces(assignDenseRanks(ordered, (row) => row.sharePct), maxPlaces)
}
