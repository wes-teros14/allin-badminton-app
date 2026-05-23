import { useState, useEffect, useCallback, useRef } from 'react'
import { sortMatchResults } from '@/lib/matchResults'
import { supabase } from '@/lib/supabase'

const AVG_GAME_SECS = 11 * 60 // average game duration in seconds

export interface PlayerMatch {
  id: string
  gameNumber: number
  status: 'queued' | 'playing' | 'complete'
  partnerNameSlug: string
  opp1NameSlug: string
  opp2NameSlug: string
  outcome: 'won' | 'lost' | 'draw' | null
  won: boolean | null
}

interface UsePlayerScheduleResult {
  matches: PlayerMatch[]
  playerDisplayName: string
  sessionName: string
  sessionDate: string
  sessionVenue: string | null
  sessionTime: string | null
  sessionDuration: string | null
  sessionId: string | null
  sessionStatus: string | null
  isLoading: boolean
  notFound: boolean
  gamesAhead: number | null
  waitSeconds: number | null
  refresh: () => void
}

type MatchRow = {
  id: string
  queue_position: number
  status: 'queued' | 'playing' | 'complete'
  team1_player1_id: string
  team1_player2_id: string
  team2_player1_id: string
  team2_player2_id: string
}

export function usePlayerSchedule(nameSlug: string, sessionIdOverride?: string | null): UsePlayerScheduleResult {
  const [matches, setMatches] = useState<PlayerMatch[]>([])
  const [playerDisplayName, setPlayerDisplayName] = useState('')
  const [sessionName, setSessionName] = useState('')
  const [sessionDate, setSessionDate] = useState('')
  const [sessionVenue, setSessionVenue] = useState<string | null>(null)
  const [sessionTime, setSessionTime] = useState<string | null>(null)
  const [sessionDuration, setSessionDuration] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [sessionStatus, setSessionStatus] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [gamesAhead, setGamesAhead] = useState<number | null>(null)
  const [waitSeconds, setWaitSeconds] = useState<number | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const isFirstLoad = useRef(true)
  const earliestStartedAtRef = useRef<string | null>(null)
  const staticExtraSecsRef = useRef<number>(0)
  const waitTierRef = useRef<'none' | 'zero' | 'dynamic'>('none')

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (isFirstLoad.current) setIsLoading(true)
      setNotFound(false)
      setGamesAhead(null)

      // 1. Resolve nameSlug to player id
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, name_slug, nickname')
        .eq('name_slug', nameSlug)
        .maybeSingle()

      if (cancelled) return

      if (!profile) {
        setNotFound(true)
        setIsLoading(false)
        return
      }

      const p = profile as { id: string; name_slug: string; nickname: string | null }
      const playerId = p.id
      setPlayerDisplayName(p.nickname ?? p.name_slug)

      // 2. Find active session (or use override)
      let sid: string

      if (sessionIdOverride) {
        sid = sessionIdOverride
        const { data: session } = await supabase
          .from('sessions').select('id, name, date, venue, time, duration, status')
          .eq('id', sessionIdOverride).maybeSingle()
        if (cancelled || !session) { setIsLoading(false); return }
        const s = session as { id: string; name: string; date: string; venue: string | null; time: string | null; duration: string | null; status: string }
        setSessionId(s.id)
        setSessionName(s.name)
        setSessionDate(s.date)
        setSessionVenue(s.venue)
        setSessionTime(s.time)
        setSessionDuration(s.duration)
        setSessionStatus(s.status)
      } else {
        const { data: session } = await supabase
          .from('sessions')
          .select('id, name, date, venue, time, duration, status')
          .in('status', ['schedule_locked', 'in_progress'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (cancelled) return

        if (!session) {
          setMatches([])
          setSessionId(null)
          setIsLoading(false)
          return
        }

        const s = session as { id: string; name: string; date: string; venue: string | null; time: string | null; duration: string | null; status: string }
        setSessionId(s.id)
        setSessionName(s.name)
        setSessionDate(s.date)
        setSessionVenue(s.venue)
        setSessionTime(s.time)
        setSessionDuration(s.duration)
        setSessionStatus(s.status)
        sid = s.id
      }

      // 3. Fetch this player's matches
      const { data: rows } = await supabase
        .from('matches')
        .select('id, queue_position, status, team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id')
        .eq('session_id', sid)
        .or(`team1_player1_id.eq.${playerId},team1_player2_id.eq.${playerId},team2_player1_id.eq.${playerId},team2_player2_id.eq.${playerId}`)
        .order('queue_position')

      if (cancelled) return

      const matchRows = (rows ?? []) as MatchRow[]

      if (matchRows.length === 0) {
        setMatches([])
        isFirstLoad.current = false
        setIsLoading(false)
        return
      }

      // 4. Resolve all player IDs to display names
      const allIds = [...new Set(matchRows.flatMap((m) => [
        m.team1_player1_id, m.team1_player2_id,
        m.team2_player1_id, m.team2_player2_id,
      ]))]

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name_slug, nickname')
        .in('id', allIds)

      if (cancelled) return

      const nameMap = new Map(
        ((profiles ?? []) as Array<{ id: string; name_slug: string; nickname: string | null }>)
          .map((profileRow) => [profileRow.id, profileRow.nickname ?? profileRow.name_slug])
      )
      const name = (id: string) => nameMap.get(id) ?? id

      // 5. Build PlayerMatch array
      const result: PlayerMatch[] = matchRows.map((match) => {
        const onTeam1 = match.team1_player1_id === playerId || match.team1_player2_id === playerId

        let partnerNameSlug: string
        let opp1NameSlug: string
        let opp2NameSlug: string

        if (onTeam1) {
          partnerNameSlug = name(
            match.team1_player1_id === playerId ? match.team1_player2_id : match.team1_player1_id
          )
          opp1NameSlug = name(match.team2_player1_id)
          opp2NameSlug = name(match.team2_player2_id)
        } else {
          partnerNameSlug = name(
            match.team2_player1_id === playerId ? match.team2_player2_id : match.team2_player1_id
          )
          opp1NameSlug = name(match.team1_player1_id)
          opp2NameSlug = name(match.team1_player2_id)
        }

        return {
          id: match.id,
          gameNumber: match.queue_position,
          status: match.status,
          partnerNameSlug,
          opp1NameSlug,
          opp2NameSlug,
          outcome: null,
          won: null,
        }
      })

      // 6. Batch-fetch match results for completed matches
      const completedIds = matchRows.filter((match) => match.status === 'complete').map((match) => match.id)
      if (completedIds.length > 0) {
        const { data: resultsData } = await supabase
          .from('match_results')
          .select('match_id, winning_pair_index, game_number')
          .in('match_id', completedIds)

        if (!cancelled && resultsData) {
          const resultMap = new Map<string, Array<{ winning_pair_index: number; game_number: number | null }>>()

          for (const resultRow of resultsData as Array<{ match_id: string; winning_pair_index: number; game_number: number | null }>) {
            const matchResults = resultMap.get(resultRow.match_id) ?? []
            matchResults.push({
              winning_pair_index: resultRow.winning_pair_index,
              game_number: resultRow.game_number,
            })
            resultMap.set(resultRow.match_id, matchResults)
          }

          for (const playerMatch of result) {
            if (playerMatch.status !== 'complete') continue
            const matchResults = sortMatchResults(resultMap.get(playerMatch.id))
            if (matchResults.length === 0) continue

            const row = matchRows.find((match) => match.id === playerMatch.id)
            if (!row) continue

            const onTeam1 = row.team1_player1_id === playerId || row.team1_player2_id === playerId
            const playerTeamIndex = onTeam1 ? 1 : 2
            const winCount = matchResults.filter((resultRow) => resultRow.winning_pair_index === playerTeamIndex).length

            if (winCount === matchResults.length) {
              playerMatch.outcome = 'won'
              playerMatch.won = true
            } else if (winCount === 0) {
              playerMatch.outcome = 'lost'
              playerMatch.won = false
            } else {
              playerMatch.outcome = 'draw'
              playerMatch.won = null
            }
          }
        }
      }

      setMatches(result)

      // Wait time anchored to highest currently-playing game in the session
      const firstQueuedMatch = result.find((match) => match.status === 'queued')
      if (firstQueuedMatch) {
        const yourGame = firstQueuedMatch.gameNumber

        const { data: playingRows } = await supabase
          .from('matches')
          .select('queue_position, started_at')
          .eq('session_id', sid)
          .eq('status', 'playing')

        if (cancelled) return

        type PlayingRow = { queue_position: number; started_at: string | null }
        const currentPlayingRows = (playingRows ?? []) as PlayingRow[]

        const highestPlaying = currentPlayingRows.length > 0
          ? Math.max(...currentPlayingRows.map((playingRow) => playingRow.queue_position))
          : 2

        const startedAts = currentPlayingRows
          .map((playingRow) => playingRow.started_at)
          .filter((startedAt): startedAt is string => startedAt !== null)
          .sort()

        const earliestStartedAt = startedAts[0] ?? null
        const latestStartedAt = startedAts[startedAts.length - 1] ?? null

        const gap = Math.max(0, yourGame - highestPlaying - 1)

        const staticExtraSecs = yourGame > highestPlaying + 2
          ? 6 * 60 * Math.ceil((yourGame - highestPlaying - 2) / 2)
          : 0

        // Next in queue: earliest started = which court frees soonest
        // Further back: latest started = when the current rotation ends (the slower court)
        const baseStartedAt = gap === 0 ? earliestStartedAt : latestStartedAt

        earliestStartedAtRef.current = baseStartedAt
        staticExtraSecsRef.current = staticExtraSecs
        waitTierRef.current = yourGame <= highestPlaying ? 'zero' : 'dynamic'

        const remainingSecs = baseStartedAt
          ? Math.max(0, AVG_GAME_SECS - (Date.now() - new Date(baseStartedAt).getTime()) / 1000)
          : AVG_GAME_SECS

        setGamesAhead(gap)

        if (yourGame <= highestPlaying) {
          setWaitSeconds(0)
        } else {
          setWaitSeconds(Math.round(remainingSecs) + staticExtraSecs)
        }
      } else {
        setGamesAhead(null)
        setWaitSeconds(null)
        waitTierRef.current = 'none'
      }

      isFirstLoad.current = false
      setIsLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [nameSlug, sessionIdOverride, refreshKey])

  // Tick waitSeconds down every second using stored refs (no DB queries)
  useEffect(() => {
    const id = setInterval(() => {
      if (waitTierRef.current === 'none') return
      if (waitTierRef.current === 'zero') {
        setWaitSeconds(0)
        return
      }

      const remainingSecs = earliestStartedAtRef.current
        ? Math.max(0, AVG_GAME_SECS - (Date.now() - new Date(earliestStartedAtRef.current).getTime()) / 1000)
        : AVG_GAME_SECS

      setWaitSeconds(Math.round(remainingSecs) + staticExtraSecsRef.current)
    }, 1000)

    return () => clearInterval(id)
  }, [])

  return {
    matches,
    playerDisplayName,
    sessionName,
    sessionDate,
    sessionVenue,
    sessionTime,
    sessionDuration,
    sessionId,
    sessionStatus,
    isLoading,
    notFound,
    gamesAhead,
    waitSeconds,
    refresh,
  }
}
