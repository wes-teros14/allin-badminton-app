import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { usePlayerSchedule } from '@/hooks/usePlayerSchedule'
import { useRealtime } from '@/hooks/useRealtime'
import { useSessionCheers } from '@/hooks/useSessionCheers'
import { GameCard } from '@/components/GameCard'
import { LiveIndicator } from '@/components/LiveIndicator'
import { PlayerScheduleHeader } from '@/components/PlayerScheduleHeader'
import { SessionRecapBanner } from '@/components/SessionRecapBanner'
import { CheersPanel } from '@/components/CheersPanel'

// ---------------------------------------------------------------------------
// Leaderboard helpers (mirrors TodayView logic, scoped to a single session)
// ---------------------------------------------------------------------------
interface LeaderboardEntry {
  playerId: string
  displayName: string
  wins: number
  games: number
  winRate: number
  careerWinRate?: number
  improvement?: number
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

  const [profilesRes, careerRes] = await Promise.all([
    supabase.from('profiles').select('id, nickname, name_slug').in('id', playerIds),
    supabase.from('player_stats').select('player_id, games_played, wins').in('player_id', playerIds),
  ])

  const nameMap = new Map(
    ((profilesRes.data ?? []) as Array<{ id: string; nickname: string | null; name_slug: string }>)
      .map((p) => [p.id, p.nickname ?? p.name_slug])
  )
  const careerMap = new Map(
    ((careerRes.data ?? []) as Array<{ player_id: string; games_played: number; wins: number }>)
      .map((s) => [s.player_id, { games: s.games_played, wins: s.wins }])
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
    const career = careerMap.get(playerId)
    const careerWinRate = career && career.games > 0 ? Math.round((career.wins / career.games) * 100) : undefined
    entries.push({
      playerId,
      displayName: nameMap.get(playerId) ?? playerId,
      wins: s.wins,
      games: s.games,
      winRate,
      careerWinRate,
      improvement: careerWinRate !== undefined ? winRate - careerWinRate : undefined,
    })
  }

  return entries.sort((a, b) => b.winRate - a.winRate || b.wins - a.wins)
}

const RANK_ICON = (i: number) => (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : String(i + 1))

// ---------------------------------------------------------------------------
// Schedule tab
// ---------------------------------------------------------------------------
function ScheduleTab({ nameSlug, sessionId }: { nameSlug: string; sessionId: string }) {
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

      {!isLoading && resolvedId && (
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
            : `⏳ ${gamesAhead} game${gamesAhead !== 1 ? 's' : ''} until your next game (~${(gamesAhead ?? 0) * 7} mins wait time)`}
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

  const mostImproved = entries
    .filter((e) => e.improvement !== undefined && e.improvement > 0 && e.games >= 2)
    .sort((a, b) => (b.improvement ?? 0) - (a.improvement ?? 0))
    .slice(0, 3)

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

          {mostImproved.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                🔥 Most Improved Today
              </h2>
              <div className="space-y-2">
                {mostImproved.map((entry) => (
                  <div key={entry.playerId} className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3">
                    <span className="flex-1 font-medium text-sm truncate">{entry.displayName}</span>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-green-600">+{entry.improvement}%</p>
                      <p className="text-xs text-muted-foreground">vs {entry.careerWinRate}% career</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------
type Tab = 'schedule' | 'leaderboard' | 'cheers'

const TAB_LABELS: Record<Tab, string> = {
  schedule: 'Schedule',
  leaderboard: 'Leaderboard',
  cheers: 'Cheers',
}

export function SessionPlayerDetailView() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('schedule')
  const [nameSlug, setNameSlug] = useState<string | null>(null)
  const [slugLoading, setSlugLoading] = useState(true)

  const {
    cheerTypes, participants, cheersGiven, cheersReceived,
    isWindowOpen, sessionStatus, isLoading: cheerLoading, submitCheer, refresh: refreshCheers,
  } = useSessionCheers(sessionId)

  const givenReceiverIds = new Set(cheersGiven.map(c => c.receiverId))
  const allCheered = participants.length > 0 && participants.every(p => givenReceiverIds.has(p.playerId))
  const hasPendingCheers = isWindowOpen && !allCheered

  useEffect(() => {
    if (!user) { setSlugLoading(false); return }
    supabase.from('profiles').select('name_slug').eq('id', user.id).maybeSingle().then(({ data }) => {
      setNameSlug((data as { name_slug: string | null } | null)?.name_slug ?? null)
      setSlugLoading(false)
    })
  }, [user])

  // Refresh cheers data when session transitions to complete
  useEffect(() => {
    if (!sessionId) return
    const channel = supabase
      .channel(`session-complete-cheers-${sessionId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}` }, (payload) => {
        if ((payload.new as { status?: string })?.status === 'complete') {
          refreshCheers()
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [sessionId, refreshCheers])

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Tab bar */}
      <div className="flex justify-center items-center gap-1 px-4 py-3 border-b border-border">
        <div className="flex gap-1">
          {(['schedule', 'cheers', 'leaderboard'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`relative px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                tab === t
                  ? t === 'cheers' && hasPendingCheers
                    ? 'bg-yellow-400 text-white'
                    : 'bg-primary text-primary-foreground'
                  : t === 'cheers' && hasPendingCheers
                    ? 'text-yellow-600 hover:text-yellow-700'
                    : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {TAB_LABELS[t]}
              {t === 'cheers' && hasPendingCheers && tab !== 'cheers' && (
                <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-yellow-400 rounded-full" />
              )}
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
          <ScheduleTab nameSlug={nameSlug} sessionId={sessionId} />
        ) : (
          <div className="h-48 flex items-center justify-center">
            <p className="text-muted-foreground text-sm">No schedule found for your account.</p>
          </div>
        )
      )}

      {tab === 'leaderboard' && sessionId && (
        <LeaderboardTab sessionId={sessionId} />
      )}

      {tab === 'cheers' && sessionId && (
        <CheersPanel
          cheerTypes={cheerTypes}
          participants={participants}
          cheersGiven={cheersGiven}
          cheersReceived={cheersReceived}
          isWindowOpen={isWindowOpen}
          sessionStatus={sessionStatus}
          isLoading={cheerLoading}
          submitCheer={submitCheer}
        />
      )}
    </div>
  )
}

export default SessionPlayerDetailView
