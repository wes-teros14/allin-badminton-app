import { useRef, useState } from 'react'
import { Image as ImageIcon, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  MAX_RECEIPT_INPUT_BYTES,
  MAX_RECEIPT_NOTE_LENGTH,
  MAX_RECEIPTS_PER_SESSION,
  formatBytes,
} from '@/lib/receipts'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (file: File, note: string) => Promise<boolean>
  isUploading: boolean
  /** Active receipts already submitted for this session. */
  currentCount: number
}

/**
 * One combined step: pick an image AND write an optional note, then
 * submit. Deliberately not two separate flows -- a player sending a
 * partial payment needs to explain it in the same breath as attaching
 * the screenshot.
 */
export function ReceiptUploadDialog({ open, onOpenChange, onSubmit, isUploading, currentCount }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const atLimit = currentCount >= MAX_RECEIPTS_PER_SESSION

  function reset() {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setFile(null)
    setPreviewUrl(null)
    setNote('')
    setError(null)
  }

  function handleClose(next: boolean) {
    if (isUploading) return
    if (!next) reset()
    onOpenChange(next)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0]
    e.target.value = ''
    if (!picked) return

    if (!picked.type.startsWith('image/')) {
      setError('That file is not an image. Please choose a photo or screenshot.')
      return
    }
    if (picked.size > MAX_RECEIPT_INPUT_BYTES) {
      setError(`That image is too large (max ${formatBytes(MAX_RECEIPT_INPUT_BYTES)}). Try a screenshot instead of a photo.`)
      return
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setError(null)
    setFile(picked)
    setPreviewUrl(URL.createObjectURL(picked))
  }

  async function handleSubmit() {
    if (!file) { setError('Please choose an image first.'); return }
    const ok = await onSubmit(file, note)
    if (ok) { reset(); onOpenChange(false) }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add receipt + note</DialogTitle>
          <DialogDescription>
            Attach your GCash screenshot. The note is optional — use it for things like
            &ldquo;partial&rdquo; or &ldquo;for 2 persons&rdquo;.
          </DialogDescription>
        </DialogHeader>

        {atLimit ? (
          <div className="space-y-3">
            <p className="text-sm text-destructive">
              You&apos;ve reached the limit of {MAX_RECEIPTS_PER_SESSION} receipts for this session.
              Remove one first if you need to add another.
            </p>
            <Button variant="outline" className="w-full" onClick={() => handleClose(false)}>Close</Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Image picker — native chooser, so the gallery stays available */}
            <div>
              {previewUrl ? (
                <div className="relative">
                  <img
                    src={previewUrl}
                    alt="Receipt preview"
                    className="w-full max-h-56 object-contain rounded-lg border border-border bg-muted"
                  />
                  <button
                    type="button"
                    onClick={() => { if (previewUrl) URL.revokeObjectURL(previewUrl); setFile(null); setPreviewUrl(null) }}
                    disabled={isUploading}
                    aria-label="Remove selected image"
                    className="absolute top-2 right-2 rounded-full bg-background/90 border border-border p-1 hover:bg-muted disabled:opacity-50"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  disabled={isUploading}
                  className="w-full flex flex-col items-center justify-center gap-2 py-8 rounded-lg border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted/50 transition-colors disabled:opacity-50"
                >
                  <ImageIcon className="w-6 h-6 text-muted-foreground" />
                  <span className="text-sm font-medium">Choose a photo</span>
                  <span className="text-xs text-muted-foreground">Screenshot of your GCash payment</span>
                </button>
              )}
              {/*
                No `capture` attribute on purpose. Setting capture="environment"
                makes mobile browsers open the camera DIRECTLY and suppress the
                gallery entirely — useless here, since a GCash receipt is a
                screenshot already sitting in the photo roll, not something you
                photograph. Without it the native picker offers gallery, files,
                and the camera if they actually want it.
              */}
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {/* Optional note */}
            <div>
              <div className="flex items-baseline justify-between mb-1">
                <label htmlFor="receipt-note" className="text-sm font-medium">Note (optional)</label>
                <span className={`text-xs ${note.length > MAX_RECEIPT_NOTE_LENGTH ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {note.length}/{MAX_RECEIPT_NOTE_LENGTH}
                </span>
              </div>
              <input
                id="receipt-note"
                type="text"
                value={note}
                maxLength={MAX_RECEIPT_NOTE_LENGTH}
                onChange={(e) => setNote(e.target.value)}
                disabled={isUploading}
                placeholder="e.g. partial, or for 2 persons"
                className="w-full text-sm rounded-lg border border-input bg-background px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => handleClose(false)} disabled={isUploading}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleSubmit} disabled={!file || isUploading}>
                {isUploading ? 'Uploading…' : 'Submit receipt'}
              </Button>
            </div>
            {isUploading && (
              <p className="text-xs text-center text-muted-foreground">
                Compressing and uploading — please keep this open.
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
