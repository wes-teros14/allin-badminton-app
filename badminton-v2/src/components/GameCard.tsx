import { StatusChip } from './StatusChip'
import { Avatar } from './Avatar'

interface Props {
  gameNumber: number
  partnerNameSlug: string
  opp1NameSlug: string
  opp2NameSlug: string
  partnerAvatarUrl?: string | null
  opp1AvatarUrl?: string | null
  opp2AvatarUrl?: string | null
  status: 'queued' | 'playing' | 'complete'
  isNextUp: boolean
  isLoading?: boolean
  outcome?: 'won' | 'lost' | 'draw' | null
  won?: boolean | null
}

export function GameCard({
  gameNumber,
  partnerNameSlug,
  opp1NameSlug,
  opp2NameSlug,
  partnerAvatarUrl = null,
  opp1AvatarUrl = null,
  opp2AvatarUrl = null,
  status,
  isNextUp,
  isLoading,
  outcome,
  won,
}: Props) {
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
    ? 'next-game'
    : 'queued'

  const cardClass = status === 'playing'
    ? 'rounded-xl border border-primary/30 bg-[var(--primary-subtle)] p-4'
    : 'rounded-xl border border-border p-4'

  const isComplete = status === 'complete'

  return (
    <div className={`${cardClass} ${isComplete ? 'opacity-50' : ''}`}>
      <div className="flex items-center gap-3 mb-2">
        <span className={`whitespace-nowrap text-2xl font-bold tabular-nums ${isComplete ? 'line-through' : ''}`}>
          Game {gameNumber}
        </span>
        {isComplete
          ? outcome === 'draw'
            ? <span className="rounded-full bg-muted px-2.5 py-1 text-sm font-bold text-muted-foreground">1-1</span>
            : won === true
            ? <span className="text-sm font-bold text-[var(--success)]">✅ Win</span>
            : won === false
            ? <span className="text-sm font-bold text-destructive">❌ Loss</span>
            : <span className="text-[var(--success)] text-lg font-bold">✓</span>
          : <StatusChip status={chipStatus} />
        }
      </div>
      <div className="flex items-center gap-1.5 text-sm text-foreground/80">
        With: <Avatar url={partnerAvatarUrl} name={partnerNameSlug} size={40} />
        <span className="font-medium text-primary text-[21px]">{partnerNameSlug}</span>
      </div>
      <div className="flex justify-center my-2">
        <span className="text-[18px] font-black tracking-wide text-muted-foreground">VS</span>
      </div>
      <div className="flex items-center justify-center gap-3 text-sm text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Avatar url={opp1AvatarUrl} name={opp1NameSlug} size={40} />
          <span className="text-primary text-[21px]">{opp1NameSlug}</span>
        </div>
        <span>&amp;</span>
        <div className="flex items-center gap-1.5">
          <Avatar url={opp2AvatarUrl} name={opp2NameSlug} size={40} />
          <span className="text-primary text-[21px]">{opp2NameSlug}</span>
        </div>
      </div>
    </div>
  )
}
