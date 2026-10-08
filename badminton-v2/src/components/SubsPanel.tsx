import { useState } from 'react'
import { Star } from 'lucide-react'
import type { AdminMatchDisplay } from '@/hooks/useAdminSession'
import { rankSubstitutes, togglePick, type RankedSub, type SubCandidate } from '@/lib/substitutes'

interface Props {
  target: AdminMatchDisplay
  eligible: SubCandidate[]
  allMatches: AdminMatchDisplay[]
  queued: AdminMatchDisplay[]
  levels: Map<string, number | null>
  levelsError: string | null
  picks: string[]
  /** Levels are private to the owner — moderators get the same order without the numbers. */
  showLevels: boolean
  /** Only admins can write sessions.sub_picks; moderators see the stars read-only. */
  canEditPicks: boolean
  isSaving: boolean
  onPicksChange: (picks: string[]) => void
  onSubIn: (outId: string, inId: string) => void
}

function levelText(r: RankedSub, outLevel: number | null): string {
  if (r.level == null) return 'Lv ?'
  if (outLevel == null) return `Lv ${r.level}`
  const d = r.level - outLevel
  if (d === 0) return `Lv ${r.level} (same)`
  return `Lv ${r.level} (${d > 0 ? '+' : '−'}${Math.abs(d)})`
}

export function SubsPanel({
  target, eligible, allMatches, queued, levels, levelsError, picks,
  showLevels, canEditPicks, isSaving, onPicksChange, onSubIn,
}: Props) {
  const [outId, setOutId] = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  const four = [
    { id: target.t1p1Id, name: target.t1p1 },
    { id: target.t1p2Id, name: target.t1p2 },
    { id: target.t2p1Id, name: target.t2p1 },
    { id: target.t2p2Id, name: target.t2p2 },
  ]
  const outName = four.find((p) => p.id === outId)?.name ?? null
  const outLevel = outId ? levels.get(outId) ?? null : null
  const rows = rankSubstitutes({ target, eligible, allMatches, queued, levels, outPlayerId: outId, picks })
  const picksFull = picks.length >= 2

  return (
    <div className="mt-3 rounded-lg border border-border bg-card p-2.5 text-left">
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Who's out?</p>
      <div className="mb-3 grid grid-cols-4 gap-1">
        {four.map((p) => {
          const selected = p.id === outId
          const level = levels.get(p.id)
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={selected}
              onClick={() => { setOutId(selected ? null : p.id); setConfirmingId(null) }}
              className={`min-w-0 rounded-md border px-1 py-1.5 text-center text-xs font-medium leading-tight transition-colors ${
                selected
                  ? 'border-destructive bg-destructive/10 text-foreground'
                  : 'border-border text-foreground hover:bg-muted/50'
              }`}
            >
              <span className="block truncate">{p.name}</span>
              {(showLevels || selected) && (
                <span className={`block text-[11px] ${selected ? 'font-semibold text-destructive' : 'text-muted-foreground'}`}>
                  {selected ? 'Out' : `Lv ${level ?? '?'}`}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {outName ? `Best subs for ${outName}` : 'Subs'} ({rows.length})
      </p>
      {!outName && rows.length > 0 && (
        <p className="mb-1 text-[11px] text-muted-foreground">Tap who's out to rank by level and sub in.</p>
      )}
      {levelsError && (
        <p className="mb-1 text-[11px] text-destructive">Levels didn't load, so the list is not ranked by level.</p>
      )}

      {rows.length === 0 ? (
        <p className="text-xs italic text-muted-foreground">No eligible substitutes right now</p>
      ) : (
        <ol className="divide-y divide-border">
          {rows.map((r, i) => {
            const top = i === 0
            const confirming = confirmingId === r.id && outId != null
            return (
              <li key={r.id} className="grid grid-cols-[1rem_1fr_auto] items-center gap-x-2 py-1.5">
                <span className={`text-xs font-bold tabular-nums ${top ? 'text-primary-ink' : 'text-muted-foreground'}`}>{i + 1}</span>
                <div className="min-w-0">
                  <p className={`flex items-center gap-1 truncate text-sm font-semibold leading-tight ${top ? 'text-primary-ink' : 'text-foreground'}`}>
                    <span className="truncate">{r.displayName}</span>
                    {r.isPick && <Star aria-label="Your pick" className="size-3 shrink-0 fill-current text-gold-ink" />}
                  </p>
                  <p className="truncate text-[11px] leading-snug text-muted-foreground">
                    {showLevels && (
                      <>
                        <span className={r.levelGap === 0 ? 'font-semibold text-foreground' : ''}>{levelText(r, outLevel)}</span>
                        {' · '}
                      </>
                    )}
                    {r.games} {r.games === 1 ? 'game' : 'games'}
                    {' · '}
                    {r.nextGame == null
                      ? <span className="font-semibold text-foreground">done tonight</span>
                      : `next G${r.nextGame}`}
                  </p>
                </div>
                <div className="flex gap-1">
                  {canEditPicks && (
                    <button
                      type="button"
                      aria-pressed={r.isPick}
                      aria-label={r.isPick ? `Unpick ${r.displayName}` : `Pick ${r.displayName}`}
                      title={!r.isPick && picksFull ? 'Max 2 picks — unstar one first' : undefined}
                      disabled={isSaving || (!r.isPick && picksFull)}
                      onClick={() => {
                        const next = togglePick(picks, r.id)
                        if (next) onPicksChange(next)
                      }}
                      className={`flex size-9 items-center justify-center rounded-md border transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
                        r.isPick ? 'border-gold-ink text-gold-ink' : 'border-border text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Star className={`size-4 ${r.isPick ? 'fill-current' : ''}`} />
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={isSaving || outId == null}
                    title={outId == null ? "Tap who's out first" : undefined}
                    onClick={() => setConfirmingId(r.id)}
                    className="h-9 rounded-md bg-primary px-3 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Sub in
                  </button>
                </div>
                {confirming && (
                  <div className="col-span-3 mt-1.5 flex items-center gap-1.5 text-xs">
                    <span className="flex-1">{r.displayName} in for {outName}?</span>
                    <button
                      type="button"
                      onClick={() => setConfirmingId(null)}
                      disabled={isSaving}
                      className="h-9 rounded-md border border-border px-3 text-muted-foreground hover:text-foreground disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => { onSubIn(outId!, r.id); setConfirmingId(null); setOutId(null) }}
                      className="h-9 rounded-md bg-primary px-3 font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      Confirm
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
