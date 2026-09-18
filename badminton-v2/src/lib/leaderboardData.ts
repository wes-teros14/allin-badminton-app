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
import { fetchEligiblePlayerIds, MIN_SESSIONS_PLAYED, RECENT_SESSIONS_WINDOW } from '@/lib/boardEligibility'
import { disambiguateDisplayNames, formatDisplayName } from '@/lib/formatDisplayName'
import { rankPairs, tallyPairs } from '@/lib/pairStats'
import type { PairTallyMatch } from '@/lib/pairStats'
import { rankCheerShares } from '@/lib/cheerShare'
import { CHEER_CATEGORIES } from '@/lib/cheerTypes'
import { cheersBoard } from '@/lib/podiumCelebration'
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

export async function fetchAllTimeLeaderboard(): Promise<LeaderboardEntry[]> {
  const [statsRes, profilesRes, recentSessionsRes] = await Promise.all([
    supabase.from('player_stats').select('player_id, games_played, wins, sessions_attended').gt('games_played', 0).gte('sessions_attended', MIN_SESSIONS_PLAYED),
    supabase.from('profiles').select('id, nickname, name_slug, avatar_url').eq('is_active', true),
    supabase.from('sessions').select('id').eq('status', 'complete').order('date', { ascending: false }).limit(RECENT_SESSIONS_WINDOW),
  ])

  const recentSessionIds = ((recentSessionsRes.data ?? []) as Array<{ id: string }>).map((s) => s.id)
  const activePlayerIds = new Set<string>()
  if (recentSessionIds.length > 0) {
    const { data: registrations } = await supabase
      .from('session_registrations')
      .select('player_id')
      .in('session_id', recentSessionIds)
    for (const r of (registrations ?? []) as Array<{ player_id: string }>) activePlayerIds.add(r.player_id)
  }

  type ProfileRow = { id: string; nickname: string | null; name_slug: string; avatar_url: string | null }
  const profileRows = (profilesRes.data ?? []) as ProfileRow[]
  const nameMap = new Map(profileRows.map((p) => [p.id, formatDisplayName(p.nickname, p.name_slug)]))
  const avatarMap = new Map(profileRows.map((p) => [p.id, p.avatar_url]))

  const ordered = ((statsRes.data ?? []) as Array<{ player_id: string; games_played: number; wins: number; sessions_attended: number }>)
    .filter((s) => nameMap.has(s.player_id) && activePlayerIds.has(s.player_id))
    .map((s) => ({
      playerId: s.player_id,
      displayName: nameMap.get(s.player_id)!,
      avatarUrl: avatarMap.get(s.player_id) ?? null,
      wins: s.wins,
      losses: s.games_played - s.wins,
      winRate: Math.round((s.wins / s.games_played) * 100),
    }))
    // The player id settles what wins do not, so the sequence is a property of
    // the data rather than of the order Supabase happened to return rows in.
    .sort((a, b) => b.winRate - a.winRate || b.wins - a.wins || a.playerId.localeCompare(b.playerId))

  // Shared rank by win rate, matching the partnership board: two players both
  // reading 67% take the same place, and the cut counts places not rows.
  return cutToPlaces(assignDenseRanks(ordered, (entry) => entry.winRate), MAX_PLACES)
}

export async function fetchCheerLeaderboard(): Promise<CheerLeaderboardEntry[]> {
  const [statsRes, profilesRes, eligibleIds] = await Promise.all([
    supabase.from('player_cheer_stats').select('*').gt('cheers_received', 0),
    supabase.from('profiles').select('id, nickname, name_slug').eq('is_active', true),
    fetchEligiblePlayerIds(),
  ])

  const nameMap = new Map(
    ((profilesRes.data ?? []) as Array<{ id: string; nickname: string | null; name_slug: string }>)
      .map(p => [p.id, formatDisplayName(p.nickname, p.name_slug)])
  )

  return ((statsRes.data ?? []) as CheerStatsRow[])
    .filter(s => nameMap.has(s.player_id) && eligibleIds.has(s.player_id))
    .map(s => ({
      ...s,
      displayName: nameMap.get(s.player_id)!,
    }))
}

// --- Partnership board -----------------------------------------------------

/** Also read by the Partners board caption, which states the rule to players. */
export const MIN_GAMES_TOGETHER = 3
const MATCH_PAGE_SIZE = 1000

/**
 * `sessions!inner(id)` carries no filter today. It is here so that the planned
 * yearly season/archive rule is a single added `.eq('sessions.…', …)` condition
 * rather than a new embed and a re-shaped row type. Do not remove it as unused.
 */
const PAIR_MATCH_SELECT =
  'team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id, match_results(winning_pair_index, game_number), sessions!inner(id)'

/**
 * Every other query in this app is session-scoped or over a small table, so none
 * of them can reach the server's row cap. This one can — a year of play is around
 * a thousand matches — and an uncapped read would come back silently truncated,
 * producing a board that looks right and is wrong. Hence paging, plus the exact
 * count cross-check below.
 */
async function fetchCompletedMatchesForPairs(): Promise<PairTallyMatch[]> {
  const rows: PairTallyMatch[] = []

  for (let offset = 0; ; offset += MATCH_PAGE_SIZE) {
    const { data, error } = await supabase
      .from('matches')
      .select(PAIR_MATCH_SELECT)
      .eq('status', 'complete')
      .order('id', { ascending: true })
      .range(offset, offset + MATCH_PAGE_SIZE - 1)

    if (error) throw error

    const page = (data ?? []) as unknown as PairTallyMatch[]
    rows.push(...page)
    if (page.length < MATCH_PAGE_SIZE) break
  }

  const { count, error: countError } = await supabase
    .from('matches')
    .select('id, sessions!inner(id)', { count: 'exact', head: true })
    .eq('status', 'complete')

  if (countError) throw countError
  if (typeof count === 'number' && count !== rows.length) {
    throw new Error(
      `Pair leaderboard read is incomplete: fetched ${rows.length} of ${count} completed matches. ` +
        'Refusing to render a partially counted board.',
    )
  }

  return rows
}

export async function fetchPairLeaderboard(): Promise<PairLeaderboardEntry[]> {
  const [matches, profilesRes, eligibleIds] = await Promise.all([
    fetchCompletedMatchesForPairs(),
    supabase.from('profiles').select('id, nickname, name_slug, avatar_url').eq('is_active', true),
    fetchEligiblePlayerIds(),
  ])

  type ProfileRow = { id: string; nickname: string | null; name_slug: string; avatar_url: string | null }
  const profileRows = (profilesRes.data ?? []) as ProfileRow[]
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
    isEligiblePlayer: (id) => profileById.has(id) && eligibleIds.has(id),
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
export async function fetchPlayerStandings(playerId: string): Promise<RankSnapshot> {
  const standings: RankSnapshot = {}

  const [winsRes, pairsRes, cheersRes] = await Promise.allSettled([
    fetchAllTimeLeaderboard(),
    fetchPairLeaderboard(),
    fetchCheerLeaderboard(),
  ])

  if (winsRes.status === 'fulfilled') {
    standings.wins = winsRes.value.find((e) => e.playerId === playerId)?.rank ?? null
  }

  if (pairsRes.status === 'fulfilled') {
    // A player can appear in several pairings; their standing is their best one.
    const ranks = pairsRes.value
      .filter((e) => e.players.some((p) => p.id === playerId))
      .map((e) => e.rank)
    standings.pairs = ranks.length > 0 ? Math.min(...ranks) : null
  }

  if (cheersRes.status === 'fulfilled') {
    const rows = cheersRes.value
    for (const category of CHEER_CATEGORIES) {
      const ranked = rankCheerShares(
        rows.map((e) => ({
          playerId: e.player_id,
          categoryCount: category.of(e),
          totalReceived: e.cheers_received,
        })),
      )
      standings[cheersBoard(category.slug)] = ranked.find((r) => r.playerId === playerId)?.rank ?? null
    }
  }

  return standings
}
