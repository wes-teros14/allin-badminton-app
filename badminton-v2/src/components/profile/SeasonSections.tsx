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
import type { CheerStatsRow } from '@/lib/leaderboardData'
import type { Badge } from '@/lib/seasonBadges'
import type { SeasonBadgesLoad, SeasonStatsLoad } from '@/hooks/useSeasonStats'

/** "AWARDS ··· 2027 SEASON". The label says which season every number under it counts. */
export function SectionHeader({ title, scope }: { title: string; scope?: BoardScope }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{title}</h2>
      {scope && (
        <span className="shrink-0 rounded-full border border-primary-ink/35 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.08em] text-primary-ink">
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

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">{label}</p>
        <p className="text-2xl font-bold text-primary">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  )
}

const RANK_LABELS = ['🥇', '🥈', '🥉']

function RankListCard({ label, items, subLabel }: {
  label: string
  items: Array<{ nameSlug: string; count: number }>
  subLabel: (count: number) => string
}) {
  return (
    <Card className="col-span-2">
      <CardContent className="pt-5 pb-4">
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-3">{label}</p>
        {items.length === 0 ? (
          <p className="text-2xl font-bold text-primary">—</p>
        ) : (
          <ul className="space-y-2">
            {items.map((item, i) => (
              <li key={i} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <span className="text-base">{RANK_LABELS[i]}</span>
                  <span className="font-semibold text-sm">{item.nameSlug}</span>
                </span>
                <span className="text-xs text-muted-foreground shrink-0">{subLabel(item.count)}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
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
            <span className="text-2xl leading-none" aria-hidden="true">{signature.emoji}</span>
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
                {category.emoji} {category.name}
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
    <div className="flex flex-wrap gap-2">
      {badges.map((a) => (
        <div key={a.label} className="flex items-center gap-1.5 bg-gold/10 border border-gold/40 rounded-full px-3 py-1.5">
          <span className="text-base">{a.emoji}</span>
          <span className="text-xs font-semibold text-gold-ink">{a.label}</span>
        </div>
      ))}
    </div>
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
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />
      ))}
      <div className="col-span-2 h-24 bg-muted rounded-xl animate-pulse" />
      <div className="col-span-2 h-24 bg-muted rounded-xl animate-pulse" />
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
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Sessions Attended" value={String(s.sessionsAttended)} />
          <StatCard label="Games Played" value={String(s.gamesPlayed)} />
          <StatCard
            label="Win Rate"
            value={s.gamesPlayed > 0 ? `${s.wins}W ${s.gamesPlayed - s.wins}L` : '—'}
            sub={s.gamesPlayed > 0 && s.winRate > 0 ? `${s.winRate}% win rate` : 'No recorded games'}
          />
          <RankListCard
            label="Best Partners"
            items={s.bestPartners.map((p) => ({ nameSlug: p.nameSlug, count: p.wins }))}
            subLabel={(w) => `${w} win${w !== 1 ? 's' : ''} together`}
          />
          <RankListCard
            label="Toughest Opponents"
            items={s.toughestOpponents.map((o) => ({ nameSlug: o.nameSlug, count: o.losses }))}
            subLabel={(l) => `Lost ${l}×`}
          />
        </div>
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
