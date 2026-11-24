/**
 * The ranked-board presentation every win-rate and share board uses: a ruled
 * list with gold / silver / bronze discs for places 1-3 (on a faint tint band),
 * a labelled divider, then numbered discs below. A shared place is one band
 * holding every tied row. No boxes: the rows sit on the page (2026-11-24, owner's
 * ban on cards inside cards and emoji icons).
 *
 * Lives here rather than in LeaderboardView so the session board on
 * SessionPlayerDetailView draws through the same code. It used to carry its own
 * index-numbered list, which gave two players on the same rate different medals.
 */

import type { ReactNode } from 'react'
import { Avatar } from '@/components/Avatar'
import { RankDisc } from '@/components/RankDisc'
import { groupByRank, type RankGroup } from '@/lib/denseRank'
import { PODIUM_PLACES } from '@/lib/leaderboardData'

/**
 * First place borrows `--gold`, the same token the award toast uses, so the two
 * golds in the app cannot drift. Silver and bronze have no tokens; palette
 * values are used rather than inventing two more. Bronze is amber-700 (brown)
 * rather than an orange — an orange wash on a dark card reads as the
 * destructive red.
 */
const PODIUM_TINT = [
  'bg-gold/[0.08]',
  'bg-zinc-400/[0.07]',
  'bg-amber-700/[0.09]',
] as const

/**
 * The marker for every place, on all ranked surfaces. Fixed 34px: the width is
 * what keeps the rank column aligned, so it must not vary between boards or
 * between tied and untied places.
 */
function RankMarker({ rank }: { rank: number }) {
  return <RankDisc rank={rank} size="md" />
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
      className={`flex gap-3 ${isTie ? 'items-start px-2.5 py-2.5' : 'items-center py-2.5 pl-2.5 pr-3.5'} ${frameClassName}`}
      aria-label={isTie ? `Rank ${group.rank}, ${group.items.length} ${tiedNoun} tied` : undefined}
    >
      {marker}

      {isTie ? (
        <div className="min-w-0 flex-1">
          <p className="px-1 pb-1 text-xs font-semibold text-muted-foreground">
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

/** Lift-and-shimmer, skipped entirely when the player asked for reduced motion. */
function sweepClassName(active: boolean): string {
  if (!active) return ''
  try {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return ''
  } catch { /* treat an unavailable matchMedia as "motion is fine" */ }
  return 'animate-celebration-lift relative overflow-hidden after:pointer-events-none after:absolute after:inset-0 after:bg-[linear-gradient(105deg,transparent_30%,var(--gold)_50%,transparent_70%)] after:opacity-40 after:[animation:celebration-sweep_1.15s_ease-out_2]'
}

/**
 * A whole board: medal podium for places 1-3, a labelled divider, then numbered
 * chips for every place below. Every ranked board renders through this, so
 * their rank columns cannot drift apart again.
 *
 * `entries` must already carry dense ranks (`assignDenseRanks`) and be ordered.
 */
export function RankedBoard<T extends { rank: number }>({
  entries,
  renderRow,
  keyOf,
  tiedNoun,
  isOwnRow,
}: {
  entries: readonly T[]
  renderRow: (item: T, variant: 'podium' | 'list') => ReactNode
  keyOf: (item: T) => string
  tiedNoun: string
  /** Marks the viewing player's own place, so a celebration can point at it. */
  isOwnRow?: (item: T) => boolean
}) {
  const groups = groupByRank(entries)
  const ownRowClassName = sweepClassName(true)
  const podium = groups.filter((g) => g.rank <= PODIUM_PLACES)
  const rest = groups.filter((g) => g.rank > PODIUM_PLACES)
  // Named from the places actually on screen, not from MAX_PLACES — a board
  // holding six places must not advertise a tenth that isn't there.
  const restLabel =
    rest.length === 0 ? null
    : rest[0].rank === rest[rest.length - 1].rank ? `Place ${rest[0].rank}`
    : `Places ${rest[0].rank}–${rest[rest.length - 1].rank}`

  return (
    <div className="divide-y divide-border border-y border-border">
      {podium.map((group) => (
        <RankPlace
          key={group.rank}
          group={group}
          tiedNoun={tiedNoun}
          keyOf={keyOf}
          renderRow={(item) => renderRow(item, 'podium')}
          frameClassName={`${PODIUM_TINT[group.rank - 1]} ${
            isOwnRow && group.items.some(isOwnRow) ? ownRowClassName : ''
          }`}
          marker={<RankMarker rank={group.rank} />}
        />
      ))}

      {restLabel && (
        <p className="px-1 pb-1.5 pt-4 text-xs font-semibold text-muted-foreground">
          {restLabel}
        </p>
      )}

      {rest.map((group) => (
        <RankPlace
          key={group.rank}
          group={group}
          tiedNoun={tiedNoun}
          keyOf={keyOf}
          renderRow={(item) => renderRow(item, 'list')}
          frameClassName={`${
            isOwnRow && group.items.some(isOwnRow) ? ownRowClassName : ''
          }`}
          marker={<RankMarker rank={group.rank} />}
        />
      ))}
    </div>
  )
}

export function RowStat({
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
      <p className={`font-bold text-primary-ink tabular-nums ${podium ? 'text-[17px]' : 'text-sm'}`}>{winRate}%</p>
      <p className="text-xs text-muted-foreground tabular-nums">{wins}W {losses}L</p>
    </div>
  )
}

/** Everything on an individual row except the marker, which the place owns. */
export function PlayerRowBody({
  entry,
  variant,
}: {
  entry: { avatarUrl: string | null; displayName: string; winRate: number; wins: number; losses: number }
  variant: 'podium' | 'list'
}) {
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
