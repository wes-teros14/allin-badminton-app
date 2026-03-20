import { StatusChip } from './StatusChip'

interface Props {
  gameNumber: number
  partnerNameSlug: string
  opp1NameSlug: string
  opp2NameSlug: string
  status: 'queued' | 'playing' | 'complete'
  isNextUp: boolean
  isLoading?: boolean
}

export function GameCard({ gameNumber, partnerNameSlug, opp1NameSlug, opp2NameSlug, status, isNextUp, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="rounded-xl border border-border p-4 space-y-3 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-muted rounded" />
          <div className="h-5 w-16 bg-muted rounded-full" />
        </div>
        <div className="h-4 w-2/3 bg-muted rounded" />
        <div className="h-4 w-1/2 bg-muted rounded" />
      </div>
    )
  }

  const chipStatus = status === 'complete'
    ? 'done'
    : status === 'playing'
    ? 'playing'
    : isNextUp
    ? 'up-next'
    : 'queued'

  const cardClass = status === 'playing'
    ? 'rounded-xl border border-primary/30 bg-[var(--primary-subtle)] p-4'
    : 'rounded-xl border border-border p-4'

  const isComplete = status === 'complete'

  return (
    <div className={`${cardClass} ${isComplete ? 'opacity-50' : ''}`}>
      <div className="flex items-center gap-3 mb-2">
        <span className={`text-4xl font-bold tabular-nums ${isComplete ? 'line-through' : ''}`}>
          {gameNumber}
        </span>
        {isComplete
          ? <span className="text-[var(--success)] text-lg font-bold">✓</span>
          : <StatusChip status={chipStatus} />
        }
      </div>
      <p className="text-sm text-foreground/80">
        With: <span className="font-medium text-primary">{partnerNameSlug}</span>
      </p>
      <p className="text-sm text-muted-foreground mt-0.5">
        vs <span className="text-primary">{opp1NameSlug}</span> &amp; <span className="text-primary">{opp2NameSlug}</span>
      </p>
    </div>
  )
}
