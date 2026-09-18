/**
 * Deciding when a leaderboard placing is worth celebrating.
 *
 * The rule is "newly theirs", not "currently theirs". A player who has been 2nd
 * since August must never be congratulated for it again, so every decision is a
 * comparison against the last ranks that player was shown — never against the
 * board alone.
 *
 * Kept pure and free of React, Supabase and storage so the rule can be tested
 * directly. The hook that feeds it deals with fetching and persistence.
 */

import { CHEER_CATEGORIES } from '@/lib/cheerTypes'
import type { CheerTypeSlug } from '@/types/app'

/** Places that count as a podium. Matches MEDALS in LeaderboardView. */
export const PODIUM_PLACES = 3

/**
 * Which leaderboard a placing belongs to. Cheers carries its category, because
 * each of the six is its own board with its own podium.
 */
export type BoardKey = 'wins' | 'pairs' | `cheers:${CheerTypeSlug}`

export const cheersBoard = (slug: CheerTypeSlug): BoardKey => `cheers:${slug}`

/**
 * Every board this feature watches, in the order a tie between two equally good
 * placings is broken.
 *
 * Derived from CHEER_CATEGORIES rather than listed by hand, so a seventh cheer
 * type is added in one place — the same reason that list exists. The Awards
 * board is deliberately absent: it has a single holder and no second or third
 * place, so there is no podium to detect.
 */
export const WATCHED_BOARDS: readonly BoardKey[] = [
  'wins',
  'pairs',
  ...CHEER_CATEGORIES.map((c) => cheersBoard(c.slug)),
]

/**
 * One player's rank on every board being watched, as of one moment.
 *
 * `null` means "eligible to be ranked but not placed" — distinct from a key
 * being absent, which means "this board was not being watched then". The
 * difference decides whether a later placing counts as news; see
 * `newPodiumPlacings`.
 */
export type RankSnapshot = Partial<Record<BoardKey, number | null>>

export interface NewPlacing {
  board: BoardKey
  rank: number
  /** The rank this replaces: null when the player was not placed at all. */
  previousRank: number | null
}

/** Tie-break when two boards are newly won at the same rank. */
const BOARD_PRIORITY: readonly string[] = ['wins', 'pairs']

function priority(board: BoardKey): number {
  const i = BOARD_PRIORITY.indexOf(board)
  // Cheers boards sort after the two headline boards, in a stable order.
  return i === -1 ? BOARD_PRIORITY.length : i
}

/**
 * Boards the player has newly reached, or improved their place on, since the
 * previous snapshot. Ordered best-first.
 *
 * Three deliberate silences:
 *
 * - **No previous snapshot at all** — the first run after this ships records
 *   ranks and celebrates nothing. Otherwise every existing podium holder would
 *   be congratulated on launch day for a placing they have held for months.
 * - **A board absent from the previous snapshot** — the same protection, one
 *   board at a time. Adding a seventh cheer category later must not hand
 *   everyone a celebration for a rank they already had.
 * - **Holding the same place** — 2nd last week and 2nd today is not news.
 *
 * Improving *within* the podium does count: 3rd to 1st is the best kind of news
 * this can deliver.
 */
export function newPodiumPlacings(
  previous: RankSnapshot | null,
  current: RankSnapshot,
): NewPlacing[] {
  if (previous === null) return []

  const found: NewPlacing[] = []

  for (const [key, rankValue] of Object.entries(current)) {
    const board = key as BoardKey
    const rank = rankValue ?? null

    if (rank === null || rank > PODIUM_PLACES) continue
    if (!(board in previous)) continue

    const previousRank = previous[board] ?? null
    if (previousRank !== null && previousRank <= rank) continue

    found.push({ board, rank, previousRank })
  }

  return found.sort((a, b) => a.rank - b.rank || priority(a.board) - priority(b.board))
}

/**
 * The one placing to celebrate, out of however many landed at once.
 *
 * A completed session can move a player on several of the eight boards in one
 * go, and playing eight celebrations back to back would turn the best moment in
 * the app into a queue to sit through. The best placing gets the full treatment
 * and the toast mentions the rest.
 */
export function bestPlacing(placings: readonly NewPlacing[]): NewPlacing | null {
  return placings.length > 0 ? placings[0] : null
}
