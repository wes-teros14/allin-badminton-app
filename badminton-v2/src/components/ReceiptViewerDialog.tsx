import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { signReceiptUrls, type SessionReceipt } from '@/hooks/useSessionReceipts'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  playerName: string
  /** Newest first, dismissed ones included — they stay visible for audit. */
  receipts: SessionReceipt[]
  onDismiss: (receiptId: string) => void
}

/**
 * Admin review of one player's submitted receipts.
 *
 * Images are served from a PRIVATE bucket, so each render mints fresh
 * short-lived signed URLs. Reopening the dialog re-signs — a URL copied
 * out of here stops working within a minute.
 */
export function ReceiptViewerDialog({ open, onOpenChange, playerName, receipts, onDismiss }: Props) {
  const [urls, setUrls] = useState<Record<string, string | null>>({})
  const [isSigning, setIsSigning] = useState(false)

  useEffect(() => {
    if (!open || receipts.length === 0) return
    let cancelled = false
    setIsSigning(true)
    signReceiptUrls(receipts.map((r) => r.storagePath)).then((signed) => {
      if (cancelled) return
      const next: Record<string, string | null> = {}
      receipts.forEach((r, i) => { next[r.id] = signed[i] })
      setUrls(next)
      setIsSigning(false)
    })
    return () => { cancelled = true }
  }, [open, receipts])

  const activeCount = receipts.filter((r) => r.dismissedAt === null).length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle>{playerName}&apos;s receipts</DialogTitle>
          <DialogDescription>
            {receipts.length} submitted
            {receipts.length !== activeCount && ` · ${receipts.length - activeCount} dismissed`}
            . Check the amount against GCash before confirming payment.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {receipts.length === 0 && (
            <p className="text-sm text-muted-foreground">This player hasn&apos;t submitted a receipt.</p>
          )}

          {receipts.map((r) => (
            <div
              key={r.id}
              className={`rounded-lg border p-3 space-y-2 ${
                r.dismissedAt ? 'border-border bg-muted/40 opacity-70' : 'border-border'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">
                  {new Date(r.uploadedAt).toLocaleString('en-US', {
                    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
                  })}
                </span>
                {r.dismissedAt && (
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Dismissed
                  </span>
                )}
              </div>

              {urls[r.id] ? (
                // Full size so the transaction amount and reference are readable.
                <a href={urls[r.id] ?? undefined} target="_blank" rel="noopener noreferrer" className="block">
                  <img
                    src={urls[r.id] ?? undefined}
                    alt={`Receipt submitted by ${playerName}`}
                    className="w-full max-h-80 object-contain rounded border border-border bg-muted"
                  />
                </a>
              ) : (
                <div className="w-full h-40 rounded border border-border bg-muted flex items-center justify-center">
                  <span className="text-xs text-muted-foreground">
                    {isSigning ? 'Loading image…' : 'Image unavailable'}
                  </span>
                </div>
              )}

              {r.note
                ? <p className="text-sm break-words">{r.note}</p>
                : <p className="text-sm text-muted-foreground italic">No note</p>}

              {!r.dismissedAt && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-destructive hover:text-destructive"
                  onClick={() => onDismiss(r.id)}
                >
                  Dismiss — unreadable or wrong
                </Button>
              )}
            </div>
          ))}
        </div>

        <div className="shrink-0 pt-2">
          <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
