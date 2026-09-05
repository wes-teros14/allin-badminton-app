import { useState, useEffect, useCallback } from 'react'
import { useParams, Link, useNavigate, useSearchParams } from 'react-router'
import { usePlayerList } from '@/hooks/usePlayerList'
import { usePlayerSchedule } from '@/hooks/usePlayerSchedule'
import { useAuth } from '@/hooks/useAuth'
import { usePlayerSessions } from '@/hooks/usePlayerSessions'
import { useRealtime } from '@/hooks/useRealtime'
import { useCourtState } from '@/hooks/useCourtState'
import { PlayerCourtTabs } from '@/components/PlayerCourtTabs'
import { PlayerScheduleHeader } from '@/components/PlayerScheduleHeader'
import { LiveIndicator } from '@/components/LiveIndicator'
import { supabase } from '@/lib/supabase'
import { formatDisplayName } from '@/lib/formatDisplayName'
import { formatElapsed } from '@/utils/matchTiming'
import { useSessionReceipts } from '@/hooks/useSessionReceipts'
import { derivePaymentState } from '@/lib/paymentState'
import { getLegacyWinningPairIndex } from '@/lib/matchResults'
import {
  BoardHeader,
  MatchBoard,
  NoScheduleYet,
  PaymentBanner,
  PersonalGameCard,
  SessionProgress,
  type BoardMatch,
  type BoardPlayer,
} from '@/components/MatchBoard'

interface SessionMeta {
  name: string
  date: string | null
  status: string | null
  venue: string | null
  price: number | null
}

export function PlayerView() {
  const { nameSlug, sessionId } = useParams<{ nameSlug?: string; sessionId?: string }>()

  if (nameSlug) {
    return <ScheduleView nameSlug={nameSlug} sessionId={sessionId} />
  }

  return <PlayerListView sessionId={sessionId} />
}

function SessionPickerView() {
  const { user, isLoading: authLoading } = useAuth()
  const { sessions, isLoading: sessionsLoading } = usePlayerSessions(user?.id ?? null)

  const isLoading = authLoading || sessionsLoading

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="max-w-sm mx-auto px-4 py-8">
          <div className="flex flex-col gap-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (sessions.length === 0) {
    return (
      <div className="h-screen flex items-center justify-center">
        <p className="text-muted-foreground text-lg">No active session</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-sm mx-auto px-4 py-8">
        <p className="text-sm text-muted-foreground mb-3">Select Session</p>
        <div className="flex flex-col gap-2">
          {sessions.map((s) => {
            const formattedDate = new Date(s.date + 'T00:00:00')
              .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              .replace(/^(\w{3})/, '$1.')
            const formattedTime = s.time
              ? new Date(`1970-01-01T${s.time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
              : null
            return (
              <Link
                key={s.id}
                to={`/match-schedule/session/${s.id}`}
                className="w-full flex items-center px-4 py-3 rounded-lg border border-border text-foreground font-medium hover:bg-muted/50 transition-colors"
              >
                <div>
                  <div className="font-bold">{s.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {formattedDate}
                    {formattedTime && <span> · {formattedTime}</span>}
                    {s.duration && <span> · {s.duration} hrs</span>}
                    {s.venue && <span> · {s.venue}</span>}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function PlayerListView({ sessionId }: { sessionId?: string }) {
  const [searchParams] = useSearchParams()
  const showAll = searchParams.get('show') === 'all'

  if (!sessionId) return <SessionPickerView />
  if (showAll) return <AllMatchesView sessionId={sessionId} />
  return <PlayerListViewInner sessionId={sessionId} />
}

function PlayerListViewInner({ sessionId }: { sessionId?: string } = {}) {
  const { user, isLoading: authLoading } = useAuth()
  const navigate = useNavigate()

  const { players, session, isLoading, hasSession } = usePlayerList(sessionId)

  // Auto-redirect logged-in player to their own schedule
  useEffect(() => {
    if (!sessionId || !user || authLoading) return
    let cancelled = false
    async function detect() {
      const { data: profile } = await supabase
        .from('profiles').select('name_slug').eq('id', user!.id).maybeSingle()
      if (cancelled || !profile) return
      const nameSlug = (profile as { name_slug: string | null }).name_slug
      if (!nameSlug) return
      const { data: reg } = await supabase
        .from('session_registrations').select('player_id')
        .eq('session_id', sessionId!).eq('player_id', user!.id).maybeSingle()
      if (cancelled || !reg) return
      navigate(`/match-schedule/session/${sessionId}/${nameSlug}`, { replace: true })
    }
    detect()
    return () => { cancelled = true }
  }, [sessionId, user, authLoading, navigate])

  if (!isLoading && !hasSession) {
    return (
      <div className="h-screen flex items-center justify-center">
        <p className="text-muted-foreground text-lg">No active session</p>
      </div>
    )
  }

  const formattedDate = session?.date
    ? new Date(session.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).replace(/^(\w{3})/, '$1.')
    : ''

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-sm mx-auto px-4 py-8">
        {isLoading ? (
          <div className="mb-6 space-y-1">
            <div className="h-6 w-48 bg-muted rounded animate-pulse" />
            <div className="h-4 w-32 bg-muted rounded animate-pulse" />
          </div>
        ) : session ? (
          <div className="mb-6">
            <h1 className="text-xl font-bold">{session.name}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {formattedDate}
              {session.time && <span> · {session.time}</span>}
              {session.duration && <span> · {session.duration} hrs</span>}
              {session.venue && <span> · {session.venue}</span>}
            </p>
          </div>
        ) : null}

        <p className="text-sm text-muted-foreground mb-3">Select a player to view their schedule</p>

        <div className="flex flex-col gap-2">
          {isLoading
            ? Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />
              ))
            : players.map((p) => (
                <Link
                  key={p.id}
                  to={sessionId
                    ? `/match-schedule/session/${sessionId}/${p.nameSlug}`
                    : `/match-schedule/${p.nameSlug}`}
                  className="w-full h-12 flex items-center px-4 rounded-lg border border-border text-foreground font-medium hover:bg-muted/50 transition-colors"
                >
                  {p.displayName}
                </Link>
              ))}
        </div>
      </div>
    </div>
  )
}

export function AllMatchesView({ sessionId, embedded = false }: { sessionId: string; embedded?: boolean }) {
  const { user, role } = useAuth()
  const [matches, setMatches] = useState<BoardMatch[]>([])
  const [playerNames, setPlayerNames] = useState<string[]>([])
  const [selectedPlayer, setSelectedPlayer] = useState('')
  const [session, setSession] = useState<SessionMeta | null>(null)
  const [registration, setRegistration] = useState<{ paid: boolean | null; playerId: string } | null>(null)
  const [yourGameCount, setYourGameCount] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [tick, setTick] = useState(0)
  const [now, setNow] = useState(() => Date.now())

  const refresh = useCallback(() => setTick((t) => t + 1), [])
  const { status } = useRealtime(sessionId, refresh)

  const { activeReceiptCount } = useSessionReceipts(
    registration ? sessionId : undefined,
    registration?.playerId,
  )
  const paymentState = derivePaymentState({ paid: registration?.paid ?? null, activeReceiptCount })

  // Court timers tick locally; the match rows themselves only change on refresh.
  useEffect(() => {
    if (!matches.some((m) => m.status === 'playing')) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [matches])

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    async function load() {
      const { data: sess } = await supabase
        .from('sessions').select('name, date, status, venue, price').eq('id', sessionId).maybeSingle()
      if (cancelled) return
      if (sess) setSession(sess as SessionMeta)

      // The signed-in player's own registration drives the payment banner. An
      // admin who is not registered simply gets no banner.
      if (user) {
        const { data: reg } = await supabase
          .from('session_registrations').select('paid, player_id')
          .eq('session_id', sessionId).eq('player_id', user.id).maybeSingle()
        if (cancelled) return
        const regRow = reg as { paid: boolean | null; player_id: string } | null
        setRegistration(regRow ? { paid: regRow.paid, playerId: regRow.player_id } : null)
      } else {
        setRegistration(null)
      }

      const { data: rows } = await supabase
        .from('matches')
        .select('id, queue_position, status, court_number, started_at, team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id')
        .eq('session_id', sessionId)
        .order('queue_position')
      if (cancelled || !rows) { setMatches([]); setIsLoading(false); return }

      const matchRows = rows as Array<{
        id: string; queue_position: number; status: string
        court_number: number | null; started_at: string | null
        team1_player1_id: string; team1_player2_id: string
        team2_player1_id: string; team2_player2_id: string
      }>

      // Winners, so a finished game says who won rather than only that it ended.
      const winnerByMatch = new Map<string, 1 | 2>()
      if (matchRows.length > 0) {
        const { data: results } = await supabase
          .from('match_results').select('match_id, winning_pair_index, game_number')
          .in('match_id', matchRows.map((m) => m.id))
        if (cancelled) return
        const grouped = new Map<string, Array<{ winning_pair_index: number; game_number: number | null }>>()
        for (const r of (results ?? []) as Array<{ match_id: string; winning_pair_index: number; game_number: number | null }>) {
          const list = grouped.get(r.match_id) ?? []
          list.push({ winning_pair_index: r.winning_pair_index, game_number: r.game_number })
          grouped.set(r.match_id, list)
        }
        for (const [matchId, list] of grouped) {
          const index = getLegacyWinningPairIndex(list)
          if (index) winnerByMatch.set(matchId, index)
        }
      }

      const allIds = [...new Set(matchRows.flatMap((m) => [m.team1_player1_id, m.team1_player2_id, m.team2_player1_id, m.team2_player2_id]))]
      const { data: profiles } = await supabase.from('profiles').select('id, name_slug, nickname, avatar_url').in('id', allIds)
      if (cancelled) return
      type ProfileRow = { id: string; name_slug: string; nickname: string | null; avatar_url: string | null }
      const profileRows = (profiles ?? []) as ProfileRow[]
      const nameMap = new Map(profileRows.map((p) => [p.id, formatDisplayName(p.nickname, p.name_slug)]))
      const avatarMap = new Map(profileRows.map((p) => [p.id, p.avatar_url]))
      const player = (id: string): BoardPlayer => ({ name: nameMap.get(id) ?? '?', avatarUrl: avatarMap.get(id) ?? null })

      setPlayerNames([...nameMap.values()].sort((a, b) => a.localeCompare(b)))
      setYourGameCount(
        user ? matchRows.filter((m) => [m.team1_player1_id, m.team1_player2_id, m.team2_player1_id, m.team2_player2_id].includes(user.id)).length : null,
      )

      setMatches(matchRows.map((m) => ({
        id: m.id,
        gameNumber: m.queue_position,
        status: m.status as BoardMatch['status'],
        courtNumber: m.court_number,
        startedAt: m.started_at,
        winningPairIndex: winnerByMatch.get(m.id) ?? null,
        team1: [player(m.team1_player1_id), player(m.team1_player2_id)],
        team2: [player(m.team2_player1_id), player(m.team2_player2_id)],
      })))
      setIsLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [sessionId, tick, user])

  const visible = selectedPlayer
    ? matches.filter((m) => [...m.team1, ...m.team2].some((p) => p.name === selectedPlayer))
    : matches

  const played = visible.filter((m) => m.status === 'complete').length
  const liveCount = visible.filter((m) => m.status === 'playing').length
  const sessionStarted = session?.status === 'in_progress' || session?.status === 'complete'

  const elapsedByMatchId: Record<string, string> = {}
  for (const m of matches) {
    if (m.status === 'playing' && m.startedAt) {
      elapsedByMatchId[m.id] = formatElapsed(Math.max(0, Math.floor((now - new Date(m.startedAt).getTime()) / 1000)))
    }
  }

  return (
    <div className={embedded ? 'relative' : 'min-h-screen bg-background text-foreground relative'}>
      {!embedded && <LiveIndicator status={status} onRefresh={refresh} />}
      <div className={`max-w-sm mx-auto px-4 ${embedded ? 'py-4' : 'py-8'}`}>
        <BoardHeader
          sessionName={session?.name ?? ''}
          sessionDate={session?.date ?? null}
          sessionStatus={session?.status ?? null}
          venue={session?.venue ?? null}
          played={played}
          total={visible.length}
          liveCount={liveCount}
        />

        {/* Its own row: LiveIndicator is `absolute top-3 right-4`, so anything
            sharing the header's top-right corner sits underneath it. Embedded in
            a tab there is nothing to go back to — the tab bar is the way out. */}
        {!embedded && (
          <div className="mt-2 flex justify-end">
            <Link
              to={`/match-schedule/session/${sessionId}`}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              ← My Matches
            </Link>
          </div>
        )}

        {registration && !embedded && (
          <PaymentBanner
            paymentState={paymentState}
            price={session?.price ?? null}
            sessionId={sessionId}
            yourGameCount={yourGameCount}
            scheduleDrawn={matches.length > 0}
          />
        )}

        {role === 'admin' && !isLoading && playerNames.length > 0 && (
          <select
            value={selectedPlayer}
            onChange={(e) => setSelectedPlayer(e.target.value)}
            aria-label="Filter by player"
            className="mt-3 w-full h-9 rounded-lg border border-input bg-background text-foreground px-3 text-sm"
          >
            <option value="">All players</option>
            {playerNames.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        )}

        {isLoading ? (
          <div className="mt-5 flex flex-col gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        ) : matches.length === 0 ? (
          <NoScheduleYet paymentState={paymentState} registered={registration != null} />
        ) : (
          <MatchBoard matches={visible} sessionStarted={sessionStarted} elapsedByMatchId={elapsedByMatchId} />
        )}
      </div>
    </div>
  )
}

function ScheduleView({ nameSlug, sessionId: sessionIdParam }: { nameSlug: string; sessionId?: string }) {
  const { matches, playerDisplayName, playerAvatarUrl, sessionMatchTotal, sessionMatchPlayed, sessionName, sessionDate, sessionVenue, sessionTime, sessionDuration, sessionId, sessionStatus, isLoading, notFound, refresh } = usePlayerSchedule(nameSlug, sessionIdParam)
  const {
    courts,
    isLoading: courtsLoading,
    refresh: refreshCourts,
  } = useCourtState(sessionId || undefined)
  const refreshAll = useCallback(() => {
    refresh()
    refreshCourts()
  }, [refresh, refreshCourts])
  const { status } = useRealtime(sessionId, refreshAll)

  if (!isLoading && notFound) {
    return (
      <div className="h-screen flex items-center justify-center">
        <p className="text-muted-foreground text-lg">Player not found</p>
      </div>
    )
  }

  // Find the first queued match index to mark as "up next"
  const firstQueuedIndex = matches.findIndex((m) => m.status === 'queued')
  const playingMatch = matches.find((m) => m.status === 'playing')
  const nextUpMatch = firstQueuedIndex >= 0 ? matches[firstQueuedIndex] : null

  return (
    <div className="min-h-screen bg-background text-foreground relative">
      <LiveIndicator status={status} onRefresh={refreshAll} />
      {isLoading ? (
        <div className="bg-primary px-4 py-5 animate-pulse">
          <div className="h-7 w-32 bg-primary-foreground/30 rounded mb-1" />
          <div className="h-4 w-48 bg-primary-foreground/20 rounded" />
        </div>
      ) : (
        <PlayerScheduleHeader
          nameSlug={playerDisplayName}
          sessionName={sessionName}
          sessionDate={sessionDate}
          sessionVenue={sessionVenue}
          sessionTime={sessionTime}
          sessionDuration={sessionDuration}
          gameCount={matches.length}
          sessionId={sessionId}
        />
      )}

      {!isLoading && sessionId && (
        <div className="flex justify-end px-4 mt-2">
          <Link
            to={`/match-schedule/session/${sessionId}?show=all`}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            All Matches ↗
          </Link>
        </div>
      )}

      {!isLoading && (playingMatch || (nextUpMatch && nextUpMatch.gameNumber <= 2)) && (
        <div className={`mx-4 mt-3 mb-1 px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 ${
          playingMatch
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-foreground'
        }`}>
          {playingMatch
            ? '🏸 It\'s your turn! Please head to the court now.'
            : '🏃 Your match is one of the first — late arrivals may result in fewer games played.'
          }
        </div>
      )}

      {!isLoading && sessionId && sessionStatus !== 'registration_open' && (
        <div className="max-w-sm mx-auto px-4 pt-4">
          <PlayerCourtTabs courts={courts} isLoading={courtsLoading} />
        </div>
      )}

      <div className="max-w-sm mx-auto px-4 py-4">
        <SessionProgress
          sessionPlayed={sessionMatchPlayed}
          sessionTotal={sessionMatchTotal}
          yourPlayed={matches.filter((m) => m.status === 'complete').length}
          yourTotal={matches.length}
        />

        {isLoading
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-[86px] rounded-xl bg-muted animate-pulse" />
            ))
          : matches.map((m, i) => (
              // Your live game is already a full card in the court strip above,
              // so rendering it again here just duplicates a court.
              m.status === 'playing' ? null : (
                <PersonalGameCard
                  key={m.id}
                  match={m}
                  you={playerDisplayName}
                  yourAvatarUrl={playerAvatarUrl}
                  isNextUp={i === firstQueuedIndex}
                  promote={!playingMatch && i === firstQueuedIndex}
                />
              )
            ))}
      </div>
    </div>
  )
}

export default PlayerView
