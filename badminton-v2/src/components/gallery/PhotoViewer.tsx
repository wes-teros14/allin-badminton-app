/**
 * Full-screen photo viewer: always dark (it's a photo surface), swipe or arrow keys to move,
 * caption "Name — text", and Replace / Caption / Delete when the viewer may change the photo.
 */
import { useEffect, useRef } from 'react'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { ChevronLeft, ChevronRight, Lock, Pencil, RefreshCw, Trash2, X } from 'lucide-react'
import type { GalleryPhoto } from '@/lib/galleryApi'

interface PhotoViewerProps {
  photos: GalleryPhoto[]
  index: number | null
  sessionLabel: string
  userId: string
  canChange: (p: GalleryPhoto) => boolean
  /** True while only the viewer's own photo is visible (first-timer). */
  ownOnly: boolean
  onIndex: (i: number) => void
  onClose: () => void
  onReplace: (p: GalleryPhoto) => void
  onCaption: (p: GalleryPhoto) => void
  onDelete: (p: GalleryPhoto) => void
}

export function PhotoViewer({ photos, index, sessionLabel, userId, canChange, ownOnly, onIndex, onClose, onReplace, onCaption, onDelete }: PhotoViewerProps) {
  const touchX = useRef<number | null>(null)
  const open = index !== null && index >= 0 && index < photos.length
  const p = open ? photos[index] : null

  useEffect(() => {
    if (!open || index === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && index > 0) onIndex(index - 1)
      if (e.key === 'ArrowRight' && index < photos.length - 1) onIndex(index + 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, index, photos.length, onIndex])

  // Warm the neighbours so a swipe shows the next photo at once.
  useEffect(() => {
    if (!open || index === null) return
    for (const j of [index - 1, index + 1]) {
      const n = photos[j]
      if (n?.url) new Image().src = n.url
    }
  }, [open, index, photos])

  if (!p || index === null) return null
  const mine = p.playerId === userId
  const editable = canChange(p)

  return (
    <DialogPrimitive.Root open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Popup
          className="fixed inset-0 z-50 flex flex-col bg-[#07040C] text-white outline-none"
          onTouchStart={(e) => { touchX.current = e.touches[0].clientX }}
          onTouchEnd={(e) => {
            if (touchX.current === null) return
            const dx = e.changedTouches[0].clientX - touchX.current
            touchX.current = null
            if (dx > 50 && index > 0) onIndex(index - 1)
            if (dx < -50 && index < photos.length - 1) onIndex(index + 1)
          }}
        >
          <DialogPrimitive.Title className="sr-only">Photo by {mine ? 'you' : p.nickname}</DialogPrimitive.Title>
          <div className="flex items-center justify-between px-3.5 pt-[max(0.875rem,env(safe-area-inset-top))] pb-2 text-sm">
            <span className="tabular-nums">{index + 1} of {photos.length}</span>
            <DialogPrimitive.Close aria-label="Close" className="grid h-10 w-10 place-items-center rounded-full bg-white/10 hover:bg-white/20">
              <X className="h-5 w-5" />
            </DialogPrimitive.Close>
          </div>

          <div className="relative flex min-h-0 flex-1 items-center justify-center">
            {p.url ? (
              <img
                key={p.id}
                src={p.url}
                alt={p.caption ?? `Photo by ${p.nickname}`}
                className="max-h-full max-w-full object-contain"
                style={p.thumbUrl ? { backgroundImage: `url("${p.thumbUrl}")`, backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center' } : undefined}
              />
            ) : (
              <p className="px-6 text-center text-sm text-[#B39DBB]">This upload didn't finish. Replace it to try again, or delete it.</p>
            )}
            <button
              type="button"
              aria-label="Previous photo"
              disabled={index === 0}
              onClick={() => onIndex(index - 1)}
              className="absolute left-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-black/45 disabled:opacity-0"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="Next photo"
              disabled={index === photos.length - 1}
              onClick={() => onIndex(index + 1)}
              className="absolute right-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-black/45 disabled:opacity-0"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          <div className="px-4.5 pt-3 pb-1.5 text-sm leading-relaxed">
            <span className="font-bold">{mine ? 'You' : p.nickname}</span>
            {p.caption ? ` — ${p.caption}` : ''}
            <span className="mt-0.5 block text-xs text-[#B39DBB]">
              {ownOnly ? 'Only you can see this until your first session completes' : sessionLabel}
            </span>
          </div>

          <div className="px-3.5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2.5">
            {editable ? (
              <div className="flex gap-2">
                <button type="button" onClick={() => onReplace(p)} className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-white/10 text-sm font-semibold">
                  <RefreshCw className="h-4 w-4" />Replace
                </button>
                <button type="button" onClick={() => onCaption(p)} className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-white/10 text-sm font-semibold">
                  <Pencil className="h-4 w-4" />Caption
                </button>
                <button type="button" onClick={() => onDelete(p)} className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#DC595E]/40 bg-[#DC595E]/15 text-sm font-semibold text-[#FF9A9E]">
                  <Trash2 className="h-4 w-4" />Delete
                </button>
              </div>
            ) : mine ? (
              <p className="flex min-h-10 items-center gap-1.5 text-xs text-[#B39DBB]">
                <Lock className="h-3.5 w-3.5" />Your photo is locked — the session is complete.
              </p>
            ) : (
              <div className="min-h-10" />
            )}
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

export default PhotoViewer
