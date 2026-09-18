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

/** What the board measures, for the line under the headline. */
function boardMeasure(board: BoardKey): string {
  if (board === 'wins') return 'most wins'
  if (board === 'pairs') return 'pair win rate'
  return 'share of your cheers'
}

/**
 * The card's headline, which is what the achievement actually was — not its rank.
 *
 * A podium says the place because the place is the news. The other three say what
 * the player did, because "6th" on its own is not an achievement and reading it as
 * one is how a celebration starts to feel hollow.
 */
export function cardHeadline(placing: NewPlacing): string {
  switch (placing.kind) {
    case 'podium': return `${ordinal(placing.rank)} place!`
    case 'first-appearance': return "You're on the board!"
    case 'personal-best': return 'Your best yet!'
    case 'climb': {
      const gained = placing.previousRank === null ? 0 : placing.previousRank - placing.rank
      // Singular matters now that a one-place gain qualifies: "Up 1 places!" is
      // the kind of thing that makes a celebration feel machine-made.
      return `Up ${gained} place${gained === 1 ? '' : 's'}!`
    }
  }
}

export function cardLabel(placing: NewPlacing): { title: string; detail: string } {
  const title = boardTitle(placing.board)
  const measure = boardMeasure(placing.board)

  // A personal best and a climb are only meaningful against what came before, so
  // both name it. The other two stand on their own.
  if (placing.kind === 'personal-best' && placing.previousRank !== null) {
    return { title, detail: `${ordinal(placing.rank)} ${boardPreposition(placing.board)} ${title} · was ${ordinal(placing.previousRank)}` }
  }
  if (placing.kind === 'climb' && placing.previousRank !== null) {
    return { title, detail: `Now ${ordinal(placing.rank)} ${boardPreposition(placing.board)} ${title}` }
  }
  if (placing.kind === 'first-appearance') {
    return { title, detail: `${ordinal(placing.rank)} ${boardPreposition(placing.board)} ${title}` }
  }
  return { title, detail: `${title} · ${measure}` }
}

/** "You're 2nd on Individual", plus "— and 2 more" when several landed at once. */
export function toastLine(best: NewPlacing, extraCount: number): string {
  const where = `${boardPreposition(best.board)} ${boardTitle(best.board)}`
  const head =
    best.kind === 'first-appearance'
      ? `You made the ${boardTitle(best.board)} board — ${ordinal(best.rank)}`
      : best.kind === 'personal-best'
        ? `Your best placing yet — ${ordinal(best.rank)} ${where}`
        : `You're ${ordinal(best.rank)} ${where}`

  return extraCount > 0 ? `${head} — and ${extraCount} more` : head
}
