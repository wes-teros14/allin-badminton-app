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
import { assignDenseRanks, cutToPlaces } from '@/lib/denseRank'
import { CHEER_CATEGORIES } from '@/lib/cheerTypes'
import type { CheerCategory } from '@/lib/cheerTypes'
import type { CheerTypeSlug } from '@/types/app'
import { ATTENDANCE_AWARD_EXCLUDED, fetchEligiblePlayerIds, MIN_SESSIONS_PLAYED, RECENT_SESSIONS_WINDOW } from '@/lib/boardEligibility'
import { formatDisplayName } from '@/lib/formatDisplayName'
import { fetchEarlyBirds } from '@/lib/earlyBirdData'
import { fetchWinStreaks } from '@/lib/winStreakData'
import { WIN_STREAK_MIN_RUN } from '@/lib/winStreak'
import { Avatar } from '@/components/Avatar'
import { PlayerRowBody, RankedBoard, RowStat } from '@/components/RankedBoard'
import { useAuth } from '@/hooks/useAuth'
import { clearSweepDebt, readCurrentSweepDebt } from '@/lib/celebrationStorage'
import { boardTab } from '@/lib/celebrationLabels'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Tab = 'wins' | 'pairs' | 'cheers' | 'awards'

interface AwardRow {
  playerId: string
  name: string
  value: number
  /** Dense place, 1-based: equal values share it. */
  rank: number
}

/**
 * One award on the Awards tab. Every award is a ranked top 3 drawn through
 * RankedBoard, the same board every other tab uses.
 */
interface AwardEntry {
  key: string
  emoji: string
  label: string
  /** Switcher label: fits a quarter of a 384px phone. */
  short: string
  /** One line on how the award is decided. */
  rule: string
  /** The unit under a row's number, e.g. "sessions". */
  unit: (value: number) => string
  rows: AwardRow[]
  /** What an empty board says. */
  emptyText: string
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
  const [statsRes, profilesRes, sessionsRes, earlyBirds, winStreaks, eligibleIds] = await Promise.all([
    supabase.from('player_stats').select('player_id, sessions_attended'),
    supabase.from('profiles').select('id, nickname, name_slug').eq('is_active', true),
    supabase.from('sessions').select('id').eq('status', 'complete').order('date', { ascending: true }),
    fetchEarlyBirds(),
    fetchWinStreaks(),
    fetchEligiblePlayerIds(),
  ])

  const nameMap = new Map(
    ((profilesRes.data ?? []) as Array<{ id: string; nickname: string | null; name_slug: string }>)
      .map(p => [p.id, formatDisplayName(p.nickname, p.name_slug)])
  )

  // Every award is drawn from the same pool the other tabs rank: established
  // players who are still turning up.
  const isRankable = (id: string) => nameMap.has(id) && eligibleIds.has(id)
  // The two attendance awards are still raw counts, so the organiser who is at
  // every session would hold both permanently. Everything else is a rate.
  const holdsAttendanceAward = (id: string) => isRankable(id) && !ATTENDANCE_AWARD_EXCLUDED.has(id)

  const stats = ((statsRes.data ?? []) as Array<{ player_id: string; sessions_attended: number }>)
    .filter(s => isRankable(s.player_id))
  // nameMap holds active profiles only; a placed player who has since been
  // deactivated is still named, as before.
  const missingNames = [...earlyBirds, ...winStreaks].map((e) => e.playerId).filter((id) => !nameMap.has(id))
  if (missingNames.length > 0) {
    const pRes = await supabase.from('profiles').select('id, nickname, name_slug').in('id', missingNames)
    for (const p of (pRes.data ?? []) as Array<{ id: string; nickname: string | null; name_slug: string }>) {
      nameMap.set(p.id, formatDisplayName(p.nickname, p.name_slug))
    }
  }
  const nameOf = (id: string) => nameMap.get(id) ?? 'Unknown player'

  /**
   * The top three places of a count award, dense like every other board
   * (1, 1, 2 — never 1, 1, 3), cut by places rather than rows.
   */
  function topThree(arr: Array<{ player_id: string; value: number }>) {
    const ordered = arr
      .filter((a) => a.value > 0)
      .sort((a, b) => b.value - a.value || a.player_id.localeCompare(b.player_id))
    return cutToPlaces(assignDenseRanks(ordered, (a) => a.value), 3).map((a): AwardRow => ({
      playerId: a.player_id,
      name: nameOf(a.player_id),
      value: a.value,
      rank: a.rank,
    }))
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

  const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)

  const awards: AwardEntry[] = [
    {
      key: 'joined',
      emoji: '📅',
      label: 'Most Sessions Joined',
      short: 'Joined',
      rule: 'Finished sessions attended',
      unit: (n) => plural(n, 'session', 'sessions'),
      rows: topThree(stats.filter(s => holdsAttendanceAward(s.player_id)).map(s => ({ player_id: s.player_id, value: s.sessions_attended }))),
      emptyText: 'Nobody has qualified yet.',
    },
    {
      key: 'attendance-streak',
      emoji: '🔥',
      label: 'Attendance Streak',
      short: 'Streak',
      rule: 'Most finished sessions in a row',
      unit: () => 'in a row',
      rows: topThree(streakEntries),
      emptyText: 'Nobody has a streak of 2 sessions yet.',
    },
    {
      key: 'early-bird',
      emoji: '🐦',
      label: 'Registration Early Bird',
      short: 'Early',
      rule: 'All sessions · first 5 to register score 5-4-3-2-1',
      unit: (n) => plural(n, 'point', 'points'),
      rows: earlyBirds.map((e) => ({ playerId: e.playerId, name: nameOf(e.playerId), value: e.points, rank: e.place })),
      emptyText: 'Nobody has qualified yet.',
    },
    {
      key: 'win-streak',
      emoji: '⚡',
      label: 'Win Streak',
      short: 'Wins',
      rule: 'Matches won in a row right now · a loss or draw ends it',
      unit: (n) => plural(n, 'win in a row', 'wins in a row'),
      rows: winStreaks.map((e) => ({ playerId: e.playerId, name: nameOf(e.playerId), value: e.run, rank: e.place })),
      emptyText: `Nobody is on a run of ${WIN_STREAK_MIN_RUN} or more right now.`,
    },
    // The six cheer awards (Top Fierce Offense etc.) left this tab on 2026-10-06:
    // the Cheers tab already ranks every category. Their badges stay on My Profile.
  ]

  return awards
}

/**
 * The Awards tab, laid out like the Cheers tab (2026-10-06): one award at a
 * time behind a switcher, drawn through the same RankedBoard as every other
 * tab. It used to be a stack of bespoke cards, the only tab that looked
 * different from the other three.
 */
function AwardsLeaderboard() {
  const [awards, setAwards] = useState<AwardEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    try { setAwards(await fetchAwardsLeaderboard()) }
    finally { setIsLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  if (isLoading) return <BoardSkeleton height="h-14" />
  if (awards.length === 0) return <p className="text-muted-foreground text-sm">No awards yet.</p>

  const selected = awards.find((a) => a.key === selectedKey) ?? awards[0]

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground text-center">
        Top 3 · {MIN_SESSIONS_PLAYED}+ sessions played and active in the last {RECENT_SESSIONS_WINDOW}
      </p>

      <div className="grid grid-cols-4 gap-1.5">
        {awards.map((award) => {
          const isOn = award.key === selected.key
          return (
            <button
              key={award.key}
              type="button"
              onClick={() => setSelectedKey(award.key)}
              aria-pressed={isOn}
              aria-label={award.label}
              className={`flex min-h-11 flex-col items-center justify-center gap-1 rounded-xl border py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                isOn
                  ? 'border-primary bg-primary-subtle text-foreground'
                  : 'border-border bg-card text-muted-foreground hover:border-primary/60'
              }`}
            >
              <span className="text-[17px] leading-none" aria-hidden="true">{award.emoji}</span>
              <span className="text-[11px] font-bold uppercase tracking-wide">{award.short}</span>
            </button>
          )
        })}
      </div>

      <div>
        <h2 className="flex items-center gap-2 text-[17px] font-bold tracking-tight text-foreground">
          <span className="text-2xl leading-none" aria-hidden="true">{selected.emoji}</span>
          {selected.label}
        </h2>
        <p className="mb-2.5 mt-0.5 text-xs text-muted-foreground">{selected.rule}</p>

        {selected.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{selected.emptyText}</p>
        ) : (
          <RankedBoard
            entries={selected.rows}
            tiedNoun="players"
            keyOf={(row) => row.playerId}
            renderRow={(row, variant) => <AwardRowBody row={row} unit={selected.unit(row.value)} variant={variant} />}
          />
        )}
      </div>
    </div>
  )
}

/** Everything on an award row except the marker, which the place owns. */
function AwardRowBody({ row, unit, variant }: { row: AwardRow; unit: string; variant: 'podium' | 'list' }) {
  const podium = variant === 'podium'
  return (
    <>
      <span className={`flex-1 min-w-0 truncate ${podium ? 'text-[15px] font-semibold' : 'text-sm font-medium'}`}>
        {row.name}
      </span>
      <div className="text-right shrink-0">
        <p className={`font-bold text-primary-ink tabular-nums ${podium ? 'text-[17px]' : 'text-sm'}`}>{row.value}</p>
        <p className="text-xs text-muted-foreground">{unit}</p>
      </div>
    </>
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
