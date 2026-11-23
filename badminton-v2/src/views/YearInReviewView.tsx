import { useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import { useSeasonBadges, useSeasonStats, useWhereYouFinished } from '@/hooks/useSeasonStats'
import { useSeasonStatus } from '@/hooks/useSeasonStatus'
import { boardScope, localToday, type Season } from '@/lib/season'
import { seasonRange } from '@/lib/seasonCopy'
import { resolvePastSeason } from '@/lib/yearInReview'
import { SeasonSections, SectionError, SectionHeader } from '@/components/profile/SeasonSections'

/**
 * "Your 2026 season": the signed-in player's own ended season. No player id in the route, so nobody else's
 * page can be opened. The current season, an unknown id, or a season the player never played sends them
 * back to My Profile.
 */
export function YearInReviewView() {
  const { seasonId } = useParams()
  const [today] = useState(localToday)
  const season = resolvePastSeason(seasonId, today)
  if (!season) return <Navigate to="/profile" replace />
  return <YearPage key={season.id} season={season} today={today} />
}

function YearPage({ season, today }: { season: Season; today: string }) {
  const { user, isLoading: authLoading } = useAuth()
  const scope = useMemo(() => boardScope(season.id, today), [season.id, today])
  const stats = useSeasonStats(user?.id, scope)
  // The board reads wait until the stats show this player played the season; otherwise the page redirects.
  const playedId = stats.stats && stats.stats.sessionsAttended > 0 ? user?.id : undefined
  const badgesLoad = useSeasonBadges(playedId, scope)
  const finishLoad = useWhereYouFinished(playedId, scope)
  // Those reads never start while the stats have failed, so they carry the stats' error and its Retry
  // instead of a skeleton that would wait forever. Retrying the stats starts them once it succeeds.
  const badges = stats.error ? { ...badgesLoad, error: stats.error, refresh: stats.refresh } : badgesLoad
  const finish = stats.error ? { ...finishLoad, error: stats.error, refresh: stats.refresh } : finishLoad
  const { status, retry } = useSeasonStatus(scope)

  if (authLoading) return <div className="p-6">Loading…</div>
  // My Profile carries the sign-in prompt.
  if (!user) return <Navigate to="/profile" replace />
  // A season this player has no played session in has no page.
  if (stats.stats && stats.stats.sessionsAttended === 0) return <Navigate to="/profile" replace />

  return (
    <div className="p-6 max-w-lg mx-auto space-y-6">
      <div>
        <Link
          to="/profile"
          className="-ml-1 inline-flex min-h-11 items-center rounded px-1 text-[13px] font-bold text-primary-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          ‹&nbsp;My Profile
        </Link>
        <h1 className="text-[21px] font-extrabold leading-tight tracking-tight">Your {season.id} season</h1>
        {status.kind === 'error' ? (
          <div className="mt-3"><SectionError what="this season’s dates" onRetry={retry} /></div>
        ) : status.kind === 'loading' ? (
          <div className="mt-1.5 h-4 w-36 rounded bg-muted animate-pulse" />
        ) : (
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">
            {[seasonRange(status.played), 'final'].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>

      <div>
        <SectionHeader title="Where you finished" />
        {finish.error ? (
          <SectionError what="your places" onRetry={finish.refresh} />
        ) : finish.rows === null ? (
          <div className="h-28 rounded-[14px] bg-muted animate-pulse" />
        ) : finish.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">You didn’t place on a {season.id} board.</p>
        ) : (
          <div className="rounded-[14px] border border-border bg-card px-3.5 py-1">
            {finish.rows.map((row, i) => (
              <div
                key={row.board}
                className={`flex items-center justify-between gap-3 py-2 text-[13px] ${i > 0 ? 'border-t border-border' : ''}`}
              >
                <b className="min-w-0 truncate font-bold text-foreground">{row.board}</b>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{row.detail}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <SeasonSections scope={scope} stats={stats} badges={badges} />
    </div>
  )
}

export default YearInReviewView
