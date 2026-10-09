/**
 * "Download offline backup": saves a read-only HTML copy of the session's
 * schedule to the phone, for running the night by hand if the internet or the
 * server goes down. See lib/offlineBackup.ts for what the file contains.
 *
 * An admin chooses between the moderator copy (no levels) and the admin copy
 * (with levels). A moderator gets the moderator copy straight away, because
 * moderators cannot see levels in the app either.
 */

import { useState } from 'react'
import { toast } from 'sonner'
import { Download } from 'lucide-react'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { Button } from '@/components/ui/button'
import { buildOfflineBackupHtml, backupFileName } from '@/lib/offlineBackup'
import { fetchOfflineBackupData } from '@/lib/offlineBackupData'

export function OfflineBackupButton({ sessionId, canIncludeLevels }: { sessionId: string; canIncludeLevels: boolean }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  async function download(withLevels: boolean) {
    setBusy(true)
    try {
      const data = await fetchOfflineBackupData(sessionId, withLevels)
      const exportedAt = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      const fileName = backupFileName(data.session.name, data.session.date, exportedAt, withLevels)
      const blob = new Blob([buildOfflineBackupHtml({ ...data, exportedAt })], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      const link = Object.assign(document.createElement('a'), { href: url, download: fileName })
      document.body.appendChild(link)
      link.click()
      link.remove()
      // Revoked later, not at once: some mobile browsers start reading the blob after click() returns.
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
      setOpen(false)
      toast.success(`Backup saved${withLevels ? ' (admin copy)' : ''}`, {
        description: `${fileName} is in Downloads. To open it offline: Files → Downloads → open with Chrome.`,
        duration: 10000,
      })
    } catch (e) {
      toast.error(`Couldn’t make the backup: ${e instanceof Error ? e.message : 'unknown error'}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-1.5">
      <Button
        variant="outline"
        className="w-full border-primary-ink/60 text-primary-ink"
        disabled={busy}
        onClick={() => (canIncludeLevels ? setOpen(true) : void download(false))}
      >
        <Download className="h-4 w-4" aria-hidden="true" />
        {busy && !open ? 'Saving backup…' : 'Download offline backup'}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        A read-only copy of the schedule for your phone, in case the internet or server goes down.
      </p>

      {canIncludeLevels && (
        <DialogPrimitive.Root open={open} onOpenChange={(o) => { if (!busy) setOpen(o) }}>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/45 duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
            <DialogPrimitive.Popup className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-md rounded-t-2xl border-t border-border bg-card px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2.5 outline-none duration-200 data-open:animate-in data-open:slide-in-from-bottom-6 data-closed:animate-out data-closed:slide-out-to-bottom-6 motion-reduce:animate-none">
              <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-border" aria-hidden="true" />
              <DialogPrimitive.Title className="text-base font-semibold">Download offline backup</DialogPrimitive.Title>
              <DialogPrimitive.Description className="mb-3 mt-1 text-sm text-muted-foreground">
                Read-only copy of the schedule as it is now. Download a fresh one if things change.
              </DialogPrimitive.Description>
              <div className="grid gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void download(false)}
                  className="grid gap-0.5 rounded-xl border border-border bg-background p-3 text-left transition-colors hover:border-primary-ink disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="text-sm font-semibold">Moderator copy</span>
                  <span className="text-xs text-muted-foreground">No levels. Safe to send to a moderator.</span>
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void download(true)}
                  className="grid gap-0.5 rounded-xl border border-border bg-background p-3 text-left transition-colors hover:border-primary-ink disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="text-sm font-semibold">Admin copy</span>
                  <span className="text-xs text-muted-foreground">
                    Adds levels beside every name. <span className="font-semibold text-amber-600 dark:text-amber-400">For your phone only.</span>
                  </span>
                </button>
                <DialogPrimitive.Close
                  render={<Button variant="outline" className="w-full" disabled={busy} />}
                >
                  {busy ? 'Saving…' : 'Cancel'}
                </DialogPrimitive.Close>
              </div>
            </DialogPrimitive.Popup>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
      )}
    </div>
  )
}

export default OfflineBackupButton
