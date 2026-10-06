import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router'
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
import { AWARD_PLACES } from '@/lib/denseRank'
import { CHEER_CATEGORIES } from '@/lib/cheerTypes'
import type { CheerCategory } from '@/lib/cheerTypes'
import type { CheerTypeSlug } from '@/types/app'
import { MIN_SESSIONS_PLAYED, RECENT_SESSIONS_WINDOW } from '@/lib/boardEligibility'
import { fetchAwardsLeaderboard, type AwardEntry, type AwardRow } from '@/lib/awardsLeaderboard'
import { isAwardKey } from '@/lib/awardBoards'
import { Avatar } from '@/components/Avatar'
import { PlayerRowBody, RankedBoard, RowStat } from '@/components/RankedBoard'
import { useAuth } from '@/hooks/useAuth'
import { clearSweepDebt, readCurrentSweepDebt } from '@/lib/celebrationStorage'
import { boardTab } from '@/lib/celebrationLabels'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Tab = 'wins' | 'pairs' | 'cheers' | 'awards'

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

/**
 * The Awards tab, laid out like the Cheers tab (2026-10-06): one award at a
 * time behind a switcher, top AWARD_PLACES, drawn through the same RankedBoard as every other
 * tab. It used to be a stack of bespoke cards, the only tab that looked
 * different from the other three.
 */
function AwardsLeaderboard() {
  const [awards, setAwards] = useState<AwardEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchParams] = useSearchParams()
  const linked = searchParams.get('award')
  // A celebration's "See the board" links straight to the award that moved.
  const [selectedKey, setSelectedKey] = useState<string | null>(isAwardKey(linked) ? linked : null)
  const { user } = useAuth()
  const swept = useOwedSweep('awards')

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
        Top {AWARD_PLACES} · {MIN_SESSIONS_PLAYED}+ sessions played and active in the last {RECENT_SESSIONS_WINDOW}
      </p>

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
          <p className="text-sm text-muted-foreground">{selected.emptyText}</p>
        ) : (
          <RankedBoard
            entries={selected.rows}
            tiedNoun="players"
            keyOf={(row) => row.playerId}
            isOwnRow={swept ? (row) => row.playerId === user?.id : undefined}
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
