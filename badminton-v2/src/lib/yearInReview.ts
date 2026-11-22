/**
 * The "Your 2026 season" page's pure parts: which season ids it opens for, and the "Where you finished" box.
 * The places come from the season's own boards, so the box can never disagree with the Leaderboard.
 */

import { pastSeasons, type Season } from '@/lib/season'
import { rankCheerShares } from '@/lib/cheerShare'
import { CHEER_CATEGORIES } from '@/lib/cheerTypes'
import { ordinal } from '@/lib/celebrationLabels'
import type { CheerLeaderboardEntry, LeaderboardEntry, PairLeaderboardEntry } from '@/lib/leaderboardData'

/** The season `id` names, only when it has ended by `today`. The current season, or no season, is null. */
export function resolvePastSeason(id: string | undefined, today: string): Season | null {
  if (id === undefined) return null
  return pastSeasons(today).find((s) => s.id === id) ?? null
}

export interface FinishRow {
  board: string
  detail: string
}

/**
 * The player's final place on Individual (with win rate), their best Partners place (with that partner), and
 * their best Cheers category (with their share). A board the player did not place on is left out.
 */
export function whereYouFinished(
  playerId: string,
  boards: {
    wins: readonly LeaderboardEntry[]
    pairs: readonly PairLeaderboardEntry[]
    cheers: readonly CheerLeaderboardEntry[]
  },
): FinishRow[] {
  const rows: FinishRow[] = []

  const individual = boards.wins.find((e) => e.playerId === playerId)
  if (individual) rows.push({ board: 'Individual', detail: `${ordinal(individual.rank)} · ${individual.winRate}%` })

  // Board order already puts the better of two equal places first.
  let bestPair: PairLeaderboardEntry | null = null
  for (const p of boards.pairs) {
    if (!p.players.some((pl) => pl.id === playerId)) continue
    if (!bestPair || p.rank < bestPair.rank) bestPair = p
  }
  if (bestPair) {
    const partner = bestPair.players.find((pl) => pl.id !== playerId)
    if (partner) rows.push({ board: 'Partners', detail: `${ordinal(bestPair.rank)} with ${partner.displayName}` })
  }

  // Best category: the lowest place, then the higher share; list order settles the rest.
  let bestCheer: { name: string; rank: number; sharePct: number } | null = null
  for (const category of CHEER_CATEGORIES) {
    const ranked = rankCheerShares(
      boards.cheers.map((c) => ({ playerId: c.player_id, categoryCount: category.of(c), totalReceived: c.cheers_received })),
    )
    const mine = ranked.find((r) => r.playerId === playerId)
    if (!mine) continue
    if (!bestCheer || mine.rank < bestCheer.rank || (mine.rank === bestCheer.rank && mine.sharePct > bestCheer.sharePct)) {
      bestCheer = { name: category.name, rank: mine.rank, sharePct: mine.sharePct }
    }
  }
  if (bestCheer) rows.push({ board: `Cheers · ${bestCheer.name}`, detail: `${ordinal(bestCheer.rank)} · ${bestCheer.sharePct}%` })

  return rows
}
