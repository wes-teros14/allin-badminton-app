/**
 * What "Cheer later" players get instead of the full-page cheers gate
 * (migration 084): a bar pinned to the bottom of the screen, and the same
 * CheersPanel in a bottom sheet when they tap it. The page underneath stays
 * mounted, so whoever is running the Live page keeps it.
 */

import type { ReactNode } from 'react'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'

interface CheersReminderProps {
  /** e.g. "2 games done · 6 cheers to give" — see cheersReminderLabel. */
  label: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The CheersPanel shown inside the sheet. */
  children: ReactNode
}

export function CheersReminder({ label, open, onOpenChange, children }: CheersReminderProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      {!open && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <DialogPrimitive.Trigger
            className="pointer-events-auto mx-auto flex min-h-12 w-full max-w-sm items-center gap-3 rounded-xl bg-primary px-3 py-2.5 text-left text-sm text-white shadow-lg transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <span className="text-lg leading-none" aria-hidden="true">🎉</span>
            <span className="flex-1">{label}</span>
            <span className="rounded-md bg-white/15 px-2 py-1 text-xs font-semibold">Cheer</span>
          </DialogPrimitive.Trigger>
        </div>
      )}

      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/45 duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Popup className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-2xl border-t border-border bg-background pb-[env(safe-area-inset-bottom)] outline-none duration-200 data-open:animate-in data-open:slide-in-from-bottom-6 data-closed:animate-out data-closed:slide-out-to-bottom-6 motion-reduce:animate-none">
          <div className="mx-auto mt-2.5 h-1 w-9 rounded-full bg-border" aria-hidden="true" />
          <DialogPrimitive.Title className="sr-only">Give your cheers</DialogPrimitive.Title>
          {children}
          <div className="px-4 pb-4">
            <DialogPrimitive.Close className="min-h-10 w-full text-sm text-muted-foreground transition-colors hover:text-foreground">
              Later ↓
            </DialogPrimitive.Close>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

export default CheersReminder
