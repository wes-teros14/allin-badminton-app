/**
 * Every leaderboard's data layer: the queries, the eligibility gates and the
 * ranking, with no React and no presentation.
 *
 * Extracted from LeaderboardView so the podium-celebration check can ask "what
 * is this player's rank right now" without a second, lighter copy of the
 * ranking rules. Two definitions of a rank is precisely the drift this codebase
 * has been bitten by before (see the match-outcome helper): one board would
 * congratulate a player the other did not place.
 */

import { supabase } from '@/lib/supabase'
import { assignDenseRanks, cutToPlaces } from '@/lib/denseRank'
import { fetchBoardProfiles, fetchEligibility } from '@/lib/boardEligibility'
import { disambiguateDisplayNames, formatDisplayName } from '@/lib/formatDisplayName'
import { shareInFlight } from '@/lib/inflight'
import { rankPairs, tallyPairs } from '@/lib/pairStats'
import { fetchSeasonCheers, fetchSeasonMatches, type SeasonMatchRow } from '@/lib/seasonData'
import { seasonWindow, type BoardScope, type DateWindow } from '@/lib/season'
import { tallyCheers, tallyPlayerGames } from '@/lib/seasonTally'
import { rankCheerShares, type CheerShareRow } from '@/lib/cheerShare'
import { CHEER_CATEGORIES, type CheerCategory } from '@/lib/cheerTypes'
import { awardBoardKey, cheersBoard } from '@/lib/podiumCelebration'
import { fetchAwardsLeaderboard } from '@/lib/awardsLeaderboard'
import type { RankSnapshot } from '@/lib/podiumCelebration'

export interface LeaderboardEntry {
  rank: number
  playerId: string
  displayName: string
  avatarUrl: string | null
  wins: number
  losses: number
  winRate: number
}

export interface CheerLeaderboardEntry {
  player_id: string
  displayName: string
  cheers_received: number
  cheers_given: number
  offense_received: number
  defense_received: number
  technique_received: number
  movement_received: number
  good_sport_received: number
  solid_effort_received: number
}

export interface CheerStatsRow {
  player_id: string
  cheers_received: number
  cheers_given: number
  offense_received: number
  defense_received: number
  technique_received: number
  movement_received: number
  good_sport_received: number
  solid_effort_received: number
}

export interface PairLeaderboardPlayer {
  id: string
  displayName: string
  avatarUrl: string | null
}

export interface PairLeaderboardEntry {
  rank: number
  key: string
  players: [PairLeaderboardPlayer, PairLeaderboardPlayer]
  wins: number
  losses: number
  games: number
  winRate: number
}

/** Places 1-3 get a medal; every place below gets a numbered chip. */
export const PODIUM_PLACES = 3
/** Ten *places*, not ten rows — a tie makes the two differ. */
export const MAX_PLACES = 10

// --- Shared season read -----------------------------------------------------

/**
 * The season's matches, read once while a read is already under way. Individual and Partners both
 * tally the same rows, so loading both for one scope costs one paged read instead of two. Nothing is
 * cached (see `shareInFlight`), so a refresh after a new result always reads fresh rows.
 */
export function seasonMatchesOnce(w: DateWindow): Promise<SeasonMatchRow[]> {
  return shareInFlight(`matches|${w.start ?? ''}|${w.end ?? ''}`, () => fetchSeasonMatches(w))
}

// --- Individual board -------------------------------------------------------

/**
 * Pure ranking of the Individual board: win rate, then wins, then player id; shared ranks on equal
 * win rate; cut to `MAX_PLACES` places. `include` is applied before ranking, so a player it rejects
 * never occupies a place. Inactive players are dropped unless `includeInactive` (a past season).
 */
export function rankIndividual(
  tallies: ReadonlyMap<string, { games: number; wins: number }>,
  profiles: ReadonlyArray<{ id: string; nickname: string | null; name_slug: string; avatar_url: string | null; is_active: boolean }>,
  include: (id: string) => boolean,
  opts: { includeInactive: boolean },
): LeaderboardEntry[] {
  const profileById = new Map(profiles.map((p) => [p.id, p]))

  const ordered: Array<Omit<LeaderboardEntry, 'rank'>> = []
  for (const [playerId, t] of tallies) {
    const profile = profileById.get(playerId)
    if (!profile || t.games === 0) continue
    if (!opts.includeInactive && !profile.is_active) continue
    if (!include(playerId)) continue
    ordered.push({
      playerId,
      displayName: formatDisplayName(profile.nickname, profile.name_slug),
      avatarUrl: profile.avatar_url,
      wins: t.wins,
      losses: t.games - t.wins,
      winRate: Math.round((t.wins / t.games) * 100),
    })
  }
  // The player id settles what wins do not, so the sequence is a property of the data rather than
  // of the order the rows happened to arrive in.
  ordered.sort((a, b) => b.winRate - a.winRate || b.wins - a.wins || a.playerId.localeCompare(b.playerId))

  // Shared rank by win rate, matching the partnership board: two players both reading 67% take the
  // same place, and the cut counts places not rows.
  return cutToPlaces(assignDenseRanks(ordered, (entry) => entry.winRate), MAX_PLACES)
}

export async function fetchWinsLeaderboard(scope: BoardScope): Promise<LeaderboardEntry[]> {
  // The shared gate, not a local copy: the copy that once lived here skipped the guest rule, and the
  // podium celebration reads this board.
  const [matches, profiles, eligibility] = await Promise.all([
    seasonMatchesOnce(seasonWindow(scope.season)),
    fetchBoardProfiles(),
    fetchEligibility(scope),
  ])
  return rankIndividual(
    tallyPlayerGames(matches),
    profiles,
    (id) => eligibility.qualifies(id, scope.season.floors.individual),
    { includeInactive: !scope.isCurrent },
  )
}

// --- Cheers board -----------------------------------------------------------

export async function fetchCheerLeaderboard(scope: BoardScope): Promise<CheerLeaderboardEntry[]> {
  const [cheers, profiles, eligibility] = await Promise.all([
    fetchSeasonCheers(seasonWindow(scope.season)),
    fetchBoardProfiles(),
    fetchEligibility(scope),
  ])
  const profileById = new Map(profiles.map((p) => [p.id, p]))

  const rows: CheerLeaderboardEntry[] = []
  for (const row of tallyCheers(cheers).values()) {
    if (row.cheers_received <= 0) continue
    const profile = profileById.get(row.player_id)
    if (!profile) continue
    if (scope.isCurrent && !profile.is_active) continue
    if (!eligibility.qualifies(row.player_id, scope.season.floors.cheers)) continue
    rows.push({ ...row, displayName: formatDisplayName(profile.nickname, profile.name_slug) })
  }
  return rows
}

// --- Partnership board -----------------------------------------------------

/** Also read by the Partners board caption, which states the rule to players. */
export const MIN_GAMES_TOGETHER = 3

export async function fetchPairLeaderboard(scope: BoardScope): Promise<PairLeaderboardEntry[]> {
  const [matches, allProfiles, eligibility] = await Promise.all([
    seasonMatchesOnce(seasonWindow(scope.season)),
    fetchBoardProfiles(),
    fetchEligibility(scope),
  ])

  const profileRows = scope.isCurrent ? allProfiles.filter((p) => p.is_active) : allProfiles
  const profileById = new Map(profileRows.map((p) => [p.id, p]))

  // Two different players can both be nicknamed "Alexis". On a pair row that
  // would render as "Alexis & Alexis" — the exact string that signalled the
  // duplicate-player bug migration 079 was written to stop.
  const labels = disambiguateDisplayNames(
    profileRows.map((p) => ({
      id: p.id,
      nameSlug: p.name_slug,
      displayName: formatDisplayName(p.nickname, p.name_slug),
    })),
  )

  // rankPairs applies this to *both* players, so a pairing needs two qualifying
  // partners — not one regular plus whoever they happened to play beside.
  const ranked = rankPairs(tallyPairs(matches), {
    minGames: MIN_GAMES_TOGETHER,
    maxRank: MAX_PLACES,
    isEligiblePlayer: (id) => profileById.has(id) && eligibility.qualifies(id, scope.season.floors.played),
  })

  const toPlayer = (id: string): PairLeaderboardPlayer => ({
    id,
    displayName: labels.get(id) ?? id,
    avatarUrl: profileById.get(id)?.avatar_url ?? null,
  })

  return ranked.map((pair) => ({
    rank: pair.rank,
    key: pair.key,
    players: [toPlayer(pair.playerA), toPlayer(pair.playerB)],
    wins: pair.wins,
    losses: pair.losses,
    games: pair.games,
    winRate: pair.winRate,
  }))
}

// --- Cheap change detection -------------------------------------------------

/**
 * The most recent moment any session was completed, or null if none ever has.
 *
 * This is the gate in front of everything above it. Standings can only move when
 * a session completes, so a caller that remembers this value can skip the board
 * fetchers entirely — and those read player stats, every active profile, recent
 * sessions and registrations, and page through every completed match. Paying that
 * on an ordinary launch, for news that arrives about once a week, is indefensible.
 *
 * Deliberately exported on its own so it can be called *without* pulling in the
 * fetchers it guards.
 */
export async function fetchLatestSessionCompletion(): Promise<string | null> {
  const { data, error } = await supabase
    .from('sessions')
    .select('completed_at')
    .eq('status', 'complete')
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Surfaced, not swallowed: an empty result and a rejected request are opposite
  // findings, and the caller decides that a failure means "do nothing this time".
  if (error) throw error
  return (data as { completed_at: string | null } | null)?.completed_at ?? null
}

// --- One player's place on a board ------------------------------------------

/**
 * A player can appear in several pairings; their Partners standing is their best one (the lowest rank, the
 * first such row in board order). Null when they are in no ranked pairing.
 */
export function bestPairEntry(
  pairs: readonly PairLeaderboardEntry[],
  playerId: string,
): PairLeaderboardEntry | null {
  let best: PairLeaderboardEntry | null = null
  for (const p of pairs) {
    if (!p.players.some((pl) => pl.id === playerId)) continue
    if (!best || p.rank < best.rank) best = p
  }
  return best
}

/** The player's place on each cheer category's board, in category order; `place` is null when unplaced. */
export function cheerPlaces(
  rows: readonly CheerLeaderboardEntry[],
  playerId: string,
): Array<{ category: CheerCategory; place: CheerShareRow | null }> {
  return CHEER_CATEGORIES.map((category) => {
    const ranked = rankCheerShares(
      rows.map((e) => ({ playerId: e.player_id, categoryCount: category.of(e), totalReceived: e.cheers_received })),
    )
    return { category, place: ranked.find((r) => r.playerId === playerId) ?? null }
  })
}

// --- One player's standing across every watched board -----------------------

/**
 * Where `playerId` currently stands on each board this app celebrates.
 *
 * Every value goes through the same fetchers and the same ranking the
 * leaderboard screen renders, which is the entire reason this module exists. A
 * lighter "just my rank" query would have to restate the eligibility gates and
 * the dense-rank rule, and two statements of the same rule drift — this codebase
 * has already been bitten once by exactly that.
 *
 * A board the player is eligible for but not placed on yields `null`. A board
 * that could not be read is *omitted*, which is a different thing: the caller
 * treats an absent board as "not watched" and stays silent about it, rather than
 * mistaking a failed query for a player who has just arrived.
 */
export async function fetchPlayerStandings(playerId: string, scope: BoardScope): Promise<RankSnapshot> {
  const standings: RankSnapshot = {}

  const [winsRes, pairsRes, cheersRes, awardsRes] = await Promise.allSettled([
    fetchWinsLeaderboard(scope),
    fetchPairLeaderboard(scope),
    fetchCheerLeaderboard(scope),
    fetchAwardsLeaderboard(scope),
  ])

  if (winsRes.status === 'fulfilled') {
    standings.wins = winsRes.value.find((e) => e.playerId === playerId)?.rank ?? null
  }

  if (pairsRes.status === 'fulfilled') {
    standings.pairs = bestPairEntry(pairsRes.value, playerId)?.rank ?? null
  }

  if (cheersRes.status === 'fulfilled') {
    for (const { category, place } of cheerPlaces(cheersRes.value, playerId)) {
      standings[cheersBoard(category.slug)] = place?.rank ?? null
    }
  }

  if (awardsRes.status === 'fulfilled') {
    // Places beyond the top 5 are not shown on the tab, so they count as unplaced.
    for (const award of awardsRes.value) {
      standings[awardBoardKey(award.key)] = award.rows.find((r) => r.playerId === playerId)?.rank ?? null
    }
  }

  return standings
}
