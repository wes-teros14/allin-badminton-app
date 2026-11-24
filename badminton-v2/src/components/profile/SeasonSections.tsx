/**
 * One player's season: Cheered for, Awards and Stats. My Profile passes the current season and the year page
 * passes a past one; there is no second layout to keep in sync. Look unchanged from the lifetime profile, plus
 * the season label on each section header (approved POC, temporary_files/season-reset-poc.html).
 */

import type { ReactNode } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BADGE_HOLD_SESSIONS, type BoardScope } from '@/lib/season'
import { switcherLabel } from '@/lib/seasonCopy'
import { ordinal } from '@/lib/celebrationLabels'
import { cheerSharePct } from '@/lib/cheerShare'
import { CHEER_CATEGORIES, signatureCheer } from '@/lib/cheerTypes'
import { GlyphIcon } from '@/components/GlyphIcon'
import type { CheerStatsRow } from '@/lib/leaderboardData'
import type { Badge } from '@/lib/seasonBadges'
import type { SeasonBadgesLoad, SeasonStatsLoad } from '@/hooks/useSeasonStats'

/** "Awards ··· 2027 season". The label says which season every number under it counts. */
export function SectionHeader({ title, scope }: { title: string; scope?: BoardScope }) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-3">
      <h2 className="text-[17px] font-bold tracking-[-0.01em] text-foreground">{title}</h2>
      {scope && (
        <span className="shrink-0 text-xs font-semibold text-primary-ink">
          {switcherLabel(scope.season, scope.isCurrent)}
        </span>
      )}
    </div>
  )
}

/** A failed read in place of a section. Never rendered as zeros or "nothing yet". */
export function SectionError({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-xl border border-border bg-card px-4 py-4 text-center">
      <p className="text-sm font-semibold text-foreground">Couldn’t load {what}</p>
      <Button variant="outline" onClick={onRetry} className="mt-3 min-h-11 px-5">
        Retry
      </Button>
    </div>
  )
}

/** One figure in the ruled stats row: the number leads, the label sits under it. */
function StatFigure({ value, label }: { value: string; label: string }) {
  return (
    <div className="min-w-0 py-3 [&+&]:border-l [&+&]:border-border [&+&]:pl-3">
      <p className="text-[22px] font-bold leading-tight tracking-[-0.02em] tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

/**
 * 1st, 2nd and 3rd as numbered discs in gold, silver and bronze, in place of medal emoji. Dark ink on all
 * three: the lightest disc fill is ~9:1 and the darkest (light-theme gold) ~5:1 against #1B1220.
 */
const RANK_DISC = ['bg-gold', 'bg-[#B8B2C0]', 'bg-[#C98A55]']

export function RankDisc({ rank }: { rank: number }) {
  return (
    <span
      className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-extrabold tabular-nums text-[#1B1220] ${RANK_DISC[rank - 1] ?? 'bg-muted'}`}
      aria-label={`Rank ${rank}`}
    >
      {rank}
    </span>
  )
}

function RankList({ label, items, subLabel }: {
  label: string
  items: Array<{ nameSlug: string; count: number }>
  subLabel: (count: number) => string
}) {
  return (
    <div className="mt-5">
      <h3 className="mb-1 text-sm font-semibold text-muted-foreground">{label}</h3>
      {items.length === 0 ? (
        <p className="border-t border-border py-3 text-sm text-muted-foreground">None yet</p>
      ) : (
        <ul className="border-t border-border">
          {items.map((item, i) => (
            <li key={i} className="flex items-center gap-3 border-b border-border py-2.5">
              <RankDisc rank={i + 1} />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{item.nameSlug}</span>
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{subLabel(item.count)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * What this player is cheered for: their strongest cheer type, and a bar
 * showing how their received cheers split across all six.
 *
 * A share rather than a count, for the same reason the boards are — cheering
 * is compulsory after every game, so a raw total only says how many matches
 * someone played. The segments add to 100%: every cheer counts toward its
 * total and exactly one category.
 */
export function CheerSignature({ stats, scope }: { stats: CheerStatsRow | null; scope: BoardScope }) {
  if (!stats || stats.cheers_received <= 0) return null

  const signature = signatureCheer(stats)
  if (!signature) return null

  return (
    <div>
      <SectionHeader title="Cheered for" scope={scope} />
      <Card>
        <CardContent className="pt-4 pb-4 space-y-3">
          <div className="flex items-center gap-2">
            <GlyphIcon emoji={signature.emoji} size={20} swatch />
            <div className="flex-1 min-w-0">
              <p className="truncate text-[15px] font-semibold leading-tight">{signature.name}</p>
              <p className="text-xs text-muted-foreground tabular-nums">
                of {stats.cheers_received} cheers received
              </p>
            </div>
            <span className="shrink-0 text-[17px] font-bold text-primary tabular-nums">
              {cheerSharePct(signature.of(stats), stats.cheers_received)}%
            </span>
          </div>

          <div
            className="flex h-2.5 overflow-hidden rounded-full bg-secondary"
            role="img"
            aria-label={CHEER_CATEGORIES
              .filter((c) => c.of(stats) > 0)
              .map((c) => `${c.name} ${cheerSharePct(c.of(stats), stats.cheers_received)} percent`)
              .join(', ')}
          >
            {CHEER_CATEGORIES.map((category) => {
              const pct = cheerSharePct(category.of(stats), stats.cheers_received)
              if (pct <= 0) return null
              return (
                <span
                  key={category.slug}
                  style={{ width: `${pct}%`, backgroundColor: category.color }}
                  className="h-full"
                />
              )
            })}
          </div>

          <div className="flex flex-wrap gap-x-3 gap-y-1.5">
            {CHEER_CATEGORIES.filter((c) => c.of(stats) > 0).map((category) => (
              <span key={category.slug} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span
                  className="h-2 w-2 shrink-0 rounded-[2px]"
                  style={{ backgroundColor: category.color }}
                  aria-hidden="true"
                />
                {category.name}
                <span className="font-semibold text-foreground tabular-nums">
                  {cheerSharePct(category.of(stats), stats.cheers_received)}%
                </span>
              </span>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function BadgeList({ badges }: { badges: Badge[] }) {
  return (
    <ul className="border-t border-border">
      {badges.map((a) => (
        <li key={a.label} className="flex items-center gap-3 border-b border-border py-2.5">
          <GlyphIcon emoji={a.emoji} swatch />
          <span className="text-sm font-semibold">{a.label}</span>
        </li>
      ))}
    </ul>
  )
}

function Awards({ scope, badges }: { scope: BoardScope; badges: SeasonBadgesLoad }) {
  let body: ReactNode
  if (badges.error) body = <SectionError what="your awards" onRetry={badges.refresh} />
  else if (badges.badges === null) body = <div className="h-8 w-40 bg-muted rounded-full animate-pulse" />
  else if (badges.held) {
    body = (
      <p className="text-sm text-muted-foreground">
        Award badges appear after the season’s {ordinal(BADGE_HOLD_SESSIONS)} session.
      </p>
    )
  } else if (badges.badges.length > 0) body = <BadgeList badges={badges.badges} />
  else if (scope.isCurrent) body = <p className="text-sm text-muted-foreground">No awards yet — keep playing!</p>
  else body = <p className="text-sm text-muted-foreground">No awards in {scope.season.id}.</p>

  return (
    <div>
      <SectionHeader title="Awards" scope={scope} />
      {body}
    </div>
  )
}

function StatsSkeleton() {
  return (
    <div className="space-y-3">
      <div className="h-16 bg-muted rounded-lg animate-pulse" />
      <div className="h-24 bg-muted rounded-lg animate-pulse" />
      <div className="h-24 bg-muted rounded-lg animate-pulse" />
    </div>
  )
}

function Stats({
  scope,
  stats,
  lead,
}: {
  scope: BoardScope
  stats: SeasonStatsLoad
  lead: string | null
}) {
  const s = stats.stats
  let body: ReactNode
  if (stats.error) body = <SectionError what="your stats" onRetry={stats.refresh} />
  else if (!s) body = <StatsSkeleton />
  else {
    body = (
      <>
        {lead && <p className="mb-3 text-sm text-muted-foreground">{lead}.</p>}
        <div className="grid grid-cols-3 border-y border-border">
          <StatFigure value={String(s.sessionsAttended)} label={s.sessionsAttended === 1 ? 'session' : 'sessions'} />
          <StatFigure value={String(s.gamesPlayed)} label={s.gamesPlayed === 1 ? 'game' : 'games'} />
          <StatFigure
            value={s.gamesPlayed > 0 ? `${s.winRate}%` : '—'}
            label={s.gamesPlayed > 0 ? `won · ${s.wins}W ${s.gamesPlayed - s.wins}L` : 'no games yet'}
          />
        </div>
        <RankList
          label="Best partners"
          items={s.bestPartners.map((p) => ({ nameSlug: p.nameSlug, count: p.wins }))}
          subLabel={(w) => `${w} win${w !== 1 ? 's' : ''} together`}
        />
        <RankList
          label="Toughest opponents"
          items={s.toughestOpponents.map((o) => ({ nameSlug: o.nameSlug, count: o.losses }))}
          subLabel={(l) => `Lost ${l}×`}
        />
      </>
    )
  }

  return (
    <div>
      <SectionHeader title="Stats" scope={scope} />
      {body}
    </div>
  )
}

/**
 * The season's sections. `stats` and `badges` are the hooks' load states, so each section shows its own
 * loading skeleton or error. `lead` is a line above the Stats, e.g. "Your 2027 season starts with the Nov 22
 * session" while the season has nothing played yet.
 */
export function SeasonSections({
  scope,
  stats,
  badges,
  lead = null,
}: {
  scope: BoardScope
  stats: SeasonStatsLoad
  badges: SeasonBadgesLoad
  lead?: string | null
}) {
  return (
    <>
      <CheerSignature stats={stats.error ? null : stats.cheers} scope={scope} />
      <Awards scope={scope} badges={badges} />
      <Stats scope={scope} stats={stats} lead={lead} />
    </>
  )
}
