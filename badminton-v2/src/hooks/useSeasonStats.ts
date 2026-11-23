import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatDisplayName } from '@/lib/formatDisplayName'
import { pastSeasons, seasonWindow, type BoardScope, type Season } from '@/lib/season'
import { fetchAttendance, fetchSeasonCheers, fetchSeasonMatches } from '@/lib/seasonData'
import { winRatePct } from '@/lib/matchResults'
import { countSessions, tallyCheers, tallyHeadToHead, tallyPlayerGames } from '@/lib/seasonTally'
import { fetchSeasonBadges, type Badge } from '@/lib/seasonBadges'
import {
  fetchCheerLeaderboard,
  fetchPairLeaderboard,
  fetchWinsLeaderboard,
  type CheerStatsRow,
} from '@/lib/leaderboardData'
import { whereYouFinished, type FinishRow } from '@/lib/yearInReview'

/** One player's numbers for one season. Same fields the lifetime profile stats had. */
export interface SeasonStats {
  sessionsAttended: number
  gamesPlayed: number
  wins: number
  winRate: number
  bestPartners: Array<{ nameSlug: string; wins: number }>
  toughestOpponents: Array<{ nameSlug: string; losses: number }>
}

// --- A load that can fail, be retried, and never shows another key's result ---

interface LoadState<T> {
  value: T | null
  error: Error | null
  isLoading: boolean
  refresh: () => void
}

/**
 * Runs `fetch` whenever `key` changes or `refresh` is called. The result is tagged with the key it was read
 * for, so a switch to another player or season never shows the previous one's numbers for a render; a stale
 * response is dropped. A failure is an error, never a null read as "nothing".
 */
function useKeyedLoad<T>(key: string | null, fetch: () => Promise<T>): LoadState<T> {
  const [tagged, setTagged] = useState<{ key: string | null; value: T | null; error: Error | null }>({
    key: null,
    value: null,
    error: null,
  })
  const [refreshKey, setRefreshKey] = useState(0)
  const request = useRef(0)
  const fetchRef = useRef(fetch)
  // Declared before the load effect, so it runs first and the load always calls this render's fetch.
  useEffect(() => { fetchRef.current = fetch })

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  useEffect(() => {
    if (key === null) return
    const id = ++request.current
    // A retry after a failure shows loading again rather than the old error.
    setTagged((t) => (t.key === key && t.error ? { key, value: null, error: null } : t))
    fetchRef.current().then(
      (value) => { if (id === request.current) setTagged({ key, value, error: null }) },
      (error: unknown) => {
        console.error('[profile] season load failed', error)
        if (id === request.current) {
          setTagged({ key, value: null, error: error instanceof Error ? error : new Error(String(error)) })
        }
      },
    )
  }, [key, refreshKey])

  // A refresh keeps the numbers on screen until the new ones arrive; a new key starts from loading.
  const current = tagged.key === key
  return {
    value: current ? tagged.value : null,
    error: current ? tagged.error : null,
    isLoading: key !== null && (!current || (tagged.value === null && tagged.error === null)),
    refresh,
  }
}

const scopeKey = (scope: BoardScope) => `${scope.season.id}|${scope.asOf}`

// --- Stats -----------------------------------------------------------------------

/** The three highest counts, ties broken by name so the order never depends on row order. */
function topThree(counts: Map<string, number>, names: Map<string, string>): Array<{ nameSlug: string; count: number }> {
  return [...counts]
    .filter(([, count]) => count > 0)
    .map(([id, count]) => ({ nameSlug: names.get(id) ?? id, count }))
    .sort((a, b) => b.count - a.count || a.nameSlug.localeCompare(b.nameSlug))
    .slice(0, 3)
}

async function fetchDisplayNames(ids: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>()
  if (ids.length === 0) return names
  const { data, error } = await supabase.from('profiles').select('id, name_slug, nickname').in('id', ids)
  if (error) throw error
  for (const p of data as Array<{ id: string; name_slug: string; nickname: string | null }>) {
    names.set(p.id, formatDisplayName(p.nickname, p.name_slug))
  }
  return names
}

/**
 * Sessions attended counts played sessions only (a completed session with no results is not one). Games,
 * partners and opponents count every recorded game in the season, so a result entered tonight shows tonight.
 */
async function fetchSeasonStats(
  userId: string,
  scope: BoardScope,
): Promise<{ stats: SeasonStats; cheers: CheerStatsRow | null }> {
  const w = seasonWindow(scope.season)
  const [matches, attendance, cheerRows] = await Promise.all([
    fetchSeasonMatches(w),
    fetchAttendance(w),
    fetchSeasonCheers(w),
  ])

  const games = tallyPlayerGames(matches).get(userId) ?? { games: 0, wins: 0 }
  const { partners, opponents } = tallyHeadToHead(matches, userId)
  const names = await fetchDisplayNames([...new Set([...partners.keys(), ...opponents.keys()])])

  return {
    stats: {
      sessionsAttended: countSessions(attendance, w).get(userId) ?? 0,
      gamesPlayed: games.games,
      wins: games.wins,
      winRate: winRatePct(games.wins, games.games),
      bestPartners: topThree(partners, names).map(({ nameSlug, count }) => ({ nameSlug, wins: count })),
      toughestOpponents: topThree(opponents, names).map(({ nameSlug, count }) => ({ nameSlug, losses: count })),
    },
    cheers: tallyCheers(cheerRows).get(userId) ?? null,
  }
}

export interface SeasonStatsLoad {
  stats: SeasonStats | null
  cheers: CheerStatsRow | null
  error: Error | null
  isLoading: boolean
  refresh(): void
}

export function useSeasonStats(userId: string | undefined, scope: BoardScope): SeasonStatsLoad {
  const load = useKeyedLoad(userId ? `${userId}|${scopeKey(scope)}` : null, () => fetchSeasonStats(userId as string, scope))
  return {
    stats: load.value?.stats ?? null,
    cheers: load.value?.cheers ?? null,
    error: load.error,
    isLoading: load.isLoading,
    refresh: load.refresh,
  }
}

// --- Badges ----------------------------------------------------------------------

/**
 * The player's award badges for the season. `held` is the early-season hold: the current season has fewer
 * than BADGE_HOLD_SESSIONS played sessions, so no badges are shown yet. A past season is never held.
 */
export interface SeasonBadgesLoad {
  badges: Badge[] | null
  held: boolean
  error: Error | null
  isLoading: boolean
  refresh(): void
}

export function useSeasonBadges(userId: string | undefined, scope: BoardScope): SeasonBadgesLoad {
  const load = useKeyedLoad(userId ? `${userId}|${scopeKey(scope)}` : null, () =>
    fetchSeasonBadges(userId as string, scope),
  )
  return {
    badges: load.value?.badges ?? null,
    held: load.value?.held ?? false,
    error: load.error,
    isLoading: load.isLoading,
    refresh: load.refresh,
  }
}

// --- Past seasons ----------------------------------------------------------------

export interface PastSeasonCard {
  season: Season
  sessions: number
  games: number
}

interface PastSeasonTotals {
  sessions: ReadonlyMap<string, number>
  games: ReadonlyMap<string, { games: number; wins: number }>
}

const pastSeasonTotalsCache = new Map<string, Promise<PastSeasonTotals>>()

/**
 * Every player's sessions and games for one ended season, read once per page visit. An ended season
 * barely changes, so re-reading all of it on every profile open only costs requests; a reload picks up
 * a corrected old result. A failed read is dropped, so the next open retries it.
 */
export function pastSeasonTotals(season: Season): Promise<PastSeasonTotals> {
  const cached = pastSeasonTotalsCache.get(season.id)
  if (cached) return cached
  const w = seasonWindow(season)
  const read = Promise.all([fetchAttendance(w), fetchSeasonMatches(w)]).then(([attendance, matches]) => ({
    sessions: countSessions(attendance, w),
    games: tallyPlayerGames(matches),
  }))
  pastSeasonTotalsCache.set(season.id, read)
  read.catch(() => { if (pastSeasonTotalsCache.get(season.id) === read) pastSeasonTotalsCache.delete(season.id) })
  return read
}

/** "21 sessions · 88 games" for one ended season. No board place: that would mean a full board read per open. */
async function fetchPastSeasonCard(userId: string, season: Season): Promise<PastSeasonCard> {
  const totals = await pastSeasonTotals(season)
  return {
    season,
    sessions: totals.sessions.get(userId) ?? 0,
    games: totals.games.get(userId)?.games ?? 0,
  }
}

/** One card per ended season the player attended at least one played session of, newest first. */
export function usePastSeasonCards(
  userId: string | undefined,
  today: string,
): { cards: PastSeasonCard[] | null; error: Error | null; isLoading: boolean; refresh(): void } {
  const load = useKeyedLoad(userId ? `${userId}|${today}` : null, async () => {
    const cards = await Promise.all(pastSeasons(today).map((s) => fetchPastSeasonCard(userId as string, s)))
    return cards.filter((c) => c.sessions > 0)
  })
  return { cards: load.value, error: load.error, isLoading: load.isLoading, refresh: load.refresh }
}

// --- Where you finished ------------------------------------------------------------

/** The player's places on the season's Individual, Partners and Cheers boards, for the year page. */
export function useWhereYouFinished(
  userId: string | undefined,
  scope: BoardScope,
): { rows: FinishRow[] | null; error: Error | null; isLoading: boolean; refresh(): void } {
  const load = useKeyedLoad(userId ? `${userId}|${scopeKey(scope)}` : null, async () => {
    const [wins, pairs, cheers] = await Promise.all([
      fetchWinsLeaderboard(scope),
      fetchPairLeaderboard(scope),
      fetchCheerLeaderboard(scope),
    ])
    return whereYouFinished(userId as string, { wins, pairs, cheers })
  })
  return { rows: load.value, error: load.error, isLoading: load.isLoading, refresh: load.refresh }
}
