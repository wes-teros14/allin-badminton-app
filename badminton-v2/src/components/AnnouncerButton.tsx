import { CircleAlert, LoaderCircle, Volume2, VolumeOff, VolumeX } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AnnouncerStatus } from '@/hooks/useAnnouncer'

/**
 * The live board's announcer switch: a small button in the bottom-left corner so
 * it never covers a court. Tapping is required to turn sound on (browsers block
 * audio until a tap), so "locked" asks for exactly that after a reload.
 *
 * Solid surface and drawn speaker icons since 2026-11-24 (was a frosted-glass pill
 * with 🔈 🔇 ⚠️ 🔊 in the label).
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
    status === 'off' ? 'Announcer off'
    : status === 'locked' ? 'Tap to turn sound on'
    : status === 'loading' ? 'Loading names…'
    : status === 'error' ? 'Announcer failed — tap to retry'
    : `Announcer · ${counts.ready} of ${counts.total} names`

  const Icon =
    status === 'off' ? VolumeOff
    : status === 'locked' ? VolumeX
    : status === 'loading' ? LoaderCircle
    : status === 'error' ? CircleAlert
    : Volume2

  return (
    <button
      type="button"
      onClick={() => { if (status === 'ready') disable(); else if (status !== 'loading') void enable() }}
      disabled={status === 'loading'}
      aria-pressed={status === 'ready'}
      title={status === 'error' && error ? error : status === 'ready' ? 'Tap to turn the announcer off' : undefined}
      className={cn(
        'absolute bottom-3 left-3 z-40 inline-flex min-h-10 items-center gap-2 rounded-lg border bg-card px-3 text-sm font-medium transition-colors',
        status === 'ready'
          ? 'border-primary/50 text-foreground'
          : status === 'locked' || status === 'error'
            ? 'border-destructive/60 text-foreground'
            : 'border-border text-muted-foreground',
      )}
    >
      <Icon
        className={cn(
          'h-4 w-4 shrink-0',
          status === 'loading' && 'animate-spin motion-reduce:animate-none',
          (status === 'locked' || status === 'error') && 'text-destructive',
          status === 'ready' && 'text-primary-ink',
        )}
        aria-hidden="true"
      />
      {label}
    </button>
  )
}

export default AnnouncerButton
