import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { supabase } from '@/lib/supabase'
import { assignDenseRanks, cutToPlaces, groupByRank } from '@/lib/denseRank'
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
  value: number
}

/** Still used by the Cheers lists, which are top-five counts rather than places. */
const RANK_ICON = (i: number) => (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : String(i + 1))

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
const RECENT_SESSIONS_WINDOW = 4
/**
 * Sessions a player must have attended to appear on any board. On the
 * partnership board *both* partners must clear it, so one regular carrying a
 * newcomer through three games together cannot mint a top-ten pairing.
 */
const MIN_SESSIONS_PLAYED = 3

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
  const [statsRes, profilesRes] = await Promise.all([
    supabase.from('player_cheer_stats').select('*').gt('cheers_received', 0),
    supabase.from('profiles').select('id, nickname, name_slug').eq('is_active', true),
  ])

  const nameMap = new Map(
    ((profilesRes.data ?? []) as Array<{ id: string; nickname: string | null; name_slug: string }>)
      .map(p => [p.id, formatDisplayName(p.nickname, p.name_slug)])
  )

  const CHEER_EXCLUDED = new Set(['d3def74c-7367-4553-af30-eaa58e45ddb7', '8e48d7bf-c7dc-45a5-a468-7ee9b81db677'])

  return ((statsRes.data ?? []) as CheerStatsRow[])
    .filter(s => !CHEER_EXCLUDED.has(s.player_id) && nameMap.has(s.player_id))
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
  const [matches, profilesRes, recentSessionsRes, seasonedRes] = await Promise.all([
    fetchCompletedMatchesForPairs(),
    supabase.from('profiles').select('id, nickname, name_slug, avatar_url').eq('is_active', true),
    supabase.from('sessions').select('id').eq('status', 'complete').order('date', { ascending: false }).limit(RECENT_SESSIONS_WINDOW),
    // Same floor the individual board applies, read from the same column, so
    // "3+ sessions played" cannot come to mean two different things.
    supabase.from('player_stats').select('player_id').gte('sessions_attended', MIN_SESSIONS_PLAYED),
  ])

  const seasonedPlayerIds = new Set(
    ((seasonedRes.data ?? []) as Array<{ player_id: string }>).map((s) => s.player_id),
  )

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
    isEligiblePlayer: (id) =>
      profileById.has(id) && activePlayerIds.has(id) && seasonedPlayerIds.has(id),
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
          marker={
            <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[9px] border border-border bg-secondary text-[15px] font-bold tabular-nums text-foreground">
              {group.rank}
            </span>
          }
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
      .map(p => [p.id, formatDisplayName(p.nickname, p.name_slug)])
  )

  const cheers = ((cheerRes.data ?? []) as Array<{ player_id: string; cheers_received: number; cheers_given: number; offense_received: number; defense_received: number; technique_received: number; movement_received: number; good_sport_received: number; solid_effort_received: number }>)
    .filter(s => nameMap.has(s.player_id))
  const stats = ((statsRes.data ?? []) as Array<{ player_id: string; sessions_attended: number }>)
    .filter(s => nameMap.has(s.player_id))
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
            {t === 'wins' ? 'Mga Lodi' : t === 'cheers' ? 'Cheers' : t === 'awards' ? 'Awards' : 'Partners'}
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
