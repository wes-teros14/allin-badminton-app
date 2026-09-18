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

/**
 * What kind of good news this is. Decides the icon, the border and the wording.
 *
 * `podium` is the only one that earns a medal edge; the other three are the same
 * celebration with the app's bunny and the ordinary border, because everybody who
 * achieved something gets the same moment.
 */
export type AchievementKind = 'podium' | 'first-appearance' | 'climb'

export interface NewPlacing {
  board: BoardKey
  kind: AchievementKind
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
 * How many places a player must gain before a climb is worth announcing.
 *
 * One, by product decision: any improvement is worth telling someone about, in
 * the same spirit as giving non-medallists the identical celebration.
 *
 * Since `personal-best` was removed this is now the rung that catches every
 * ordinary improvement outside the top 3.
 *
 * The cost of one, accepted knowingly: a player oscillating 7th, 6th, 7th, 6th is
 * congratulated every other session for going nowhere. Raise this number if that
 * shows up in practice — it is the one dial that cheapens the celebration
 * fastest.
 */
export const CLIMB_THRESHOLD = 1

/**
 * Which kinds of achievement outrank which, best first.
 *
 * `first-appearance` beats `climb` because arriving on a board is a bigger thing
 * than moving within it, and `climb` sits last because it is the weakest claim of
 * the three: a player can rise purely because the people above them stopped
 * showing up.
 *
 * A `personal-best` kind used to sit between them and was removed. The app cannot
 * honestly claim a best: there is no rank history in the database, so `bestEver`
 * is only the best this browser has observed since the feature first ran, seeded
 * from wherever the player happened to stand that day. "Your best yet!" was
 * therefore false for anyone who peaked before this shipped. Restore it only
 * alongside a stored rank history — see research.md R11.
 */
const KIND_PRIORITY: readonly AchievementKind[] = [
  'podium',
  'first-appearance',
  'climb',
]

const kindRank = (kind: AchievementKind) => KIND_PRIORITY.indexOf(kind)

/**
 * Best rank per board as far as this browser has ever observed.
 *
 * No longer used to celebrate a personal best — the app cannot back that claim —
 * but still load-bearing for `first-appearance`, which is the only way to tell a
 * player arriving on a board from one returning to it after falling off.
 */
export type BestEver = Partial<Record<BoardKey, number>>

/**
 * Classifies one board's movement, or returns null when there is no news.
 *
 * Order matters here and mirrors KIND_PRIORITY: a single change can satisfy
 * several of these at once, and only the strongest is reported.
 */
function classify(
  board: BoardKey,
  rank: number,
  previousRank: number | null,
  bestEver: BestEver,
): NewPlacing | null {
  const held = bestEver[board]

  // Reached, or improved within, the podium.
  if (rank <= PODIUM_PLACES && (previousRank === null || previousRank > rank)) {
    return { board, kind: 'podium', rank, previousRank }
  }

  // On this board for the very first time. `bestEver` is what makes this
  // distinguishable from someone who dropped off and came back — for them the
  // board is old news, however long they were away.
  if (previousRank === null && held === undefined) {
    return { board, kind: 'first-appearance', rank, previousRank }
  }

  if (previousRank !== null && previousRank - rank >= CLIMB_THRESHOLD) {
    return { board, kind: 'climb', rank, previousRank }
  }

  return null
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
  bestEver: BestEver = {},
): NewPlacing[] {
  if (previous === null) return []

  const found: NewPlacing[] = []

  for (const [key, rankValue] of Object.entries(current)) {
    const board = key as BoardKey
    const rank = rankValue ?? null

    // Not placed at all, so there is nothing to announce. Falling off a board is
    // never reported: this feature does not deliver bad news.
    if (rank === null) continue
    if (!(board in previous)) continue

    const achievement = classify(board, rank, previous[board] ?? null, bestEver)
    if (achievement) found.push(achievement)
  }

  return found.sort(
    (a, b) =>
      kindRank(a.kind) - kindRank(b.kind) ||
      a.rank - b.rank ||
      priority(a.board) - priority(b.board),
  )
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
