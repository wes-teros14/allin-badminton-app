/**
 * A sheet that slides up from the bottom (same look as the "Cheer later" sheet in
 * CheersReminder). Used by the admin menu and the Gallery's upload / caption / delete sheets.
 */
import type { ReactNode } from 'react'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'

interface BottomSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Read by screen readers; shown when `showTitle`. */
  title: string
  showTitle?: boolean
  description?: ReactNode
  children: ReactNode
}

export function BottomSheet({ open, onOpenChange, title, showTitle = true, description, children }: BottomSheetProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/45 duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Popup className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-t-2xl border-t border-border bg-card px-4 pt-2.5 pb-[max(1rem,env(safe-area-inset-bottom))] outline-none duration-200 data-open:animate-in data-open:slide-in-from-bottom-6 data-closed:animate-out data-closed:slide-out-to-bottom-6 motion-reduce:animate-none">
          <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-border" aria-hidden="true" />
          <DialogPrimitive.Title className={showTitle ? 'text-lg font-semibold' : 'sr-only'}>{title}</DialogPrimitive.Title>
          {description && (
            <DialogPrimitive.Description className="mt-1 mb-3 text-sm text-muted-foreground">{description}</DialogPrimitive.Description>
          )}
          {children}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

export default BottomSheet
