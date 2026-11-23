import { useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import {
  fetchCheerLeaderboard,
  fetchPairLeaderboard,
  fetchWinsLeaderboard,
  MIN_GAMES_TOGETHER,
} from '@/lib/leaderboardData'
import type {
  CheerLeaderboardEntry,
  LeaderboardEntry,
  PairLeaderboardEntry,
} from '@/lib/leaderboardData'
import { MIN_CHEERS_RECEIVED, rankCheerShares } from '@/lib/cheerShare'
import { AWARD_PLACES } from '@/lib/denseRank'
import { CHEER_CATEGORIES } from '@/lib/cheerTypes'
import type { CheerCategory } from '@/lib/cheerTypes'
import type { CheerTypeSlug } from '@/types/app'
import { fetchBoardPending, RECENT_SESSIONS_WINDOW } from '@/lib/boardEligibility'
import { fetchAwardsLeaderboard, type AwardEntry, type AwardRow } from '@/lib/awardsLeaderboard'
import { isAwardKey } from '@/lib/awardBoards'
import { boardScope, currentSeason, localToday, pastSeasons, type BoardScope, type Season } from '@/lib/season'
import { floorCount, floorUnit, seasonRange, seasonStartLine } from '@/lib/seasonCopy'
import { Avatar } from '@/components/Avatar'
import { PlayerRowBody, RankedBoard, RowStat } from '@/components/RankedBoard'
import { SeasonSwitcher } from '@/components/SeasonSwitcher'
import {
  BetweenSeasonsCard,
  BoardError,
  NobodyYetCard,
  PendingFooter,
  SeasonCaption,
} from '@/components/LeaderboardStates'
import { useAuth } from '@/hooks/useAuth'
import { useSeasonStatus } from '@/hooks/useSeasonStatus'
import { clearSweepDebt, readCurrentSweepDebt } from '@/lib/celebrationStorage'
import { boardTab } from '@/lib/celebrationLabels'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Tab = 'wins' | 'pairs' | 'cheers' | 'awards'
const TABS: readonly Tab[] = ['wins', 'pairs', 'cheers', 'awards']
const isTab = (value: string | null): value is Tab => TABS.includes(value as Tab)

type Pending = { waiting: number; viewerSessions: number | null }

/** What every board needs to know about the season it shows. */
interface SeasonView {
  scope: BoardScope
  /** First to last played session, for a past season's caption. */
  range: string | null
  viewerId: string | null
  /** The season the "final standings" link opens; null when viewing a past season or none exists. */
  linkSeason: Season | null
  onShowSeason: (id: string) => void
}

type BoardLoad<T> =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready'; data: T; pending: Pending | null }

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Whether the player's own row on `tab` should play the celebration sweep.
 *
 * The debt is armed when a celebration is shown, not when its toast is accepted,
 * so this fires for a player who tapped "View" *and* for one who wandered here
 * on their own days later. Getting that wrong is invisible — the screen looks
 * correct and simply never shimmers.
 *
 * Only the current season celebrates: while a past season is shown the debt is
 * left uncollected, so it still plays when the player switches back.
 */
function useOwedSweep(tab: Tab, enabled: boolean): boolean {
  const { user } = useAuth()
  const [owed, setOwed] = useState(false)

  useEffect(() => {
    const playerId = user?.id
    if (!playerId || !enabled) return

    const debt = readCurrentSweepDebt(playerId)
    if (!debt || boardTab(debt.board) !== tab) return

    setOwed(true)
    // Collected. A sweep is a one-off, not a permanent decoration on the row.
    clearSweepDebt(playerId)
  }, [user?.id, tab, enabled])

  return owed && enabled
}

/**
 * One board's rows plus, for the current season, who is still waiting to qualify at `floor`. Both
 * must load: a failure of either is the error state, never an empty or partial board.
 */
function useBoardLoad<T>(
  view: SeasonView,
  fetchBoard: (scope: BoardScope) => Promise<T>,
  floor: number,
): { load: BoardLoad<T>; retry: () => void } {
  const { scope, viewerId } = view
  const [load, setLoad] = useState<BoardLoad<T>>({ kind: 'loading' })
  const request = useRef(0)

  const run = useCallback(async () => {
    const id = ++request.current
    setLoad({ kind: 'loading' })
    try {
      const [data, pending] = await Promise.all([
        fetchBoard(scope),
        scope.isCurrent ? fetchBoardPending(scope, floor, viewerId) : Promise.resolve(null),
      ])
      if (id === request.current) setLoad({ kind: 'ready', data, pending })
    } catch (error) {
      console.error('[leaderboard] board failed to load', error)
      if (id === request.current) setLoad({ kind: 'error' })
    }
  }, [scope, fetchBoard, floor, viewerId])

  useEffect(() => { run() }, [run])

  return { load, retry: run }
}

// ---------------------------------------------------------------------------
// Sub-components (the ranked-board presentation itself is in components/RankedBoard)
// ---------------------------------------------------------------------------

function BoardSkeleton({ height }: { height: string }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className={`${height} rounded-xl bg-muted animate-pulse`} />
      ))}
    </div>
  )
}

/**
 * The empty-board card, with the viewer's progress when they are one of those waiting. `title` overrides
 * the minimum wording for a board whose emptiness is not about the minimum (a streak nobody has yet).
 */
function NobodyYet({
  view,
  floor,
  pending,
  note,
  title,
}: {
  view: SeasonView
  floor: number
  pending: Pending | null
  note?: string
  title?: string
}) {
  return (
    <NobodyYetCard
      title={title ?? (view.scope.isCurrent ? 'Nobody has reached the minimum yet' : 'Nobody reached the minimum this season')}
      note={note}
      progress={
        pending?.viewerSessions != null
          ? { sessions: pending.viewerSessions, floor, unit: floorUnit(view.scope.season) }
          : null
      }
      pastSeason={view.linkSeason}
      onShowSeason={view.onShowSeason}
    />
  )
}

/** Caption, then loading / error / the board itself, then the waiting footer. */
function BoardFrame<T>({
  view,
  load,
  retry,
  rule,
  floor,
  skeleton,
  hideFooter = false,
  children,
}: {
  view: SeasonView
  load: BoardLoad<T>
  retry: () => void
  rule: string
  floor: number
  skeleton: string
  /** For a board whose own floor differs from the tab's (Early Bird), where the tab's count would mislead. */
  hideFooter?: boolean
  children: (data: T, pending: Pending | null) => ReactNode
}) {
  return (
    <div className="space-y-2">
      <SeasonCaption scope={view.scope} range={view.range} rule={rule} />
      {load.kind === 'loading' ? (
        <BoardSkeleton height={skeleton} />
      ) : load.kind === 'error' ? (
        <BoardError onRetry={retry} />
      ) : (
        <>
          {children(load.data, load.pending)}
          {!hideFooter && <PendingFooter pending={load.pending} floor={floor} />}
        </>
      )}
    </div>
  )
}

function WinsLeaderboard({ view }: { view: SeasonView }) {
  const { season, isCurrent } = view.scope
  const floor = season.floors.individual
  const { load, retry } = useBoardLoad(view, fetchWinsLeaderboard, floor)
  const swept = useOwedSweep('wins', isCurrent)

  return (
    <BoardFrame<LeaderboardEntry[]>
      view={view}
      load={load}
      retry={retry}
      floor={floor}
      skeleton="h-14"
      rule={`ranked by win rate · min. ${floorCount(season, floor)} · must be active in the last ${RECENT_SESSIONS_WINDOW}`}
    >
      {(entries, pending) =>
        entries.length === 0 ? (
          <NobodyYet view={view} floor={floor} pending={pending} note={`Players appear after ${floorCount(season, floor)}.`} />
        ) : (
          <RankedBoard
            entries={entries}
            tiedNoun="players"
            keyOf={(entry) => entry.playerId}
            isOwnRow={swept ? (entry) => entry.playerId === view.viewerId : undefined}
            renderRow={(entry, variant) => <PlayerRowBody entry={entry} variant={variant} />}
          />
        )
      }
    </BoardFrame>
  )
}

function PairsLeaderboard({ view }: { view: SeasonView }) {
  const { season, isCurrent } = view.scope
  const floor = season.floors.played
  const { load, retry } = useBoardLoad(view, fetchPairLeaderboard, floor)
  const swept = useOwedSweep('pairs', isCurrent)

  return (
    <BoardFrame<PairLeaderboardEntry[]>
      view={view}
      load={load}
      retry={retry}
      floor={floor}
      skeleton="h-16"
      rule={`ranked by win rate · min. ${MIN_GAMES_TOGETHER} games together · both players with ${floorCount(season, floor)} and active in the last ${RECENT_SESSIONS_WINDOW}`}
    >
      {(entries, pending) =>
        entries.length === 0 ? (
          <NobodyYet
            view={view}
            floor={floor}
            pending={pending}
            note={`A partnership appears once both players have ${floorCount(season, floor)} and ${MIN_GAMES_TOGETHER} games together.`}
          />
        ) : (
          <RankedBoard
            entries={entries}
            tiedNoun="partnerships"
            keyOf={(entry) => entry.key}
            isOwnRow={swept ? (entry) => entry.players.some((p) => p.id === view.viewerId) : undefined}
            renderRow={(entry, variant) => <PairRowBody entry={entry} variant={variant} />}
          />
        )
      }
    </BoardFrame>
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
 *
 * Rendered through the same `RankedBoard` as the win-rate boards, so a podium,
 * a tie group and a rank chip mean the same thing on every tab.
 */
function CheerShareList({
  category,
  entries,
  swept,
  viewerId,
}: {
  category: CheerCategory
  entries: CheerLeaderboardEntry[]
  swept: boolean
  viewerId: string | null
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
          isOwnRow={swept ? (row) => row.playerId === viewerId : undefined}
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

function CheersLeaderboard({ view }: { view: SeasonView }) {
  const { season, isCurrent } = view.scope
  const floor = season.floors.cheers
  const { load, retry } = useBoardLoad(view, fetchCheerLeaderboard, floor)
  const swept = useOwedSweep('cheers', isCurrent)
  const [slug, setSlug] = useState<CheerTypeSlug>(CHEER_CATEGORIES[0].slug)
  const selected = CHEER_CATEGORIES.find((c) => c.slug === slug) ?? CHEER_CATEGORIES[0]

  return (
    <BoardFrame<CheerLeaderboardEntry[]>
      view={view}
      load={load}
      retry={retry}
      floor={floor}
      skeleton="h-14"
      rule={`ranked by share of each player’s cheers · min. ${MIN_CHEERS_RECEIVED} cheers received · ${floorCount(season, floor)} · must be active in the last ${RECENT_SESSIONS_WINDOW}`}
    >
      {(entries, pending) =>
        entries.length === 0 ? (
          <NobodyYet
            view={view}
            floor={floor}
            pending={pending}
            note={`Players appear after ${MIN_CHEERS_RECEIVED} cheers received and ${floorCount(season, floor)}.`}
          />
        ) : (
          <div className="space-y-4 pt-2">
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

            <CheerShareList category={selected} entries={entries} swept={swept} viewerId={view.viewerId} />
          </div>
        )
      }
    </BoardFrame>
  )
}

/**
 * The Awards tab, laid out like the Cheers tab (2026-10-06): one award at a
 * time behind a switcher, top AWARD_PLACES, drawn through the same RankedBoard as every other
 * tab. It used to be a stack of bespoke cards, the only tab that looked
 * different from the other three.
 */
/** Awards that are empty only while nobody has reached their session minimum. */
const MINIMUM_DRIVEN_AWARDS: ReadonlySet<string> = new Set(['joined', 'early-bird'])

function AwardsLeaderboard({ view }: { view: SeasonView }) {
  const { season, isCurrent } = view.scope
  const floor = season.floors.played
  const { load, retry } = useBoardLoad(view, fetchAwardsLeaderboard, floor)
  const [searchParams] = useSearchParams()
  const linked = searchParams.get('award')
  // A celebration's "See the board" links straight to the award that moved.
  const [selectedKey, setSelectedKey] = useState<string | null>(isAwardKey(linked) ? linked : null)
  const swept = useOwedSweep('awards', isCurrent)

  return (
    <BoardFrame<AwardEntry[]>
      view={view}
      load={load}
      retry={retry}
      floor={floor}
      skeleton="h-14"
      hideFooter={selectedKey === 'early-bird'}
      rule={`top ${AWARD_PLACES} · min. ${floorCount(season, floor)} · must be active in the last ${RECENT_SESSIONS_WINDOW}`}
    >
      {(awards, pending) => {
        if (awards.length === 0) {
          return <NobodyYet view={view} floor={floor} pending={pending} note={`Players appear after ${floorCount(season, floor)}.`} />
        }
        const selected = awards.find((a) => a.key === selectedKey) ?? awards[0]
        return (
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-5 gap-1.5">
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
                MINIMUM_DRIVEN_AWARDS.has(selected.key) ? (
                  <NobodyYet
                    view={view}
                    floor={floor}
                    // Early Bird's own floor is higher than the tab's; progress against the tab's would mislead.
                    pending={selected.key === 'early-bird' ? null : pending}
                    note={selected.emptyText}
                  />
                ) : (
                  // A streak or an upset nobody has managed yet: not a minimum, so its own words are the title.
                  <NobodyYet view={view} floor={floor} pending={null} title={selected.emptyText} />
                )
              ) : (
                <RankedBoard
                  entries={selected.rows}
                  tiedNoun="players"
                  keyOf={(row) => row.playerId}
                  isOwnRow={swept ? (row) => row.playerId === view.viewerId : undefined}
                  renderRow={(row, variant) => (
                    <AwardRowBody
                      row={row}
                      valueLabel={selected.format ? selected.format(row.value) : String(row.value)}
                      unit={row.detail ?? selected.unit(row.value)}
                      variant={variant}
                    />
                  )}
                />
              )}
            </div>
          </div>
        )
      }}
    </BoardFrame>
  )
}

/** Everything on an award row except the marker, which the place owns. */
function AwardRowBody({
  row,
  valueLabel,
  unit,
  variant,
}: {
  row: AwardRow
  valueLabel: string
  unit: string
  variant: 'podium' | 'list'
}) {
  const podium = variant === 'podium'
  return (
    <>
      <span className={`flex-1 min-w-0 truncate ${podium ? 'text-[15px] font-semibold' : 'text-sm font-medium'}`}>
        {row.name}
      </span>
      <div className="text-right shrink-0">
        <p className={`font-bold text-primary-ink tabular-nums ${podium ? 'text-[17px]' : 'text-sm'}`}>{valueLabel}</p>
        <p className="text-xs text-muted-foreground">{unit}</p>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------
const TAB_LABEL: Record<Tab, string> = { wins: 'Individual', pairs: 'Partners', cheers: 'Cheers', awards: 'Awards' }

export function LeaderboardView() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuth()
  // Fixed for the life of the screen, so a scope never changes under a board mid-read.
  const [today] = useState(localToday)
  const seasonParam = searchParams.get('season')
  const scope = useMemo(() => boardScope(seasonParam, today), [seasonParam, today])
  const options = useMemo(() => [currentSeason(today), ...pastSeasons(today)], [today])
  const tabParam = searchParams.get('tab')
  const tab: Tab = isTab(tabParam) ? tabParam : 'wins'
  const { status, retry } = useSeasonStatus(scope)

  const setTab = (next: Tab) => {
    const params = new URLSearchParams(searchParams)
    params.set('tab', next)
    setSearchParams(params, { replace: true })
  }

  const showSeason = useCallback((id: string) => {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev)
      // The current season is the default: its URL carries no ?season=.
      if (id === options[0].id) params.delete('season')
      else params.set('season', id)
      return params
    })
  }, [setSearchParams, options])

  const view: SeasonView | null = status.kind === 'ready'
    ? {
        scope,
        range: seasonRange(status.played),
        viewerId: user?.id ?? null,
        linkSeason: scope.isCurrent ? (options[1] ?? null) : null,
        onShowSeason: showSeason,
      }
    : null

  const betweenSeasons = status.kind === 'ready' && scope.isCurrent && status.played.length === 0

  return (
    <div className="max-w-sm sm:max-w-md md:max-w-lg mx-auto px-4 py-8">
      <div className="mb-4 flex items-center justify-between gap-2.5">
        <h1 className="text-xl font-bold">Leaderboard</h1>
        <SeasonSwitcher value={scope.season.id} options={options} onChange={showSeason} />
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 mb-6" role="tablist" aria-label="Leaderboard categories">
        {TABS.map((t) => (
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
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`tabpanel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {status.kind === 'loading' ? (
          <BoardSkeleton height="h-14" />
        ) : status.kind === 'error' ? (
          <BoardError onRetry={retry} />
        ) : betweenSeasons ? (
          <BetweenSeasonsCard
            line={seasonStartLine(scope.season, status.nextDate)}
            pastSeason={options[1] ?? null}
            onShowSeason={showSeason}
          />
        ) : view && (
          // Keyed by season so a switch starts each board fresh (its own cheer or award choice included).
          <div key={scope.season.id}>
            {tab === 'wins' && <WinsLeaderboard view={view} />}
            {tab === 'pairs' && <PairsLeaderboard view={view} />}
            {tab === 'cheers' && <CheersLeaderboard view={view} />}
            {tab === 'awards' && <AwardsLeaderboard view={view} />}
          </div>
        )}
      </div>
    </div>
  )
}

export default LeaderboardView
