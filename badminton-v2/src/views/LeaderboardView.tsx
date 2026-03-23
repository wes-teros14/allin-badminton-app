import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface LeaderboardEntry {
  playerId: string
  displayName: string
  wins: number
  losses: number
  gamesPlayed: number
  winRate: number
  score: number
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
}

type Tab = 'wins' | 'cheers'

const RANK_ICON = (i: number) => (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : String(i + 1))

// ---------------------------------------------------------------------------
// Data fetchers
// ---------------------------------------------------------------------------
async function fetchAllTimeLeaderboard(): Promise<LeaderboardEntry[]> {
  const [statsRes, profilesRes] = await Promise.all([
    supabase.from('player_stats').select('player_id, games_played, wins').gt('games_played', 0),
    supabase.from('profiles').select('id, nickname, name_slug'),
  ])

  const nameMap = new Map(
    ((profilesRes.data ?? []) as Array<{ id: string; nickname: string | null; name_slug: string }>)
      .map((p) => [p.id, p.nickname ?? p.name_slug])
  )

  return ((statsRes.data ?? []) as Array<{ player_id: string; games_played: number; wins: number }>)
    .map((s) => {
      const winRate = s.games_played > 0 ? s.wins / s.games_played : 0
      const score = winRate * Math.log(s.games_played + 1)
      return {
        playerId: s.player_id,
        displayName: nameMap.get(s.player_id) ?? s.player_id,
        wins: s.wins,
        losses: s.games_played - s.wins,
        gamesPlayed: s.games_played,
        winRate: Math.round(winRate * 100),
        score,
      }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
}

async function fetchCheerLeaderboard(): Promise<CheerLeaderboardEntry[]> {
  const [statsRes, profilesRes] = await Promise.all([
    supabase.from('player_cheer_stats').select('*').gt('cheers_received', 0),
    supabase.from('profiles').select('id, nickname, name_slug'),
  ])

  const nameMap = new Map(
    ((profilesRes.data ?? []) as Array<{ id: string; nickname: string | null; name_slug: string }>)
      .map(p => [p.id, p.nickname ?? p.name_slug])
  )

  return ((statsRes.data ?? []) as any[]).map(s => ({
    ...s,
    displayName: nameMap.get(s.player_id) ?? s.player_id,
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
            <p className="text-sm font-bold text-primary">{entry.winRate}%</p>
            <p className="text-xs text-muted-foreground">{entry.wins}W {entry.losses}L</p>
          </div>
        </div>
      ))}
      <p className="text-xs text-muted-foreground text-center pt-2">
        Ranked by win rate weighted by games played
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
  const sorted = [...entries].filter(e => getValue(e) > 0).sort((a, b) => getValue(b) - getValue(a)).slice(0, 10)
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
      <CheerRankList label="⚔️ Offense" entries={entries} getValue={e => e.offense_received} unit="received" />
      <CheerRankList label="🛡️ Defense" entries={entries} getValue={e => e.defense_received} unit="received" />
      <CheerRankList label="🎯 Technique" entries={entries} getValue={e => e.technique_received} unit="received" />
      <CheerRankList label="💨 Movement" entries={entries} getValue={e => e.movement_received} unit="received" />
      <CheerRankList label="🤝 Good Sport" entries={entries} getValue={e => e.good_sport_received} unit="received" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------
export function LeaderboardView() {
  const [tab, setTab] = useState<Tab>('wins')

  return (
    <div className="max-w-sm mx-auto px-4 py-8">
      <h1 className="text-xl font-bold mb-4">Leaderboard</h1>

      {/* Tab switcher */}
      <div className="flex gap-1 mb-6">
        {(['wins', 'cheers'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              tab === t
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'wins' ? 'All-time Lodi' : 'Cheers'}
          </button>
        ))}
      </div>

      {tab === 'wins' && <WinsLeaderboard />}
      {tab === 'cheers' && <CheersLeaderboard />}
    </div>
  )
}

export default LeaderboardView
