import { useState, useEffect, useCallback, useRef } from 'react'
import { sortMatchResults } from '@/lib/matchResults'
import { supabase } from '@/lib/supabase'

export interface PlayerMatch {
  id: string
  gameNumber: number
  status: 'queued' | 'playing' | 'complete'
  partnerNameSlug: string
  opp1NameSlug: string
  opp2NameSlug: string
  partnerAvatarUrl: string | null
  opp1AvatarUrl: string | null
  opp2AvatarUrl: string | null
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
  const [refreshKey, setRefreshKey] = useState(0)
  const isFirstLoad = useRef(true)

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (isFirstLoad.current) setIsLoading(true)
      setNotFound(false)

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
          .from('sessions').select('id, name, date, venue, time, duration, status, court_count')
          .eq('id', sessionIdOverride).maybeSingle()
        if (cancelled || !session) { setIsLoading(false); return }
        const s = session as { id: string; name: string; date: string; venue: string | null; time: string | null; duration: string | null; status: string; court_count?: number | null }
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
          .select('id, name, date, venue, time, duration, status, court_count')
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

        const s = session as { id: string; name: string; date: string; venue: string | null; time: string | null; duration: string | null; status: string; court_count?: number | null }
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
        .select('id, name_slug, nickname, avatar_url')
        .in('id', allIds)

      if (cancelled) return

      type ProfileRow = { id: string; name_slug: string; nickname: string | null; avatar_url: string | null }
      const nameMap = new Map(
        ((profiles ?? []) as ProfileRow[])
          .map((profileRow) => [profileRow.id, profileRow.nickname ?? profileRow.name_slug])
      )
      const avatarMap = new Map(
        ((profiles ?? []) as ProfileRow[])
          .map((profileRow) => [profileRow.id, profileRow.avatar_url])
      )
      const name = (id: string) => nameMap.get(id) ?? id
      const avatar = (id: string) => avatarMap.get(id) ?? null

      // 5. Build PlayerMatch array
      const result: PlayerMatch[] = matchRows.map((match) => {
        const onTeam1 = match.team1_player1_id === playerId || match.team1_player2_id === playerId

        let partnerNameSlug: string
        let opp1NameSlug: string
        let opp2NameSlug: string
        let partnerId: string
        let opp1Id: string
        let opp2Id: string

        if (onTeam1) {
          partnerId = match.team1_player1_id === playerId ? match.team1_player2_id : match.team1_player1_id
          opp1Id = match.team2_player1_id
          opp2Id = match.team2_player2_id
        } else {
          partnerId = match.team2_player1_id === playerId ? match.team2_player2_id : match.team2_player1_id
          opp1Id = match.team1_player1_id
          opp2Id = match.team1_player2_id
        }

        partnerNameSlug = name(partnerId)
        opp1NameSlug = name(opp1Id)
        opp2NameSlug = name(opp2Id)

        return {
          id: match.id,
          gameNumber: match.queue_position,
          status: match.status,
          partnerNameSlug,
          opp1NameSlug,
          opp2NameSlug,
          partnerAvatarUrl: avatar(partnerId),
          opp1AvatarUrl: avatar(opp1Id),
          opp2AvatarUrl: avatar(opp2Id),
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

      isFirstLoad.current = false
      setIsLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [nameSlug, sessionIdOverride, refreshKey])

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
    refresh,
  }
}
