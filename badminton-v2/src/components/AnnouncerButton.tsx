import { cn } from '@/lib/utils'
import type { AnnouncerStatus } from '@/hooks/useAnnouncer'

/**
 * The live board's announcer switch: a small chip in the bottom-left corner so
 * it never covers a court. Tapping is required to turn sound on (browsers block
 * audio until a tap), so "locked" asks for exactly that after a reload.
 */
export function AnnouncerButton({
  status,
  counts,
  error,
  enable,
  disable,
}: {
  status: AnnouncerStatus
  counts: { ready: number; total: number }
  error: string | null
  enable: () => Promise<void>
  disable: () => void
}) {
  const label =
    status === 'off' ? '🔈 Announcer off'
    : status === 'locked' ? '🔇 Tap to turn sound on'
    : status === 'loading' ? 'Loading names…'
    : status === 'error' ? '⚠️ Announcer failed — tap to retry'
    : `🔊 Announcer · ${counts.ready} of ${counts.total} names`

  return (
    <button
      type="button"
      onClick={() => { if (status === 'ready') disable(); else if (status !== 'loading') void enable() }}
      disabled={status === 'loading'}
      aria-pressed={status === 'ready'}
      title={status === 'error' && error ? error : status === 'ready' ? 'Tap to turn the announcer off' : undefined}
      className={cn(
        'absolute bottom-3 left-3 z-40 rounded-full border px-3 py-1.5 text-sm font-medium backdrop-blur transition-colors',
        status === 'ready'
          ? 'border-primary/50 bg-card/80 text-foreground'
          : status === 'locked' || status === 'error'
            ? 'border-destructive/60 bg-card/90 text-foreground'
            : 'border-border bg-card/70 text-muted-foreground',
      )}
    >
      {label}
    </button>
  )
}

export default AnnouncerButton
