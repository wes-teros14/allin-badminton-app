import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { buildCourtLabels, buildCourtSlots, type CourtSlot, normalizeCourtCount } from '@/lib/courts'
import { formatDisplayName } from '@/lib/formatDisplayName'
import { commitProfileFetch, createProfileCache, planProfileFetch } from '@/lib/profileCache'

export interface CourtPlayerDisplay {
  name: string
  avatarUrl: string | null
}

export interface CourtMatchDisplay {
  id: string
  gameNumber: number
  startedAt: string | null
  t1p1: string
  t1p2: string
  t2p1: string
  t2p2: string
  /**
   * The same four players with their avatars, for surfaces that show faces.
   * Added alongside the name fields rather than replacing them so the kiosk
   * board and CourtCard keep working unchanged.
   */
  team1: CourtPlayerDisplay[]
  team2: CourtPlayerDisplay[]
}

export interface CourtData {
  current: CourtMatchDisplay | null
  next: CourtMatchDisplay | null
}

interface UseCourtStateResult {
  courts: CourtSlot<CourtMatchDisplay>[]
  courtCount: number
  sessionId: string | null
  isLoading: boolean
  hasSession: boolean
  isClosed: boolean
  splitMatchScoring: boolean
  /**
   * True while a reload is in flight, i.e. the queue on screen may already be
   * out of date. `CourtCard` uses this to decide whether it may trust
   * `data.next` or must re-read the queue head from the server before
   * promoting. See the comment on that fallback in `CourtCard.handleFinish`.
   */
  isReloading: boolean
  refresh: () => void
}

const DEFAULT_COURT_COUNT = 2

const SESSION_COLUMNS = 'id, status, court_count, court_1_label, court_2_label, split_match_scoring'
const MATCH_COLUMNS =
  'id, queue_position, team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id, status, court_number, started_at'
const PROFILE_COLUMNS = 'id, name_slug, nickname, avatar_url'

type MatchRow = {
  id: string
  queue_position: number
  team1_player1_id: string
  team1_player2_id: string
  team2_player1_id: string
  team2_player2_id: string
  status: string
  court_number: number | null
  started_at: string | null
}

function buildEmptyCourts(courtCount = DEFAULT_COURT_COUNT) {
  return buildCourtSlots(courtCount, buildCourtLabels(courtCount), new Map(), [])
}

async function fetchMatches(sessionId: string): Promise<MatchRow[] | null> {
  const { data, error } = await supabase
    .from('matches')
    .select(MATCH_COLUMNS)
    .eq('session_id', sessionId)
    .order('queue_position')

  if (error) return null
  return (data ?? []) as MatchRow[]
}

export function useCourtState(sessionIdParam?: string): UseCourtStateResult {
  const [courts, setCourts] = useState<CourtSlot<CourtMatchDisplay>[]>(() => buildEmptyCourts())
  const [courtCount, setCourtCount] = useState(DEFAULT_COURT_COUNT)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isReloading, setIsReloading] = useState(false)
  const [hasSession, setHasSession] = useState(false)
  const [isClosed, setIsClosed] = useState(false)
  const [splitMatchScoring, setSplitMatchScoring] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const isFirstLoad = useRef(true)
  /**
   * Player names and avatars are static for practically the whole session, so
   * they are cached rather than re-read on every 5-second tick. The cache
   * expires (see PROFILE_CACHE_TTL_MS) so an edited nickname or avatar still
   * propagates.
   */
  const profileCache = useRef(createProfileCache())
  /**
   * The session resolved by the previous load. On the bare `/live-board` route
   * there is no id in the URL, so this is what lets the matches query go out in
   * parallel with the session lookup instead of waiting on its result. A ref,
   * not state, so it does not retrigger the effect.
   */
  const lastSessionId = useRef<string | null>(null)

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  useEffect(() => {
    if (!sessionId || isClosed) return
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        refresh()
      }
    }, 5000)

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refresh()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [isClosed, refresh, sessionId])

  useEffect(() => {
    let cancelled = false

    function settle() {
      if (cancelled) return
      isFirstLoad.current = false
      setIsLoading(false)
      setIsReloading(false)
    }

    async function load() {
      if (isFirstLoad.current) setIsLoading(true)
      setIsReloading(true)

      let sid: string
      let activeCourtCount = DEFAULT_COURT_COUNT
      let activeCourtLabels = buildCourtLabels(DEFAULT_COURT_COUNT)

      // The session row and the match list used to be fetched one after the
      // other, because the match query needs a session id. For /live-board/:id
      // that id is in the URL, and for bare /live-board the previous load
      // resolved it — so in both cases a candidate is available up front and
      // the two queries can overlap. If the candidate turns out to be wrong
      // (the active session changed since the last tick) the matches are
      // re-fetched for the real id below, costing one extra trip on the rare
      // load where that happens.
      const candidateSid = sessionIdParam ?? lastSessionId.current

      const sessionQuery = sessionIdParam
        ? supabase.from('sessions').select(SESSION_COLUMNS).eq('id', sessionIdParam).maybeSingle()
        : supabase
            .from('sessions')
            .select(SESSION_COLUMNS)
            .in('status', ['schedule_locked', 'in_progress'])
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

      const [{ data: session }, candidateMatches] = await Promise.all([
        sessionQuery,
        candidateSid ? fetchMatches(candidateSid) : Promise.resolve(null),
      ])

      if (cancelled) return

      if (sessionIdParam) {
        const s = session as { id: string; status: string; court_count?: number | null } | null
        if (!s) {
          setHasSession(false)
          setIsClosed(false)
          setSessionId(null)
          setCourtCount(DEFAULT_COURT_COUNT)
          setCourts(buildEmptyCourts())
          setSplitMatchScoring(false)
          return
        }

        activeCourtCount = normalizeCourtCount(s.court_count)
        activeCourtLabels = buildCourtLabels(activeCourtCount, session)

        if (s.status === 'complete') {
          setHasSession(false)
          setIsClosed(true)
          setSessionId(null)
          setCourtCount(activeCourtCount)
          setCourts(buildCourtSlots(activeCourtCount, activeCourtLabels, new Map(), []))
          setSplitMatchScoring(false)
          return
        }

        sid = s.id
        setSplitMatchScoring((session as { split_match_scoring?: boolean | null }).split_match_scoring === true)
      } else {
        if (!session) {
          setHasSession(false)
          setSessionId(null)
          setCourtCount(DEFAULT_COURT_COUNT)
          setCourts(buildEmptyCourts())
          setSplitMatchScoring(false)
          return
        }

        sid = (session as { id: string }).id
        activeCourtCount = normalizeCourtCount((session as { court_count?: number | null }).court_count)
        activeCourtLabels = buildCourtLabels(activeCourtCount, session)
        setSplitMatchScoring((session as { split_match_scoring?: boolean | null }).split_match_scoring === true)
      }

      setHasSession(true)
      setIsClosed(false)
      setSessionId(sid)
      setCourtCount(activeCourtCount)
      lastSessionId.current = sid

      // Reuse the parallel fetch only if it was aimed at the session we actually
      // resolved; otherwise it is data for a different session and must be discarded.
      let rows = candidateSid === sid ? candidateMatches : null
      if (!rows) {
        rows = await fetchMatches(sid)
        if (cancelled) return
      }

      const matchRows = rows ?? []

      if (matchRows.length === 0) {
        setCourts(buildCourtSlots(activeCourtCount, activeCourtLabels, new Map(), []))
        return
      }

      const allIds = [...new Set(matchRows.flatMap((m) => [
        m.team1_player1_id, m.team1_player2_id,
        m.team2_player1_id, m.team2_player2_id,
      ]))]

      const plan = planProfileFetch(profileCache.current, allIds, Date.now())

      if (plan.ids.length > 0) {
        const { data: profiles, error } = await supabase
          .from('profiles')
          .select(PROFILE_COLUMNS)
          .in('id', plan.ids)

        if (cancelled) return

        // Only commit on success — a failed fetch must not restart the TTL, or
        // one dropped request would extend the stale window by another minute.
        if (!error && profiles) {
          commitProfileFetch(
            profileCache.current,
            profiles as Array<{ id: string; name_slug: string; nickname: string | null; avatar_url: string | null }>,
            plan,
            Date.now(),
          )
        }
      }

      const cachedProfiles = profileCache.current.entries
      const name = (id: string) => {
        const cached = cachedProfiles.get(id)
        return cached ? formatDisplayName(cached.nickname, cached.name_slug) : id
      }
      const player = (id: string): CourtPlayerDisplay => ({
        name: name(id),
        avatarUrl: cachedProfiles.get(id)?.avatar_url ?? null,
      })

      const toDisplay = (m: MatchRow): CourtMatchDisplay => ({
        id: m.id,
        gameNumber: m.queue_position,
        startedAt: m.started_at,
        t1p1: name(m.team1_player1_id),
        t1p2: name(m.team1_player2_id),
        t2p1: name(m.team2_player1_id),
        t2p2: name(m.team2_player2_id),
        team1: [player(m.team1_player1_id), player(m.team1_player2_id)],
        team2: [player(m.team2_player1_id), player(m.team2_player2_id)],
      })

      const currentByCourt = new Map<number, CourtMatchDisplay>()
      for (const match of matchRows) {
        if (match.status !== 'playing' || match.court_number == null || match.court_number > activeCourtCount) continue
        currentByCourt.set(match.court_number, toDisplay(match))
      }

      const queued = matchRows.filter((m) => m.status === 'queued').map(toDisplay)
      const allDone = matchRows.every((m) => m.status === 'complete')

      setCourts(buildCourtSlots(activeCourtCount, activeCourtLabels, currentByCourt, allDone ? [] : queued))
    }

    // `settle` runs on every outcome, including a throw. Without that guarantee a
    // failed load would leave `isReloading` stuck true, silently costing every
    // later finish an extra round trip, and `isLoading` stuck true, leaving the
    // board on its skeleton for good.
    load()
      .catch((error) => { console.error('Failed to load court state', error) })
      .finally(settle)

    return () => { cancelled = true }
  }, [refreshKey, sessionIdParam])

  return { courts, courtCount, sessionId, isLoading, hasSession, isClosed, splitMatchScoring, isReloading, refresh }
}
