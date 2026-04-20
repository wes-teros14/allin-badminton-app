import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { usePlayerSchedule } from '@/hooks/usePlayerSchedule'
import { useRealtime } from '@/hooks/useRealtime'
import { GameCard } from '@/components/GameCard'
import { LiveIndicator } from '@/components/LiveIndicator'
import { PlayerScheduleHeader } from '@/components/PlayerScheduleHeader'
import { SessionRecapBanner } from '@/components/SessionRecapBanner'

// ---------------------------------------------------------------------------
// Leaderboard helpers (mirrors TodayView logic, scoped to a single session)
// ---------------------------------------------------------------------------
interface LeaderboardEntry {
  playerId: string
  displayName: string
  wins: number
  games: number
  winRate: number
}

type MatchRow = {
  team1_player1_id: string
  team1_player2_id: string
  team2_player1_id: string
  team2_player2_id: string
  match_results: Array<{ winning_pair_index: 1 | 2 }>
}

async function fetchLeaderboard(sessionId: string): Promise<LeaderboardEntry[]> {
  const [regsRes, matchesRes] = await Promise.all([
    supabase.from('session_registrations').select('player_id').eq('session_id', sessionId),
    supabase
      .from('matches')
      .select('team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id, match_results(winning_pair_index)')
      .eq('session_id', sessionId)
      .eq('status', 'complete'),
  ])

  const playerIds = ((regsRes.data ?? []) as Array<{ player_id: string }>).map((r) => r.player_id)
  if (playerIds.length === 0) return []

  const profilesRes = await supabase.from('profiles').select('id, nickname, name_slug').in('id', playerIds)

  const nameMap = new Map(
    ((profilesRes.data ?? []) as Array<{ id: string; nickname: string | null; name_slug: string }>)
      .map((p) => [p.id, p.nickname ?? p.name_slug])
  )

  const statsMap = new Map<string, { wins: number; games: number }>(
    playerIds.map((id) => [id, { wins: 0, games: 0 }])
  )

  for (const match of (matchesRes.data ?? []) as MatchRow[]) {
    const result = match.match_results[0]
    if (!result) continue
    const team1 = [match.team1_player1_id, match.team1_player2_id]
    const team2 = [match.team2_player1_id, match.team2_player2_id]
    const winners = result.winning_pair_index === 1 ? team1 : team2
    for (const id of [...team1, ...team2]) {
      const s = statsMap.get(id)
      if (!s) continue
      s.games++
      if (winners.includes(id)) s.wins++
    }
  }

  const entries: LeaderboardEntry[] = []
  for (const [playerId, s] of statsMap) {
    if (s.games === 0) continue
    const winRate = Math.round((s.wins / s.games) * 100)
    entries.push({
      playerId,
      displayName: nameMap.get(playerId) ?? playerId,
      wins: s.wins,
      games: s.games,
      winRate,
    })
  }

  return entries.sort((a, b) => b.winRate - a.winRate || b.wins - a.wins)
}

const RANK_ICON = (i: number) => (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : String(i + 1))

// ---------------------------------------------------------------------------
// Schedule tab
// ---------------------------------------------------------------------------
function ScheduleTab({
  nameSlug,
  sessionId,
  sessionStatus,
  isRegistered,
  isRegistering,
  sessionPrice,
  sessionNotes,
  registrationOpensAt,
  onRegister,
}: {
  nameSlug: string
  sessionId: string
  sessionStatus: string | null
  isRegistered: boolean
  isRegistering: boolean
  sessionPrice: number | null
  sessionNotes: string | null
  registrationOpensAt: string | null
  onRegister: () => void
}) {
  const { matches, playerDisplayName, sessionName, sessionDate, sessionVenue, sessionTime, sessionDuration, sessionId: resolvedId, isLoading, gamesAhead, refresh } = usePlayerSchedule(nameSlug, sessionId)
  const { status } = useRealtime(resolvedId, refresh)

  const firstQueuedIndex = matches.findIndex((m) => m.status === 'queued')
  const playingMatch = matches.find((m) => m.status === 'playing')
  const nextUpMatch = firstQueuedIndex >= 0 ? matches[firstQueuedIndex] : null

  return (
    <div className="relative">
      <LiveIndicator status={status} onRefresh={refresh} />
      <SessionRecapBanner />
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
          sessionId={resolvedId}
        />
      )}

      {/* Registration banner */}
      {sessionStatus === 'registration_open' && (
        <div className="max-w-sm mx-auto px-4 mt-3">
          {isRegistered ? (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-primary/10 border border-primary/20 text-sm text-primary font-medium">
              ✅ You&apos;re registered!
            </div>
          ) : (() => {
            const opensLater = registrationOpensAt && new Date(registrationOpensAt) > new Date()
            const opensLabel = opensLater
              ? new Date(registrationOpensAt!).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) +
                ' · ' + new Date(registrationOpensAt!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              : null
            return (
              <div className="px-4 py-4 rounded-xl border border-border bg-card space-y-3">
                {(sessionPrice != null || sessionNotes) && (
                  <div className="space-y-0.5">
                    {sessionPrice != null && <p className="text-sm font-semibold">₱{sessionPrice}</p>}
                    {sessionNotes && <p className="text-xs text-muted-foreground">{sessionNotes}</p>}
                  </div>
                )}
                {opensLater ? (
                  <div className="w-full py-2.5 rounded-lg bg-muted text-muted-foreground text-sm font-semibold text-center">
                    Opens at {opensLabel}
                  </div>
                ) : (
                  <button
                    onClick={onRegister}
                    disabled={isRegistering}
                    className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold transition-opacity disabled:opacity-50"
                  >
                    {isRegistering ? 'Registering…' : 'Register for this session'}
                  </button>
                )}
              </div>
            )
          })()}
        </div>
      )}

      {!isLoading && resolvedId && sessionStatus !== 'registration_open' && (
        <div className="flex justify-end px-4 mt-2">
          <Link
            to={`/match-schedule/session/${resolvedId}?show=all`}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            All Matches ↗
          </Link>
        </div>
      )}

      {!isLoading && (playingMatch || nextUpMatch) && (
        <div className={`mx-4 mt-3 mb-1 px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 ${
          playingMatch ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
        }`}>
          {playingMatch
            ? "🏸 You're on court now!"
            : gamesAhead === 0
            ? "⏳ You're up next!"
            : `⏳ ${gamesAhead} game${gamesAhead !== 1 ? 's' : ''} until your next game (~${(gamesAhead ?? 0) * 6} mins)`}
        </div>
      )}

      <div className="max-w-sm mx-auto px-4 py-4 flex flex-col gap-3">
        {isLoading
          ? Array.from({ length: 3 }).map((_, i) => (
              <GameCard key={i} gameNumber={0} partnerNameSlug="" opp1NameSlug="" opp2NameSlug="" status="queued" isNextUp={false} isLoading />
            ))
          : matches.map((m, i) => (
              <GameCard
                key={m.id}
                gameNumber={m.gameNumber}
                partnerNameSlug={m.partnerNameSlug}
                opp1NameSlug={m.opp1NameSlug}
                opp2NameSlug={m.opp2NameSlug}
                status={m.status}
                isNextUp={i === firstQueuedIndex}
                won={m.won}
              />
            ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Leaderboard tab
// ---------------------------------------------------------------------------
function LeaderboardTab({ sessionId }: { sessionId: string }) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      setEntries(await fetchLeaderboard(sessionId))
    } finally {
      setIsLoading(false)
    }
  }, [sessionId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const channel = supabase
      .channel(`session-leaderboard-rt-${sessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_results' }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [load, sessionId])

  if (isLoading) {
    return (
      <div className="max-w-sm mx-auto px-4 pt-6 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-14 bg-muted rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="max-w-sm mx-auto px-4 pt-6 pb-10 space-y-6">
      {entries.length === 0 ? (
        <p className="text-muted-foreground text-sm">No games completed yet.</p>
      ) : (
        <>
          <div className="space-y-2">
            {entries.map((entry, i) => (
              <div key={entry.playerId} className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3">
                <span className="text-sm font-bold text-muted-foreground w-5 text-center shrink-0">{RANK_ICON(i)}</span>
                <span className="flex-1 font-medium text-sm truncate">{entry.displayName}</span>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-primary">{entry.winRate}%</p>
                  <p className="text-xs text-muted-foreground">{entry.wins}W {entry.games - entry.wins}L</p>
                </div>
              </div>
            ))}
          </div>

        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------
type Tab = 'schedule' | 'leaderboard'

const TAB_LABELS: Record<Tab, string> = {
  schedule: 'Schedule',
  leaderboard: 'Leaderboard',
}

export function SessionPlayerDetailView() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('schedule')
  const [nameSlug, setNameSlug] = useState<string | null>(null)
  const [slugLoading, setSlugLoading] = useState(true)

  const [isRegistered, setIsRegistered] = useState(false)
  const [isRegistering, setIsRegistering] = useState(false)
  const [sessionStatus, setSessionStatus] = useState<string | null>(null)
  const [sessionPrice, setSessionPrice] = useState<number | null>(null)
  const [sessionNotes, setSessionNotes] = useState<string | null>(null)
  const [registrationOpensAt, setRegistrationOpensAt] = useState<string | null>(null)

  useEffect(() => {
    if (!user) { setSlugLoading(false); return }
    supabase.from('profiles').select('name_slug').eq('id', user.id).maybeSingle().then(({ data }) => {
      setNameSlug((data as { name_slug: string | null } | null)?.name_slug ?? null)
      setSlugLoading(false)
    })
  }, [user])

  // Fetch registration status + session info
  useEffect(() => {
    if (!sessionId || !user) return
    Promise.all([
      supabase.from('sessions').select('status, price, session_notes, registration_opens_at').eq('id', sessionId).maybeSingle(),
      supabase.from('session_registrations').select('player_id').eq('session_id', sessionId).eq('player_id', user.id).maybeSingle(),
    ]).then(([sessionRes, regRes]) => {
      const s = sessionRes.data as { status: string; price: number | null; session_notes: string | null; registration_opens_at: string | null } | null
      setSessionStatus(s?.status ?? null)
      setSessionPrice(s?.price ?? null)
      setSessionNotes(s?.session_notes ?? null)
      setRegistrationOpensAt(s?.registration_opens_at ?? null)
      setIsRegistered(regRes.data != null)
    })
  }, [sessionId, user])

  async function handleRegister() {
    if (!sessionId || !user || isRegistering) return
    setIsRegistering(true)
    const { error } = await supabase
      .from('session_registrations')
      .insert({ session_id: sessionId, player_id: user.id })
    if (error) {
      if (error.message.includes('session_full')) {
        toast.error('Session is full — no more slots available.')
      } else if (error.code === '42501' || error.message.toLowerCase().includes('violates row-level security')) {
        toast.error('Registration is not open yet.')
      } else {
        toast.error(error.message)
      }
    } else {
      setIsRegistered(true)
    }
    setIsRegistering(false)
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Tab bar */}
      <div className="flex justify-center items-center gap-1 px-4 py-3 border-b border-border">
        <div className="flex gap-1">
          {(['schedule', 'leaderboard'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`relative px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                tab === t
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {tab === 'schedule' && (
        slugLoading ? (
          <div className="max-w-sm mx-auto px-4 pt-6 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-14 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        ) : nameSlug && sessionId ? (
          <ScheduleTab
            nameSlug={nameSlug}
            sessionId={sessionId}
            sessionStatus={sessionStatus}
            isRegistered={isRegistered}
            isRegistering={isRegistering}
            sessionPrice={sessionPrice}
            sessionNotes={sessionNotes}
            registrationOpensAt={registrationOpensAt}
            onRegister={handleRegister}
          />
        ) : (
          <div className="h-48 flex items-center justify-center">
            <p className="text-muted-foreground text-sm">No schedule found for your account.</p>
          </div>
        )
      )}

      {tab === 'leaderboard' && sessionId && (
        <LeaderboardTab sessionId={sessionId} />
      )}
    </div>
  )
}

export default SessionPlayerDetailView
