import { useEffect, useState } from 'react'
import { Copy, Download, Share2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import type { Session } from '@/hooks/useSession'
import {
  buildShareContent, canCopyImage, canShareImage, copyImage, downloadImage, fetchFirstOnCourt,
  renderShareImage, shareFileName,
} from '@/lib/sessionShareImage'

type State =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; blob: Blob; url: string; gameCount: number }

/**
 * Admin-only: builds a picture of the session (details + first on court) and
 * hands it to the phone's share menu, the clipboard, or a download.
 *
 * The picture is made when the dialog opens, not when Share is pressed. Safari
 * only allows the share menu straight after a tap, and fetching games plus
 * drawing can outlast that window — so the tap on Share must find the image
 * already made.
 */
export function ShareSessionDialog({ session }: { session: Session }) {
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    let url: string | null = null
    setState({ kind: 'loading' })

    ;(async () => {
      try {
        const games = await fetchFirstOnCourt(session.id, session.court_count)
        const blob = await renderShareImage(buildShareContent(session, games))
        if (cancelled) return
        url = URL.createObjectURL(blob)
        setState({ kind: 'ready', blob, url, gameCount: games.length })
      } catch (e) {
        if (!cancelled) setState({ kind: 'error', message: e instanceof Error ? e.message : 'Could not make the image' })
      }
    })()

    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [open, attempt, session])

  const fileName = shareFileName(session.name)
  const file = state.kind === 'ready' ? new File([state.blob], fileName, { type: 'image/png' }) : null
  const shareSupported = file ? canShareImage(file) : false
  const copySupported = canCopyImage()

  async function handleShare() {
    if (!file) return
    try {
      await navigator.share({ files: [file], title: session.name })
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return
      toast.error('Could not open the share menu. Try Copy or Download.')
    }
  }

  async function handleCopy() {
    if (state.kind !== 'ready') return
    try {
      await copyImage(state.blob)
      toast.success('Image copied — paste it in the chat')
    } catch {
      toast.error('Could not copy the image. Try Download.')
    }
  }

  function handleDownload() {
    if (state.kind !== 'ready') return
    downloadImage(state.blob, fileName)
  }

  return (
    // The admin session card navigates on click, and React bubbles events from
    // the dialog's portal up through this tree — stop them here.
    <div onClick={(e) => e.stopPropagation()} className="contents">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger render={<Button variant="outline" size="sm" aria-label={`Share ${session.name}`} />}>
          <Share2 aria-hidden="true" />
          Share
        </DialogTrigger>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share session</DialogTitle>
            <DialogDescription>Session details and the games first on court, as one image for the group chat.</DialogDescription>
          </DialogHeader>

          {state.kind === 'loading' && (
            <div className="aspect-[4/5] w-full animate-pulse rounded-xl bg-muted" aria-label="Making the image" />
          )}

          {state.kind === 'error' && (
            <div className="space-y-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
              <p className="font-medium text-destructive">Could not make the image.</p>
              <p className="text-muted-foreground">{state.message}</p>
              <Button variant="outline" size="sm" onClick={() => setAttempt((a) => a + 1)}>Try again</Button>
            </div>
          )}

          {state.kind === 'ready' && (
            <>
              {state.gameCount === 0 && (
                <p className="rounded-lg bg-gold/10 px-3 py-2 text-xs text-gold-ink">
                  No queued games, so the image shows the session details only.
                </p>
              )}
              <img
                src={state.url}
                alt={`Share image for ${session.name}`}
                className="w-full rounded-xl border border-border"
              />
            </>
          )}

          <DialogFooter className="flex-row flex-wrap gap-2 sm:justify-start">
            {shareSupported && (
              <Button onClick={handleShare} disabled={state.kind !== 'ready'}>
                <Share2 aria-hidden="true" />
                Share…
              </Button>
            )}
            {copySupported && (
              <Button variant={shareSupported ? 'outline' : 'default'} onClick={handleCopy} disabled={state.kind !== 'ready'}>
                <Copy aria-hidden="true" />
                Copy image
              </Button>
            )}
            <Button variant="outline" onClick={handleDownload} disabled={state.kind !== 'ready'}>
              <Download aria-hidden="true" />
              Download
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
