/**
 * Everything on a Leaderboard tab that is not the ranked board itself: the season caption, the cards that
 * stand in for a board (between seasons, nobody qualifies yet, a failed load) and the waiting footer.
 * Look from the approved POC (temporary_files/season-reset-poc.html), drawn with the app's tokens.
 */

import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import type { BoardScope, Season } from '@/lib/season'
import { pendingLine, viewerProgress } from '@/lib/seasonCopy'

/**
 * "**2027 season** · ranked by win rate · …", or for a past season
 * "**2026 season** · final · Mar 22 – Nov 15" over the rule line.
 */
export function SeasonCaption({ scope, range, rule }: { scope: BoardScope; range: string | null; rule: string }) {
  const name = <b className="font-bold text-foreground">{scope.season.id} season</b>
  return (
    <p className="text-xs text-muted-foreground text-center pb-1">
      {scope.isCurrent ? (
        <>{name} · {rule}</>
      ) : (
        <>
          {name} · final{range !== null && <> · {range}</>}
          <br />
          {rule.charAt(0).toUpperCase() + rule.slice(1)}
        </>
      )}
    </p>
  )
}

/** "See the 2026 final standings ›". Rendered only when there is a past season to go to. */
function PastSeasonLink({ season, onShow }: { season: Season; onShow: (id: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onShow(season.id)}
      className="mt-3 inline-flex min-h-11 items-center text-[13px] font-bold text-primary-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
    >
      See the {season.id} final standings&nbsp;›
    </button>
  )
}

function StateCard({ icon, title, children }: { icon: string; title: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card px-4 pt-[18px] pb-3 text-center">
      <div className="mb-2 text-[28px] leading-none" aria-hidden="true">{icon}</div>
      <h2 className="text-[15px] font-extrabold text-foreground">{title}</h2>
      {children}
    </div>
  )
}

/** In place of every board while the current season has no played session. */
export function BetweenSeasonsCard({
  line,
  pastSeason,
  onShowSeason,
}: {
  line: string
  pastSeason: Season | null
  onShowSeason: (id: string) => void
}) {
  return (
    <StateCard icon="🏸" title={line}>
      {pastSeason ? <PastSeasonLink season={pastSeason} onShow={onShowSeason} /> : <div className="pb-2" />}
    </StateCard>
  )
}

/** An empty board. Never a blank board. */
export function NobodyYetCard({
  title,
  note,
  progress,
  pastSeason,
  onShowSeason,
}: {
  title: string
  /** One line under the title, e.g. "Players appear after 3 sessions in the past 12 months." */
  note?: string
  /** The viewer's floor-window sessions against the floor, when the viewer is one of those waiting. */
  progress: { sessions: number; floor: number; unit: string } | null
  pastSeason: Season | null
  onShowSeason: (id: string) => void
}) {
  return (
    <StateCard icon="🔒" title={title}>
      {note && <p className="mt-1.5 text-[13px] text-muted-foreground">{note}</p>}
      {progress && (
        <>
          <div className="mt-3 mb-1 flex justify-center gap-1.5" aria-hidden="true">
            {Array.from({ length: progress.floor }).map((_, i) => (
              <i
                key={i}
                className={`block size-3 rounded-full border-[1.5px] border-primary-ink ${i < progress.sessions ? 'bg-primary-ink' : ''}`}
              />
            ))}
          </div>
          <p className="text-[13px] text-muted-foreground">
            <b className="font-bold text-foreground">{viewerProgress(progress.sessions, progress.floor)}</b> {progress.unit}
          </p>
        </>
      )}
      {pastSeason ? <PastSeasonLink season={pastSeason} onShow={onShowSeason} /> : <div className="pb-2" />}
    </StateCard>
  )
}

/** A failed read. Never rendered as an empty board. */
export function BoardError({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-2xl border border-border bg-card px-4 py-5 text-center">
      <p className="text-[15px] font-bold text-foreground">Couldn’t load this board</p>
      <Button variant="outline" onClick={onRetry} className="mt-3 min-h-11 px-5">
        Retry
      </Button>
    </div>
  )
}

/** "3 more players appear once they reach 3 sessions. You: 2 of 3" */
export function PendingFooter({
  pending,
  floor,
}: {
  pending: { waiting: number; viewerSessions: number | null } | null
  floor: number
}) {
  if (!pending || pending.waiting === 0) return null
  return (
    <p className="mt-3 text-center text-[11.5px] text-muted-foreground">
      {pendingLine(pending.waiting, floor)}
      {pending.viewerSessions !== null && (
        <> <b className="font-bold text-foreground">{viewerProgress(pending.viewerSessions, floor)}</b></>
      )}
    </p>
  )
}
