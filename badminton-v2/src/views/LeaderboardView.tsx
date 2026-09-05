import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { supabase } from '@/lib/supabase'
import { assignDenseRanks, cutToPlaces, groupByRank } from '@/lib/denseRank'
import { MIN_CHEERS_RECEIVED, rankCheerShares } from '@/lib/cheerShare'
import { CHEER_CATEGORIES } from '@/lib/cheerTypes'
import type { CheerCategory } from '@/lib/cheerTypes'
import type { CheerTypeSlug } from '@/types/app'
import { ATTENDANCE_AWARD_EXCLUDED, fetchEligiblePlayerIds, MIN_SESSIONS_PLAYED, RECENT_SESSIONS_WINDOW } from '@/lib/boardEligibility'
import type { RankGroup } from '@/lib/denseRank'
import { disambiguateDisplayNames, formatDisplayName } from '@/lib/formatDisplayName'
import { rankPairs, tallyPairs } from '@/lib/pairStats'
import type { PairTallyMatch } from '@/lib/pairStats'
import { Avatar } from '@/components/Avatar'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface LeaderboardEntry {
  rank: number
  playerId: string
  displayName: string
  avatarUrl: string | null
  wins: number
  losses: number
  winRate: number
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

interface CheerStatsRow {
  player_id: string
  cheers_received: number
  cheers_given: number
  offense_received: number
  defense_received: number
  technique_received: number
  movement_received: number
  good_sport_received: number
  solid_effort_received: number
}

interface PairLeaderboardPlayer {
  id: string
  displayName: string
  avatarUrl: string | null
}

interface PairLeaderboardEntry {
  rank: number
  key: string
  players: [PairLeaderboardPlayer, PairLeaderboardPlayer]
  wins: number
  losses: number
  games: number
  winRate: number
}

type Tab = 'wins' | 'pairs' | 'cheers' | 'awards'

interface AwardEntry {
  emoji: string
  label: string
  holder: string | null
  /** Pre-formatted, because cheer awards read "62%" and count awards read "9". */
  valueLabel: string | null
}

// ---------------------------------------------------------------------------
// Ranked board presentation
// ---------------------------------------------------------------------------
/** Places 1-3 get a medal; every place below gets a numbered chip. */
const PODIUM_PLACES = 3
/** Ten *places*, not ten rows — a tie makes the two differ. */
const MAX_PLACES = 10

const MEDALS = ['🥇', '🥈', '🥉'] as const
const ORDINALS = ['1st', '2nd', '3rd'] as const
/**
 * First place borrows `--gold`, the same token the award toast uses, so the two
 * golds in the app cannot drift. Silver and bronze have no tokens; palette
 * values are used rather than inventing two more. Bronze is amber-700 (brown)
 * rather than an orange — an orange wash on a dark card reads as the
 * destructive red.
 */
const PODIUM_TINT = [
  'border-gold bg-gold/[0.07]',
  'border-zinc-400/60 bg-zinc-400/[0.07]',
  'border-amber-700/60 bg-amber-700/[0.09]',
] as const

// ---------------------------------------------------------------------------
// Data fetchers
// ---------------------------------------------------------------------------
async function fetchAllTimeLeaderboard(): Promise<LeaderboardEntry[]> {
  const [statsRes, profilesRes, recentSessionsRes] = await Promise.all([
    supabase.from('player_stats').select('player_id, games_played, wins, sessions_attended').gt('games_played', 0).gte('sessions_attended', MIN_SESSIONS_PLAYED),
    supabase.from('profiles').select('id, nickname, name_slug, avatar_url').eq('is_active', true),
    supabase.from('sessions').select('id').eq('status', 'complete').order('date', { ascending: false }).limit(RECENT_SESSIONS_WINDOW),
  ])

  const recentSessionIds = ((recentSessionsRes.data ?? []) as Array<{ id: string }>).map((s) => s.id)
  const activePlayerIds = new Set<string>()
  if (recentSessionIds.length > 0) {
    const { data: registrations } = await supabase
      .from('session_registrations')
      .select('player_id')
      .in('session_id', recentSessionIds)
    for (const r of (registrations ?? []) as Array<{ player_id: string }>) activePlayerIds.add(r.player_id)
  }

  type ProfileRow = { id: string; nickname: string | null; name_slug: string; avatar_url: string | null }
  const profileRows = (profilesRes.data ?? []) as ProfileRow[]
  const nameMap = new Map(profileRows.map((p) => [p.id, formatDisplayName(p.nickname, p.name_slug)]))
  const avatarMap = new Map(profileRows.map((p) => [p.id, p.avatar_url]))

  const ordered = ((statsRes.data ?? []) as Array<{ player_id: string; games_played: number; wins: number; sessions_attended: number }>)
    .filter((s) => nameMap.has(s.player_id) && activePlayerIds.has(s.player_id))
    .map((s) => ({
      playerId: s.player_id,
      displayName: nameMap.get(s.player_id)!,
      avatarUrl: avatarMap.get(s.player_id) ?? null,
      wins: s.wins,
      losses: s.games_played - s.wins,
      winRate: Math.round((s.wins / s.games_played) * 100),
    }))
    // The player id settles what wins do not, so the sequence is a property of
    // the data rather than of the order Supabase happened to return rows in.
    .sort((a, b) => b.winRate - a.winRate || b.wins - a.wins || a.playerId.localeCompare(b.playerId))

  // Shared rank by win rate, matching the partnership board: two players both
  // reading 67% take the same place, and the cut counts places not rows.
  return cutToPlaces(assignDenseRanks(ordered, (entry) => entry.winRate), MAX_PLACES)
}

async function fetchCheerLeaderboard(): Promise<CheerLeaderboardEntry[]> {
  const [statsRes, profilesRes, eligibleIds] = await Promise.all([
    supabase.from('player_cheer_stats').select('*').gt('cheers_received', 0),
    supabase.from('profiles').select('id, nickname, name_slug').eq('is_active', true),
    fetchEligiblePlayerIds(),
  ])

  const nameMap = new Map(
    ((profilesRes.data ?? []) as Array<{ id: string; nickname: string | null; name_slug: string }>)
      .map(p => [p.id, formatDisplayName(p.nickname, p.name_slug)])
  )

  return ((statsRes.data ?? []) as CheerStatsRow[])
    .filter(s => nameMap.has(s.player_id) && eligibleIds.has(s.player_id))
    .map(s => ({
      ...s,
      displayName: nameMap.get(s.player_id)!,
    }))
}

// --- Partnership board -----------------------------------------------------

const MIN_GAMES_TOGETHER = 3
const MATCH_PAGE_SIZE = 1000

/**
 * `sessions!inner(id)` carries no filter today. It is here so that the planned
 * yearly season/archive rule is a single added `.eq('sessions.…', …)` condition
 * rather than a new embed and a re-shaped row type. Do not remove it as unused.
 */
const PAIR_MATCH_SELECT =
  'team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id, match_results(winning_pair_index, game_number), sessions!inner(id)'

/**
 * Every other query in this app is session-scoped or over a small table, so none
 * of them can reach the server's row cap. This one can — a year of play is around
 * a thousand matches — and an uncapped read would come back silently truncated,
 * producing a board that looks right and is wrong. Hence paging, plus the exact
 * count cross-check below.
 */
async function fetchCompletedMatchesForPairs(): Promise<PairTallyMatch[]> {
  const rows: PairTallyMatch[] = []

  for (let offset = 0; ; offset += MATCH_PAGE_SIZE) {
    const { data, error } = await supabase
      .from('matches')
      .select(PAIR_MATCH_SELECT)
      .eq('status', 'complete')
      .order('id', { ascending: true })
      .range(offset, offset + MATCH_PAGE_SIZE - 1)

    if (error) throw error

    const page = (data ?? []) as unknown as PairTallyMatch[]
    rows.push(...page)
    if (page.length < MATCH_PAGE_SIZE) break
  }

  const { count, error: countError } = await supabase
    .from('matches')
    .select('id, sessions!inner(id)', { count: 'exact', head: true })
    .eq('status', 'complete')

  if (countError) throw countError
  if (typeof count === 'number' && count !== rows.length) {
    throw new Error(
      `Pair leaderboard read is incomplete: fetched ${rows.length} of ${count} completed matches. ` +
        'Refusing to render a partially counted board.',
    )
  }

  return rows
}

async function fetchPairLeaderboard(): Promise<PairLeaderboardEntry[]> {
  const [matches, profilesRes, eligibleIds] = await Promise.all([
    fetchCompletedMatchesForPairs(),
    supabase.from('profiles').select('id, nickname, name_slug, avatar_url').eq('is_active', true),
    fetchEligiblePlayerIds(),
  ])

  type ProfileRow = { id: string; nickname: string | null; name_slug: string; avatar_url: string | null }
  const profileRows = (profilesRes.data ?? []) as ProfileRow[]
  const profileById = new Map(profileRows.map((p) => [p.id, p]))

  // Two different players can both be nicknamed "Alexis". On a pair row that
  // would render as "Alexis & Alexis" — the exact string that signalled the
  // duplicate-player bug migration 079 was written to stop.
  const labels = disambiguateDisplayNames(
    profileRows.map((p) => ({
      id: p.id,
      nameSlug: p.name_slug,
      displayName: formatDisplayName(p.nickname, p.name_slug),
    })),
  )

  // rankPairs applies this to *both* players, so a pairing needs two qualifying
  // partners — not one regular plus whoever they happened to play beside.
  const ranked = rankPairs(tallyPairs(matches), {
    minGames: MIN_GAMES_TOGETHER,
    maxRank: MAX_PLACES,
    isEligiblePlayer: (id) => profileById.has(id) && eligibleIds.has(id),
  })

  const toPlayer = (id: string): PairLeaderboardPlayer => ({
    id,
    displayName: labels.get(id) ?? id,
    avatarUrl: profileById.get(id)?.avatar_url ?? null,
  })

  return ranked.map((pair) => ({
    rank: pair.rank,
    key: pair.key,
    players: [toPlayer(pair.playerA), toPlayer(pair.playerB)],
    wins: pair.wins,
    losses: pair.losses,
    games: pair.games,
    winRate: pair.winRate,
  }))
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
/**
 * The numbered marker every non-podium place uses, on all three ranked
 * surfaces. Fixed 34px: the width is what keeps the rank column aligned, so it
 * must not vary between boards or between tied and untied places.
 */
function RankChip({ rank }: { rank: number }) {
  return (
    <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[9px] border border-border bg-secondary text-[15px] font-bold tabular-nums text-foreground">
      {rank}
    </span>
  )
}

/**
 * One place on a board: a marker (medal or numbered chip) beside either a
 * single row or, when a place is shared, a stack of rows under a "3 tied"
 * caption.
 *
 * The marker column is a fixed width whether the place is tied or not. That is
 * the whole point of drawing both cases through one component — the previous
 * code put the rank inside the card for an untied place and outside it for a
 * tied one, so the rank column did not line up down the board.
 */
function RankPlace<T>({
  group,
  marker,
  frameClassName,
  tiedNoun,
  renderRow,
  keyOf,
}: {
  group: RankGroup<T>
  marker: ReactNode
  frameClassName: string
  /** Plural noun for the tie group's screen-reader label. */
  tiedNoun: string
  renderRow: (item: T) => ReactNode
  keyOf: (item: T) => string
}) {
  const isTie = group.items.length > 1

  return (
    <div
      className={`flex gap-3 bg-card ${isTie ? 'items-start p-2.5' : 'items-center py-2.5 pl-2.5 pr-3.5'} ${frameClassName}`}
      aria-label={isTie ? `Rank ${group.rank}, ${group.items.length} ${tiedNoun} tied` : undefined}
    >
      {marker}

      {isTie ? (
        <div className="min-w-0 flex-1">
          <p className="border-b border-border px-1 pb-1.5 text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
            {group.items.length} tied
          </p>
          {group.items.map((item, i) => (
            <div
              key={keyOf(item)}
              className={`flex items-center gap-3 px-1 py-2 ${i > 0 ? 'border-t border-border' : ''}`}
            >
              {renderRow(item)}
            </div>
          ))}
        </div>
      ) : (
        renderRow(group.items[0])
      )}
    </div>
  )
}

/**
 * A whole board: medal podium for places 1-3, a labelled divider, then numbered
 * chips for every place below. Both the individual and the partnership board
 * render through this, so their rank columns cannot drift apart again.
 */
function RankedBoard<T extends { rank: number }>({
  entries,
  renderRow,
  keyOf,
  tiedNoun,
}: {
  entries: readonly T[]
  renderRow: (item: T, variant: 'podium' | 'list') => ReactNode
  keyOf: (item: T) => string
  tiedNoun: string
}) {
  const groups = groupByRank(entries)
  const podium = groups.filter((g) => g.rank <= PODIUM_PLACES)
  const rest = groups.filter((g) => g.rank > PODIUM_PLACES)
  // Named from the places actually on screen, not from MAX_PLACES — a board
  // holding six places must not advertise a tenth that isn't there.
  const restLabel =
    rest.length === 0 ? null
    : rest[0].rank === rest[rest.length - 1].rank ? `Place ${rest[0].rank}`
    : `Places ${rest[0].rank}–${rest[rest.length - 1].rank}`

  return (
    <div className="space-y-2">
      {podium.map((group) => (
        <RankPlace
          key={group.rank}
          group={group}
          tiedNoun={tiedNoun}
          keyOf={keyOf}
          renderRow={(item) => renderRow(item, 'podium')}
          frameClassName={`rounded-2xl border ${PODIUM_TINT[group.rank - 1]}`}
          marker={
            <span className="flex w-9 shrink-0 flex-col items-center gap-0.5 pt-0.5">
              <span className="text-[25px] leading-none" aria-hidden="true">
                {MEDALS[group.rank - 1]}
              </span>
              <span className="text-[9px] font-extrabold uppercase tracking-wider text-muted-foreground">
                {ORDINALS[group.rank - 1]}
              </span>
            </span>
          }
        />
      ))}

      {restLabel && (
        <p className="flex items-center gap-2 pt-2 text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
          {restLabel}
          <span className="h-px flex-1 bg-border" aria-hidden="true" />
        </p>
      )}

      {rest.map((group) => (
        <RankPlace
          key={group.rank}
          group={group}
          tiedNoun={tiedNoun}
          keyOf={keyOf}
          renderRow={(item) => renderRow(item, 'list')}
          frameClassName="rounded-xl border border-border"
          marker={<RankChip rank={group.rank} />}
        />
      ))}
    </div>
  )
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
        renderRow={(entry, variant) => <PlayerRowBody entry={entry} variant={variant} />}
      />
    </div>
  )
}

function PairsLeaderboard() {
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
        renderRow={(entry, variant) => <PairRowBody entry={entry} variant={variant} />}
      />
    </div>
  )
}

/** Everything on an individual row except the marker, which the place owns. */
function PlayerRowBody({ entry, variant }: { entry: LeaderboardEntry; variant: 'podium' | 'list' }) {
  const podium = variant === 'podium'
  return (
    <>
      <Avatar url={entry.avatarUrl} name={entry.displayName} size={podium ? 32 : 28} />
      <span className={`flex-1 min-w-0 truncate ${podium ? 'text-[15px] font-semibold' : 'text-sm font-medium'}`}>
        {entry.displayName}
      </span>
      <RowStat winRate={entry.winRate} wins={entry.wins} losses={entry.losses} podium={podium} />
    </>
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

function RowStat({
  winRate,
  wins,
  losses,
  podium,
}: {
  winRate: number
  wins: number
  losses: number
  podium: boolean
}) {
  return (
    <div className="text-right shrink-0">
      <p className={`font-bold text-primary tabular-nums ${podium ? 'text-[17px]' : 'text-sm'}`}>{winRate}%</p>
      <p className="text-xs text-muted-foreground tabular-nums">{wins}W {losses}L</p>
    </div>
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
        <p className={`font-bold text-primary tabular-nums ${podium ? 'text-[17px]' : 'text-sm'}`}>
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
      */}
      <div className="grid grid-cols-6 gap-1.5">
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
              <span className="text-[8px] font-bold uppercase tracking-wide">{category.short}</span>
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
            <span className="text-sm font-bold text-primary tabular-nums shrink-0">{a.valueLabel}</span>
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
        {(['wins', 'pairs', 'cheers', 'awards'] as Tab[]).map((t) => (
          <button
            key={t}
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

      {tab === 'wins' && <WinsLeaderboard />}
      {tab === 'cheers' && <CheersLeaderboard />}
      {tab === 'awards' && <AwardsLeaderboard />}
      {tab === 'pairs' && <PairsLeaderboard />}
    </div>
  )
}

export default LeaderboardView
