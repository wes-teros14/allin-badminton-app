import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router'
import { supabase } from '@/lib/supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface LeaderboardEntry {
  playerId: string
  displayName: string
  wins: number
  losses: number
  points: number
}

interface CheerLeaderboardEntry {
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

type Tab = 'wins' | 'cheers' | 'awards'

interface AwardEntry {
  emoji: string
  label: string
  holder: string | null
  value: number
}

const RANK_ICON = (i: number) => (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : String(i + 1))

// ---------------------------------------------------------------------------
// Data fetchers
// ---------------------------------------------------------------------------
async function fetchAllTimeLeaderboard(): Promise<LeaderboardEntry[]> {
  const [statsRes, profilesRes] = await Promise.all([
    supabase.from('player_stats').select('player_id, games_played, wins').gt('games_played', 0),
    supabase.from('profiles').select('id, nickname, name_slug').eq('is_active', true),
  ])

  const nameMap = new Map(
    ((profilesRes.data ?? []) as Array<{ id: string; nickname: string | null; name_slug: string }>)
      .map((p) => [p.id, p.nickname ?? p.name_slug])
  )

  return ((statsRes.data ?? []) as Array<{ player_id: string; games_played: number; wins: number }>)
    .filter((s) => nameMap.has(s.player_id))
    .map((s) => {
      const losses = s.games_played - s.wins
      return {
        playerId: s.player_id,
        displayName: nameMap.get(s.player_id)!,
        wins: s.wins,
        losses,
        points: s.wins * 2 - losses,
      }
    })
    .sort((a, b) => b.points - a.points || b.wins - a.wins)
    .slice(0, 10)
}

async function fetchCheerLeaderboard(): Promise<CheerLeaderboardEntry[]> {
  const [statsRes, profilesRes] = await Promise.all([
    supabase.from('player_cheer_stats').select('*').gt('cheers_received', 0),
    supabase.from('profiles').select('id, nickname, name_slug').eq('is_active', true),
  ])

  const nameMap = new Map(
    ((profilesRes.data ?? []) as Array<{ id: string; nickname: string | null; name_slug: string }>)
      .map(p => [p.id, p.nickname ?? p.name_slug])
  )

  const CHEER_EXCLUDED = new Set(['d3def74c-7367-4553-af30-eaa58e45ddb7', '8e48d7bf-c7dc-45a5-a468-7ee9b81db677'])

  return ((statsRes.data ?? []) as any[])
    .filter(s => !CHEER_EXCLUDED.has(s.player_id) && nameMap.has(s.player_id))
    .map(s => ({
      ...s,
      displayName: nameMap.get(s.player_id)!,
    }))
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function WinsLeaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    setIsLoading(true)
    try { setEntries(await fetchAllTimeLeaderboard()) }
    finally { setIsLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  return isLoading ? (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-14 bg-muted rounded-xl animate-pulse" />
      ))}
    </div>
  ) : entries.length === 0 ? (
    <p className="text-muted-foreground text-sm">No stats recorded yet.</p>
  ) : (
    <div className="space-y-2">
      {entries.map((entry, i) => (
        <div key={entry.playerId} className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3">
          <span className="text-sm font-bold text-muted-foreground w-5 text-center shrink-0">
            {RANK_ICON(i)}
          </span>
          <span className="flex-1 font-medium text-sm truncate">{entry.displayName}</span>
          <div className="text-right shrink-0">
            <p className="text-sm font-bold text-primary">{entry.points} pts</p>
            <p className="text-xs text-muted-foreground">{entry.wins}W {entry.losses}L</p>
          </div>
        </div>
      ))}
      <p className="text-xs text-muted-foreground text-center pt-2">
        +2 per win, −1 per loss
      </p>
    </div>
  )
}

function CheerRankList({
  label,
  entries,
  getValue,
  unit,
}: {
  label: string
  entries: CheerLeaderboardEntry[]
  getValue: (e: CheerLeaderboardEntry) => number
  unit: string
}) {
  const sorted = [...entries].filter(e => getValue(e) > 0).sort((a, b) => getValue(b) - getValue(a)).slice(0, 5)
  if (sorted.length === 0) return null
  return (
    <div>
      <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">{label}</h2>
      <div className="space-y-2">
        {sorted.map((entry, i) => (
          <div key={entry.player_id} className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3">
            <span className="text-sm font-bold text-muted-foreground w-5 text-center shrink-0">
              {RANK_ICON(i)}
            </span>
            <span className="flex-1 font-medium text-sm truncate">{entry.displayName}</span>
            <span className="text-sm font-bold text-primary shrink-0">{getValue(entry)} {unit}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function CheersLeaderboard() {
  const [entries, setEntries] = useState<CheerLeaderboardEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    setIsLoading(true)
    try { setEntries(await fetchCheerLeaderboard()) }
    finally { setIsLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-14 bg-muted rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  if (entries.length === 0) {
    return <p className="text-muted-foreground text-sm">No cheers recorded yet.</p>
  }

  return (
    <div className="space-y-6">
      <CheerRankList label="Most Cheers Received" entries={entries} getValue={e => e.cheers_received} unit="received" />
      <CheerRankList label="Most Cheers Given" entries={entries} getValue={e => e.cheers_given} unit="given" />
      <CheerRankList label="⚔️ Fierce Offense" entries={entries} getValue={e => e.offense_received} unit="received" />
      <CheerRankList label="🛡️ Iron Defense" entries={entries} getValue={e => e.defense_received} unit="received" />
      <CheerRankList label="🎯 Smooth Technique" entries={entries} getValue={e => e.technique_received} unit="received" />
      <CheerRankList label="💨 Swift Movement" entries={entries} getValue={e => e.movement_received} unit="received" />
      <CheerRankList label="🤝 Good Sport" entries={entries} getValue={e => e.good_sport_received} unit="received" />
      <CheerRankList label="💪 Solid Effort" entries={entries} getValue={e => e.solid_effort_received} unit="received" />
    </div>
  )
}

async function fetchAwardsLeaderboard(): Promise<AwardEntry[]> {
  const latestSessionRes = await supabase
    .from('sessions')
    .select('id')
    .neq('status', 'setup')
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle()
  const latestSessionId = (latestSessionRes.data as { id: string } | null)?.id ?? null
  console.log('[EarlyBird] latestSessionRes:', latestSessionRes.data, 'error:', latestSessionRes.error)

  const [cheerRes, statsRes, profilesRes, cheerTimestampsRes, sessionsRes, earlyBirdRes] = await Promise.all([
    supabase.from('player_cheer_stats').select('player_id, cheers_received, cheers_given, offense_received, defense_received, technique_received, movement_received, good_sport_received, solid_effort_received'),
    supabase.from('player_stats').select('player_id, sessions_attended'),
    supabase.from('profiles').select('id, nickname, name_slug').eq('is_active', true),
    supabase.from('cheers').select('receiver_id, giver_id, created_at').order('created_at', { ascending: false }),
    supabase.from('sessions').select('id').eq('status', 'complete').order('date', { ascending: true }),
    latestSessionId
      ? supabase.from('session_registrations').select('player_id').eq('session_id', latestSessionId).eq('source', 'self').order('registered_at', { ascending: true }).limit(1).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const nameMap = new Map(
    ((profilesRes.data ?? []) as Array<{ id: string; nickname: string | null; name_slug: string }>)
      .map(p => [p.id, p.nickname ?? p.name_slug])
  )

  const cheers = ((cheerRes.data ?? []) as Array<{ player_id: string; cheers_received: number; cheers_given: number; offense_received: number; defense_received: number; technique_received: number; movement_received: number; good_sport_received: number; solid_effort_received: number }>)
    .filter(s => nameMap.has(s.player_id))
  const stats = ((statsRes.data ?? []) as Array<{ player_id: string; sessions_attended: number }>)
    .filter(s => nameMap.has(s.player_id))
  const earlyBirdPlayerId = (earlyBirdRes.data as { player_id: string } | null)?.player_id ?? null
  console.log('[EarlyBird] earlyBirdRes:', earlyBirdRes.data, 'error:', (earlyBirdRes as { error?: unknown }).error)
  let earlyBirdName: string | null = earlyBirdPlayerId ? (nameMap.get(earlyBirdPlayerId) ?? null) : null
  if (earlyBirdPlayerId && !earlyBirdName) {
    const pRes = await supabase.from('profiles').select('nickname, name_slug').eq('id', earlyBirdPlayerId).maybeSingle()
    const p = pRes.data as { nickname: string | null; name_slug: string } | null
    earlyBirdName = p ? (p.nickname ?? p.name_slug) : null
  }
  const cheerTimestamps = (cheerTimestampsRes.data ?? []) as Array<{ receiver_id: string; giver_id: string; created_at: string }>

  // Tiebreaker maps: latest activity timestamp per player
  const latestReceivedAt = new Map<string, string>()
  const latestGivenAt = new Map<string, string>()
  for (const c of cheerTimestamps) {
    if (!latestReceivedAt.has(c.receiver_id)) latestReceivedAt.set(c.receiver_id, c.created_at)
    if (!latestGivenAt.has(c.giver_id)) latestGivenAt.set(c.giver_id, c.created_at)
  }

  function topHolder(arr: Array<{ player_id: string; value: number }>, tiebreaker?: Map<string, string>): { holder: string | null; value: number } {
    if (arr.length === 0) return { holder: null, value: 0 }
    const sorted = [...arr].filter(a => a.value > 0).sort((a, b) => {
      if (b.value !== a.value) return b.value - a.value
      const ta = tiebreaker?.get(a.player_id) ?? ''
      const tb = tiebreaker?.get(b.player_id) ?? ''
      return tb.localeCompare(ta)
    })
    if (sorted.length === 0) return { holder: null, value: 0 }
    return { holder: nameMap.get(sorted[0].player_id) ?? null, value: sorted[0].value }
  }

  // Consecutive sessions streak per player
  const STREAK_EXCLUDED = new Set(['d3def74c-7367-4553-af30-eaa58e45ddb7', '8e48d7bf-c7dc-45a5-a468-7ee9b81db677'])
  const completedSessionIds = ((sessionsRes.data ?? []) as Array<{ id: string }>).map(s => s.id)
  const allRegsRes = await supabase.from('session_registrations').select('session_id, player_id').in('session_id', completedSessionIds)
  const playerSessions = new Map<string, Set<string>>()
  for (const r of (allRegsRes.data ?? []) as Array<{ session_id: string; player_id: string }>) {
    if (STREAK_EXCLUDED.has(r.player_id)) continue
    if (!playerSessions.has(r.player_id)) playerSessions.set(r.player_id, new Set())
    playerSessions.get(r.player_id)!.add(r.session_id)
  }
  const streakEntries: Array<{ player_id: string; value: number }> = []
  for (const [playerId, attended] of playerSessions) {
    let maxStreak = 0
    let streak = 0
    for (const sid of completedSessionIds) {
      if (attended.has(sid)) { streak++; if (streak > maxStreak) maxStreak = streak }
      else streak = 0
    }
    if (maxStreak >= 2) streakEntries.push({ player_id: playerId, value: maxStreak })
  }

  const awards: AwardEntry[] = [
    // System-generated awards first
    { emoji: '📅', label: 'Most Sessions Joined', ...topHolder(stats.filter(s => !STREAK_EXCLUDED.has(s.player_id)).map(s => ({ player_id: s.player_id, value: s.sessions_attended }))) },
    { emoji: '🔥', label: 'Attendance Streak', ...topHolder(streakEntries) },
    { emoji: '🐦', label: 'Registration Early Bird', holder: earlyBirdName, value: earlyBirdName ? 1 : 0 },
    // Cheer-based awards
    { emoji: '🌟', label: 'Most Cheers Received', ...topHolder(cheers.filter(c => !STREAK_EXCLUDED.has(c.player_id)).map(c => ({ player_id: c.player_id, value: c.cheers_received })), latestReceivedAt) },
    { emoji: '🙌', label: 'Most Cheers Given',    ...topHolder(cheers.filter(c => !STREAK_EXCLUDED.has(c.player_id)).map(c => ({ player_id: c.player_id, value: c.cheers_given })), latestGivenAt) },
    { emoji: '⚔️', label: 'Top Fierce Offense',   ...topHolder(cheers.map(c => ({ player_id: c.player_id, value: c.offense_received })), latestReceivedAt) },
    { emoji: '🛡️', label: 'Top Iron Defense',     ...topHolder(cheers.map(c => ({ player_id: c.player_id, value: c.defense_received })), latestReceivedAt) },
    { emoji: '🎯', label: 'Top Smooth Technique', ...topHolder(cheers.map(c => ({ player_id: c.player_id, value: c.technique_received })), latestReceivedAt) },
    { emoji: '💨', label: 'Top Swift Movement',   ...topHolder(cheers.map(c => ({ player_id: c.player_id, value: c.movement_received })), latestReceivedAt) },
    { emoji: '🤝', label: 'Top Good Sport',       ...topHolder(cheers.map(c => ({ player_id: c.player_id, value: c.good_sport_received })), latestReceivedAt) },
    { emoji: '💪', label: 'Top Solid Effort',    ...topHolder(cheers.map(c => ({ player_id: c.player_id, value: c.solid_effort_received })), latestReceivedAt) },
  ]

  return awards
}

function AwardsLeaderboard() {
  const [awards, setAwards] = useState<AwardEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    setIsLoading(true)
    try { setAwards(await fetchAwardsLeaderboard()) }
    finally { setIsLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {awards.map(a => (
        <div key={a.label} className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3">
          <span className="text-xl shrink-0">{a.emoji}</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">{a.label}</p>
            <p className="font-semibold text-sm truncate">
              {a.holder ?? <span className="text-muted-foreground italic">Vacant — tied or no data</span>}
            </p>
          </div>
          {a.holder && a.value > 0 && (
            <span className="text-sm font-bold text-primary shrink-0">{a.value}</span>
          )}
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------
export function LeaderboardView() {
  const [searchParams] = useSearchParams()
  const initialTab = (searchParams.get('tab') as Tab | null) ?? 'wins'
  const [tab, setTab] = useState<Tab>(initialTab)

  return (
    <div className="max-w-sm mx-auto px-4 py-8">
      <h1 className="text-xl font-bold mb-4">All-time Leaderboard</h1>

      {/* Tab switcher */}
      <div className="flex gap-1 mb-6">
        {(['wins', 'cheers', 'awards'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              tab === t
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'wins' ? 'Mga Lodi' : t === 'cheers' ? 'Cheers' : 'Awards'}
          </button>
        ))}
      </div>

      {tab === 'wins' && <WinsLeaderboard />}
      {tab === 'cheers' && <CheersLeaderboard />}
      {tab === 'awards' && <AwardsLeaderboard />}
    </div>
  )
}

export default LeaderboardView
