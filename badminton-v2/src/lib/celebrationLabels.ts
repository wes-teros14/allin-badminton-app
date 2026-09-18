/**
 * Turning a board key into words a player recognises.
 *
 * Kept out of the card so the wording is testable and stated once. The card, the
 * toast and the multi-achievement list all read from here, which is what stops
 * "Good Sport" becoming "good_sport" on one surface and not another.
 */

import { CHEER_CATEGORIES } from '@/lib/cheerTypes'
import type { BoardKey, NewPlacing } from '@/lib/podiumCelebration'

const ORDINALS = ['1st', '2nd', '3rd'] as const

export function ordinal(rank: number): string {
  return rank <= 3 ? ORDINALS[rank - 1] : `${rank}th`
}

/** The board's own name, as it appears on the leaderboard's tabs. */
export function boardTitle(board: BoardKey): string {
  if (board === 'wins') return 'Individual'
  if (board === 'pairs') return 'Partners'
  const slug = board.slice('cheers:'.length)
  return CHEER_CATEGORIES.find((c) => c.slug === slug)?.name ?? 'Cheers'
}

/** Which leaderboard tab to open for this board. */
export function boardTab(board: BoardKey): 'wins' | 'pairs' | 'cheers' {
  if (board === 'wins') return 'wins'
  if (board === 'pairs') return 'pairs'
  return 'cheers'
}

/**
 * A board takes "on", a cheer category takes "in".
 *
 * "2nd on Individual" and "3rd in Good Sport" — the preposition is not
 * decoration; "3rd on Good Sport" reads as a place rather than a quality.
 */
export function boardPreposition(board: BoardKey): 'on' | 'in' {
  return board.startsWith('cheers:') ? 'in' : 'on'
}

export function cardLabel(placing: NewPlacing): { title: string; detail: string } {
  const title = boardTitle(placing.board)

  if (placing.board === 'wins') return { title, detail: `${title} · most wins` }
  if (placing.board === 'pairs') return { title, detail: `${title} · pair win rate` }
  return { title, detail: `${title} · share of your cheers` }
}

/** "You're 2nd on Individual", plus "— and 2 more" when several landed at once. */
export function toastLine(best: NewPlacing, extraCount: number): string {
  const head = `You're ${ordinal(best.rank)} ${boardPreposition(best.board)} ${boardTitle(best.board)}`
  return extraCount > 0 ? `${head} — and ${extraCount} more` : head
}
