import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router'
import { supabase } from '@/lib/supabase'
import {
  fetchAllTimeLeaderboard,
  fetchCheerLeaderboard,
  fetchPairLeaderboard,
  MIN_GAMES_TOGETHER,
} from '@/lib/leaderboardData'
import type {
  CheerLeaderboardEntry,
  LeaderboardEntry,
  PairLeaderboardEntry,
} from '@/lib/leaderboardData'
import { MIN_CHEERS_RECEIVED, rankCheerShares } from '@/lib/cheerShare'
import { CHEER_CATEGORIES } from '@/lib/cheerTypes'
import type { CheerCategory } from '@/lib/cheerTypes'
import type { CheerTypeSlug } from '@/types/app'
import { ATTENDANCE_AWARD_EXCLUDED, fetchEligiblePlayerIds, MIN_SESSIONS_PLAYED, RECENT_SESSIONS_WINDOW } from '@/lib/boardEligibility'
import { formatDisplayName } from '@/lib/formatDisplayName'
import { Avatar } from '@/components/Avatar'
import { PlayerRowBody, RankedBoard, RowStat } from '@/components/RankedBoard'
import { useAuth } from '@/hooks/useAuth'
import { clearSweepDebt, readCurrentSweepDebt } from '@/lib/celebrationStorage'
import { boardTab } from '@/lib/celebrationLabels'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Tab = 'wins' | 'pairs' | 'cheers' | 'awards'

interface AwardEntry {
  emoji: string
  label: string
  holder: string | null
  /** Pre-formatted, because cheer awards read "62%" and count awards read "9". */
  valueLabel: string | null
}

// ---------------------------------------------------------------------------
// Sub-components (the ranked-board presentation itself is in components/RankedBoard)
// ---------------------------------------------------------------------------
/**
 * Whether the player's own row on `tab` should play the celebration sweep.
 *
 * The debt is armed when a celebration is shown, not when its toast is accepted,
 * so this fires for a player who tapped "View" *and* for one who wandered here
 * on their own days later. Getting that wrong is invisible — the screen looks
 * correct and simply never shimmers.
 */
function useOwedSweep(tab: Tab): boolean {
  const { user } = useAuth()
  const [owed, setOwed] = useState(false)

  useEffect(() => {
    const playerId = user?.id
    if (!playerId) return

    const debt = readCurrentSweepDebt(playerId)
    if (!debt || boardTab(debt.board) !== tab) return

    setOwed(true)
    // Collected. A sweep is a one-off, not a permanent decoration on the row.
    clearSweepDebt(playerId)
  }, [user?.id, tab])

  return owed
}

function BoardSkeleton({ height }: { height: string }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className={`${height} rounded-xl bg-muted animate-pulse`} />
      ))}
    </div>
  )
}

function WinsLeaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { user } = useAuth()
  const swept = useOwedSweep('wins')

  const load = useCallback(async () => {
    setIsLoading(true)
    try { setEntries(await fetchAllTimeLeaderboard()) }
    finally { setIsLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  return isLoading ? (
    <BoardSkeleton height="h-14" />
  ) : entries.length === 0 ? (
    <p className="text-muted-foreground text-sm">No stats recorded yet.</p>
  ) : (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground text-center pb-1">
        Ranked by win rate · min. {MIN_SESSIONS_PLAYED} sessions played · must be active in the last {RECENT_SESSIONS_WINDOW}
      </p>
      <RankedBoard
        entries={entries}
        tiedNoun="players"
        keyOf={(entry) => entry.playerId}
        isOwnRow={swept ? (entry) => entry.playerId === user?.id : undefined}
        renderRow={(entry, variant) => <PlayerRowBody entry={entry} variant={variant} />}
      />
    </div>
  )
}

function PairsLeaderboard() {
  const { user } = useAuth()
  const swept = useOwedSweep('pairs')
  const [entries, setEntries] = useState<PairLeaderboardEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      setEntries(await fetchPairLeaderboard())
    } catch (error) {
      // A truncated or failed read must never render as a plausible board.
      console.error('[pair leaderboard] failed to load', error)
      setEntries([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return isLoading ? (
    <BoardSkeleton height="h-16" />
  ) : entries.length === 0 ? (
    <p className="text-muted-foreground text-sm">
      No partnership qualifies yet — both players need {MIN_SESSIONS_PLAYED} sessions played,
      and {MIN_GAMES_TOGETHER} games together.
    </p>
  ) : (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground text-center pb-1">
        Ranked by win rate · min. {MIN_GAMES_TOGETHER} games together · both with {MIN_SESSIONS_PLAYED}+ sessions played and active in the last {RECENT_SESSIONS_WINDOW}
      </p>
      <RankedBoard
        entries={entries}
        tiedNoun="partnerships"
        keyOf={(entry) => entry.key}
        isOwnRow={swept ? (entry) => entry.players.some((p) => p.id === user?.id) : undefined}
        renderRow={(entry, variant) => <PairRowBody entry={entry} variant={variant} />}
      />
    </div>
  )
}

/** Everything on a partnership row except the marker, which the place owns. */
function PairRowBody({ entry, variant }: { entry: PairLeaderboardEntry; variant: 'podium' | 'list' }) {
  const podium = variant === 'podium'
  return (
    <>
      <div className="flex shrink-0 -space-x-2">
        {entry.players.map((player) => (
          <Avatar
            key={player.id}
            url={player.avatarUrl}
            name={player.displayName}
            size={podium ? 32 : 28}
            className="ring-2 ring-card"
          />
        ))}
      </div>
      <span className={`flex-1 min-w-0 line-clamp-2 ${podium ? 'text-[15px] font-semibold' : 'text-sm font-medium'}`}>
        {entry.players[0].displayName} &amp; {entry.players[1].displayName}
      </span>
      <RowStat winRate={entry.winRate} wins={entry.wins} losses={entry.losses} podium={podium} />
    </>
  )
}


/**
 * One cheer category, ranked by what share of a player's received cheers were
 * of this type — not by how many they collected. See `cheerShare.ts` for why
 * the raw counts had to go.
 */
/**
 * One cheer category, ranked by what share of a player's received cheers were
 * of this type — not by how many they collected. See `cheerShare.ts` for why
 * the raw counts had to go.
 *
 * Rendered through the same `RankedBoard` as the win-rate boards, so a podium,
 * a tie group and a rank chip mean the same thing on every tab.
 */
/**
 * One cheer category, ranked by what share of a player's received cheers were
 * of this type — not by how many they collected. See `cheerShare.ts` for why
 * the raw counts had to go.
 *
 * Rendered through the same `RankedBoard` as the win-rate boards, so a podium,
 * a tie group and a rank chip mean the same thing on every tab.
 */
function CheerShareList({
  category,
  entries,
}: {
  category: CheerCategory
  entries: CheerLeaderboardEntry[]
}) {
  const { user } = useAuth()
  const swept = useOwedSweep('cheers')
  const names = new Map(entries.map((e) => [e.player_id, e.displayName]))
  const ranked = rankCheerShares(
    entries.map((e) => ({
      playerId: e.player_id,
      categoryCount: category.of(e),
      totalReceived: e.cheers_received,
    })),
  )

  return (
    <div>
      <h2 className="mb-2.5 flex items-center gap-2 text-[17px] font-bold tracking-tight text-foreground">
        <span className="text-2xl leading-none" aria-hidden="true">{category.emoji}</span>
        {category.name}
      </h2>

      {ranked.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nobody has qualified for this cheer yet.
        </p>
      ) : (
        <RankedBoard
          entries={ranked}
          tiedNoun="players"
          keyOf={(row) => row.playerId}
          isOwnRow={swept ? (row) => row.playerId === user?.id : undefined}
          renderRow={(row, variant) => (
            <CheerShareRowBody name={names.get(row.playerId) ?? ''} row={row} variant={variant} />
          )}
        />
      )}
    </div>
  )
}

/** Everything on a cheer row except the marker, which the place owns. */
function CheerShareRowBody({
  name,
  row,
  variant,
}: {
  name: string
  row: { sharePct: number; categoryCount: number; totalReceived: number }
  variant: 'podium' | 'list'
}) {
  const podium = variant === 'podium'
  return (
    <>
      <span className={`flex-1 min-w-0 truncate ${podium ? 'text-[15px] font-semibold' : 'text-sm font-medium'}`}>
        {name}
      </span>
      <div className="text-right shrink-0">
        <p className={`font-bold text-primary-ink tabular-nums ${podium ? 'text-[17px]' : 'text-sm'}`}>
          {row.sharePct}%
        </p>
        <p className="text-xs text-muted-foreground tabular-nums">
          {row.categoryCount} of {row.totalReceived}
        </p>
      </div>
    </>
  )
}

function CheersLeaderboard() {
  const [entries, setEntries] = useState<CheerLeaderboardEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [slug, setSlug] = useState<CheerTypeSlug>(CHEER_CATEGORIES[0].slug)

  const load = useCallback(async () => {
    setIsLoading(true)
    try { setEntries(await fetchCheerLeaderboard()) }
    finally { setIsLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  if (isLoading) return <BoardSkeleton height="h-14" />

  if (entries.length === 0) {
    return <p className="text-muted-foreground text-sm">No cheers recorded yet.</p>
  }

  const selected = CHEER_CATEGORIES.find((c) => c.slug === slug) ?? CHEER_CATEGORIES[0]

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground text-center">
        Ranked by share of each player's cheers · min. {MIN_CHEERS_RECEIVED} cheers received ·
        {' '}{MIN_SESSIONS_PLAYED}+ sessions played and active in the last {RECENT_SESSIONS_WINDOW}
      </p>

      {/*
        One cheer on screen at a time. Six boards stacked meant up to eighteen
        medals per scroll, which made a gold medal decoration rather than a
        placing — and the page ran past 6,000px on a phone.

        Two rows of three (docs/visual/cheer-switcher-options.html, Option
        A) rather than one row of six: six simultaneous chips blew past the
        >4-visible-options guideline. Labels also bumped 8px -> 11px, the
        same legibility floor applied elsewhere — 8px was below even that.
      */}
      <div className="grid grid-cols-3 gap-1.5">
        {CHEER_CATEGORIES.map((category) => {
          const isOn = category.slug === selected.slug
          return (
            <button
              key={category.slug}
              type="button"
              onClick={() => setSlug(category.slug)}
              aria-pressed={isOn}
              aria-label={category.name}
              className={`flex min-h-11 flex-col items-center justify-center gap-1 rounded-xl border py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                isOn
                  ? 'border-primary bg-primary-subtle text-foreground'
                  : 'border-border bg-card text-muted-foreground hover:border-primary/60'
              }`}
            >
              <span className="text-[17px] leading-none" aria-hidden="true">{category.emoji}</span>
              <span className="text-[11px] font-bold uppercase tracking-wide">{category.short}</span>
            </button>
          )
        })}
      </div>

      <CheerShareList category={selected} entries={entries} />
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

  const [cheerRes, statsRes, profilesRes, cheerTimestampsRes, sessionsRes, earlyBirdRes, eligibleIds] = await Promise.all([
    supabase.from('player_cheer_stats').select('player_id, cheers_received, offense_received, defense_received, technique_received, movement_received, good_sport_received, solid_effort_received'),
    supabase.from('player_stats').select('player_id, sessions_attended'),
    supabase.from('profiles').select('id, nickname, name_slug').eq('is_active', true),
    supabase.from('cheers').select('receiver_id, giver_id, created_at').order('created_at', { ascending: false }),
    supabase.from('sessions').select('id').eq('status', 'complete').order('date', { ascending: true }),
    latestSessionId
      ? supabase.from('session_registrations').select('player_id').eq('session_id', latestSessionId).eq('source', 'self').order('registered_at', { ascending: true }).limit(1).maybeSingle()
      : Promise.resolve({ data: null }),
    fetchEligiblePlayerIds(),
  ])

  const nameMap = new Map(
    ((profilesRes.data ?? []) as Array<{ id: string; nickname: string | null; name_slug: string }>)
      .map(p => [p.id, formatDisplayName(p.nickname, p.name_slug)])
  )

  // Every award, cheer-based or attendance-based, is drawn from the same pool
  // the other tabs rank: established players who are still turning up.
  const isRankable = (id: string) => nameMap.has(id) && eligibleIds.has(id)
  // The two attendance awards are still raw counts, so the organiser who is at
  // every session would hold both permanently. Everything else is a rate.
  const holdsAttendanceAward = (id: string) => isRankable(id) && !ATTENDANCE_AWARD_EXCLUDED.has(id)

  const cheers = ((cheerRes.data ?? []) as Array<{ player_id: string; cheers_received: number; offense_received: number; defense_received: number; technique_received: number; movement_received: number; good_sport_received: number; solid_effort_received: number }>)
    .filter(s => isRankable(s.player_id))
  const stats = ((statsRes.data ?? []) as Array<{ player_id: string; sessions_attended: number }>)
    .filter(s => isRankable(s.player_id))
  const earlyBirdPlayerId = (earlyBirdRes.data as { player_id: string } | null)?.player_id ?? null
  let earlyBirdName: string | null = earlyBirdPlayerId ? (nameMap.get(earlyBirdPlayerId) ?? null) : null
  if (earlyBirdPlayerId && !earlyBirdName) {
    const pRes = await supabase.from('profiles').select('nickname, name_slug').eq('id', earlyBirdPlayerId).maybeSingle()
    const p = pRes.data as { nickname: string | null; name_slug: string } | null
    earlyBirdName = p ? formatDisplayName(p.nickname, p.name_slug) : null
  }
  const cheerTimestamps = (cheerTimestampsRes.data ?? []) as Array<{ receiver_id: string; giver_id: string; created_at: string }>

  // Tiebreaker maps: latest activity timestamp per player
  const latestReceivedAt = new Map<string, string>()
  for (const c of cheerTimestamps) {
    if (!latestReceivedAt.has(c.receiver_id)) latestReceivedAt.set(c.receiver_id, c.created_at)
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
  const completedSessionIds = ((sessionsRes.data ?? []) as Array<{ id: string }>).map(s => s.id)
  const allRegsRes = await supabase.from('session_registrations').select('session_id, player_id').in('session_id', completedSessionIds)
  const playerSessions = new Map<string, Set<string>>()
  for (const r of (allRegsRes.data ?? []) as Array<{ session_id: string; player_id: string }>) {
    if (!holdsAttendanceAward(r.player_id)) continue
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

  /**
   * A cheer award goes to the highest *share*, not the highest count, and only
   * among players past the received floor. "Most Cheers Received" and "Most
   * Cheers Given" are gone entirely: cheering is compulsory after every game,
   * so both were three-per-match attendance counts wearing a rosette — and
   * "Most Sessions Joined" below already says that honestly.
   */
  function topShareHolder(
    getCount: (c: typeof cheers[number]) => number,
  ): { holder: string | null; valueLabel: string | null } {
    const ranked = rankCheerShares(
      cheers.map((c) => ({
        playerId: c.player_id,
        categoryCount: getCount(c),
        totalReceived: c.cheers_received,
      })),
      { maxPlaces: 1 },
    )

    // A shared first place has no single holder, matching how the count-based
    // awards already render a tie as vacant.
    if (ranked.length !== 1) return { holder: null, valueLabel: null }
    return {
      holder: nameMap.get(ranked[0].playerId) ?? null,
      valueLabel: `${ranked[0].sharePct}%`,
    }
  }

  const countAward = (
    emoji: string,
    label: string,
    result: { holder: string | null; value: number },
  ): AwardEntry => ({
    emoji,
    label,
    holder: result.holder,
    valueLabel: result.value > 0 ? String(result.value) : null,
  })

  const awards: AwardEntry[] = [
    // System-generated awards first
    countAward('📅', 'Most Sessions Joined', topHolder(stats.filter(s => holdsAttendanceAward(s.player_id)).map(s => ({ player_id: s.player_id, value: s.sessions_attended })))),
    countAward('🔥', 'Attendance Streak', topHolder(streakEntries)),
    { emoji: '🐦', label: 'Registration Early Bird', holder: earlyBirdName, valueLabel: null },
    // Cheer-based awards, by share of the holder's own received cheers
    { emoji: '⚔️', label: 'Top Fierce Offense',   ...topShareHolder(c => c.offense_received) },
    { emoji: '🛡️', label: 'Top Iron Defense',     ...topShareHolder(c => c.defense_received) },
    { emoji: '🎯', label: 'Top Smooth Technique', ...topShareHolder(c => c.technique_received) },
    { emoji: '💨', label: 'Top Swift Movement',   ...topShareHolder(c => c.movement_received) },
    { emoji: '🤝', label: 'Top Good Sport',       ...topShareHolder(c => c.good_sport_received) },
    { emoji: '💪', label: 'Top Solid Effort',     ...topShareHolder(c => c.solid_effort_received) },
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
          {a.holder && a.valueLabel && (
            <span className="text-sm font-bold text-primary-ink tabular-nums shrink-0">{a.valueLabel}</span>
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
    <div className="max-w-sm sm:max-w-md md:max-w-lg mx-auto px-4 py-8">
      <h1 className="text-xl font-bold mb-4">All-time Leaderboard</h1>

      {/* Tab switcher */}
      <div className="flex gap-1 mb-6" role="tablist" aria-label="Leaderboard categories">
        {(['wins', 'pairs', 'cheers', 'awards'] as Tab[]).map((t) => (
          <button
            key={t}
            role="tab"
            id={`tab-${t}`}
            aria-selected={tab === t}
            aria-controls={`tabpanel-${t}`}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              tab === t
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'wins' ? 'Individual' : t === 'cheers' ? 'Cheers' : t === 'awards' ? 'Awards' : 'Partners'}
          </button>
        ))}
      </div>

      {tab === 'wins' && <div role="tabpanel" id="tabpanel-wins" aria-labelledby="tab-wins"><WinsLeaderboard /></div>}
      {tab === 'cheers' && <div role="tabpanel" id="tabpanel-cheers" aria-labelledby="tab-cheers"><CheersLeaderboard /></div>}
      {tab === 'awards' && <div role="tabpanel" id="tabpanel-awards" aria-labelledby="tab-awards"><AwardsLeaderboard /></div>}
      {tab === 'pairs' && <div role="tabpanel" id="tabpanel-pairs" aria-labelledby="tab-pairs"><PairsLeaderboard /></div>}
    </div>
  )
}

export default LeaderboardView
