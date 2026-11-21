/**
 * Add / replace a Gallery photo, or edit its caption. The photo is shrunk on the phone as soon
 * as it is chosen, so the preview shows exactly what will be uploaded (and its size).
 */
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { BottomSheet } from '@/components/BottomSheet'
import { CAPTION_MAX, prepareImage, updateCaption, uploadPhoto, type GalleryPhoto } from '@/lib/galleryApi'
import type { GalleryImage } from '@/lib/galleryImage'

export type PhotoSheetMode =
  | { kind: 'add'; sessionId: string; sessionName: string }
  | { kind: 'replace'; photo: GalleryPhoto }
  | { kind: 'caption'; photo: GalleryPhoto }

interface PhotoSheetProps {
  mode: PhotoSheetMode | null
  userId: string
  displayName: string
  isAdmin: boolean
  onClose: () => void
  onSaved: () => void
}

function kb(bytes: number) {
  return `${Math.round(bytes / 1024)} KB`
}

export function PhotoSheet({ mode, userId, displayName, isAdmin, onClose, onSaved }: PhotoSheetProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [image, setImage] = useState<GalleryImage | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const [busy, setBusy] = useState<null | 'preparing' | 'uploading'>(null)
  const [error, setError] = useState<string | null>(null)

  // Reset whenever a new sheet opens.
  useEffect(() => {
    setImage(null)
    setPreview(null)
    setError(null)
    setBusy(null)
    setCaption(mode && mode.kind !== 'add' ? mode.photo.caption ?? '' : '')
  }, [mode])

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  if (!mode) return null
  const photo = mode.kind === 'add' ? null : mode.photo
  const needsFile = mode.kind !== 'caption'
  const owner = photo ? (photo.playerId === userId ? displayName : photo.nickname) : displayName

  async function choose(file: File | undefined) {
    if (!file) return
    setError(null)
    setBusy('preparing')
    try {
      const img = await prepareImage(file)
      setImage(img)
      setPreview(URL.createObjectURL(img.photo))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read this photo.')
    } finally {
      setBusy(null)
    }
  }

  async function save() {
    if (!mode) return
    const text = caption.trim() || null
    setBusy('uploading')
    setError(null)
    try {
      if (mode.kind === 'caption') {
        await updateCaption(mode.photo.id, text)
        toast.success('Caption saved')
      } else {
        if (!image) return
        await uploadPhoto({
          sessionId: mode.kind === 'add' ? mode.sessionId : mode.photo.sessionId,
          userId,
          image,
          caption: text,
          photoId: mode.kind === 'replace' ? mode.photo.id : undefined,
        })
        toast.success(mode.kind === 'replace' ? 'Photo replaced' : 'Photo added')
      }
      onSaved()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.')
    } finally {
      setBusy(null)
    }
  }

  const title = mode.kind === 'caption' ? 'Edit caption' : mode.kind === 'replace' ? 'Replace photo' : isAdmin ? 'Add a photo' : 'Add your photo'
  const description =
    mode.kind === 'add'
      ? isAdmin
        ? `Admin: add as many as you like to ${mode.sessionName}.`
        : `One per player for ${mode.sessionName}. You can change it until the session ends.`
      : undefined
  const shownPreview = preview ?? photo?.url ?? null

  return (
    <BottomSheet open onOpenChange={(o) => { if (!o && busy !== 'uploading') onClose() }} title={title} description={description}>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        aria-label="Choose a photo"
        tabIndex={-1}
        className="sr-only"
        onChange={(e) => { void choose(e.target.files?.[0]); e.target.value = '' }}
      />

      {needsFile ? (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy !== null}
          aria-label={image ? 'Choose a different photo' : 'Choose a photo'}
          className="relative mb-3 flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-muted text-sm text-muted-foreground"
        >
          {preview ? (
            <img src={preview} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <span>{busy === 'preparing' ? 'Preparing…' : 'Tap to choose a photo'}</span>
          )}
          {image && (
            <span className="absolute right-2 bottom-2 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-semibold text-white">
              {image.width}×{image.height} · {kb(image.photo.size)}
            </span>
          )}
        </button>
      ) : (
        shownPreview && (
          <div className="relative mb-3 aspect-[4/3] w-full overflow-hidden rounded-xl bg-muted">
            <img src={shownPreview} alt="" className="absolute inset-0 h-full w-full object-cover" />
          </div>
        )
      )}

      <label htmlFor="gallery-caption" className="mb-1.5 flex justify-between text-sm font-semibold">
        Caption
        <span className="font-normal text-muted-foreground">{caption.length} / {CAPTION_MAX} · optional</span>
      </label>
      <input
        id="gallery-caption"
        value={caption}
        maxLength={CAPTION_MAX}
        onChange={(e) => setCaption(e.target.value)}
        placeholder="e.g. Smash of the night"
        className="min-h-11 w-full rounded-lg border border-border bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <p className="mt-1.5 mb-3 text-xs text-muted-foreground">
        Shown as: <span className="font-semibold text-foreground">{owner}</span>{caption.trim() ? ` — ${caption.trim()}` : ''}
      </p>

      {error && <p role="alert" className="mb-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

      <div className="flex gap-2">
        {needsFile ? (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy !== null}
            className="min-h-11 flex-1 rounded-lg border border-border text-sm font-semibold text-muted-foreground disabled:opacity-50"
          >
            {image ? 'Choose another' : 'Choose photo'}
          </button>
        ) : (
          <button type="button" onClick={onClose} disabled={busy !== null} className="min-h-11 flex-1 rounded-lg border border-border text-sm font-semibold text-muted-foreground disabled:opacity-50">
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy !== null || (needsFile && !image)}
          className="min-h-11 flex-1 rounded-lg bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {busy === 'uploading' ? 'Saving…' : mode.kind === 'caption' ? 'Save' : mode.kind === 'replace' ? 'Replace' : 'Upload'}
        </button>
      </div>
    </BottomSheet>
  )
}

export default PhotoSheet
