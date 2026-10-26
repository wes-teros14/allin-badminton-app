import { useEffect, useRef, useState } from 'react'
import { Mic, Play, Square, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ClipError, processClip } from '@/lib/clipAudio'
import { clipUrl, type AnnouncerClip } from '@/hooks/useAnnouncerClips'

/** Recording stops on its own after this, in case the admin forgets to tap Stop. */
const MAX_RECORD_MS = 5000

type Stage =
  | { kind: 'idle' }
  | { kind: 'recording'; startedAt: number }
  | { kind: 'processing' }
  | { kind: 'preview'; wav: Blob; url: string }
  | { kind: 'saving'; wav: Blob; url: string }

/**
 * Record or upload one announcer clip (a player's name or a fixed word), hear it,
 * then save. Both routes go through `processClip`, so a recording and an
 * uploaded voice note end up as the same trimmed, levelled WAV.
 */
export function ClipRecorder({
  label,
  clip,
  onSave,
  className,
}: {
  /** What is being recorded, for screen readers: "AJ", "Court 1". */
  label: string
  clip: AnnouncerClip | undefined
  onSave: (wav: Blob) => Promise<boolean>
  className?: string
}) {
  const [stage, setStage] = useState<Stage>({ kind: 'idle' })
  const [elapsed, setElapsed] = useState(0)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const previewUrlRef = useRef<string | null>(null)

  // Release the mic and the preview URL if the row unmounts mid-way.
  useEffect(() => () => {
    recorderRef.current?.stream.getTracks().forEach((t) => t.stop())
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
  }, [])

  useEffect(() => {
    if (stage.kind !== 'recording') return
    const tick = setInterval(() => setElapsed(Date.now() - stage.startedAt), 200)
    const cap = setTimeout(() => recorderRef.current?.stop(), MAX_RECORD_MS)
    return () => { clearInterval(tick); clearTimeout(cap) }
  }, [stage])

  async function toPreview(input: Blob, fileName?: string) {
    setStage({ kind: 'processing' })
    try {
      const wav = await processClip(input, fileName)
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
      const url = URL.createObjectURL(wav)
      previewUrlRef.current = url
      setStage({ kind: 'preview', wav, url })
      void new Audio(url).play().catch(() => {})
    } catch (e) {
      toast.error(e instanceof ClipError ? e.message : `Couldn’t process that clip: ${(e as Error).message}`)
      setStage({ kind: 'idle' })
    }
  }

  async function startRecording() {
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      toast.error('Microphone blocked. Allow it for this site in the browser’s settings, then try again.')
      return
    }
    const recorder = new MediaRecorder(stream)
    const chunks: Blob[] = []
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }
    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop())
      recorderRef.current = null
      void toPreview(new Blob(chunks, { type: recorder.mimeType }))
    }
    recorderRef.current = recorder
    recorder.start()
    setElapsed(0)
    setStage({ kind: 'recording', startedAt: Date.now() })
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // picking the same file again must still fire
    if (file) void toPreview(file, file.name)
  }

  async function save() {
    if (stage.kind !== 'preview') return
    setStage({ ...stage, kind: 'saving' })
    const ok = await onSave(stage.wav)
    if (ok) {
      toast.success(`Saved: ${label}`)
      setStage({ kind: 'idle' })
    } else {
      setStage({ ...stage, kind: 'preview' })
    }
  }

  const hidden = (
    <input
      ref={fileRef}
      type="file"
      accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.opus,.webm,.flac,.amr,.3gp"
      className="sr-only"
      tabIndex={-1}
      aria-hidden
      onChange={onFile}
    />
  )

  if (stage.kind === 'recording') {
    return (
      <div className={cn('flex flex-wrap items-center gap-2', className)}>
        <Button type="button" variant="destructive" size="sm" onClick={() => recorderRef.current?.stop()} aria-label={`Stop recording ${label}`}>
          <Square className="size-3.5 fill-current" /> Stop
        </Button>
        <span className="text-xs font-medium text-destructive tabular-nums" aria-live="polite">
          Recording… 0:{String(Math.floor(elapsed / 1000)).padStart(2, '0')}
        </span>
      </div>
    )
  }

  if (stage.kind === 'processing') {
    return <p className={cn('text-xs text-muted-foreground', className)}>Processing…</p>
  }

  if (stage.kind === 'preview' || stage.kind === 'saving') {
    const busy = stage.kind === 'saving'
    return (
      <div className={cn('flex flex-wrap items-center gap-2', className)}>
        <Button type="button" variant="outline" size="sm" onClick={() => void new Audio(stage.url).play()} aria-label={`Play new clip for ${label}`}>
          <Play className="size-3.5" /> Play
        </Button>
        <Button type="button" size="sm" onClick={() => void save()} disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setStage({ kind: 'idle' })} disabled={busy}>
          Redo
        </Button>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {hidden}
      <Button type="button" variant="outline" size="sm" onClick={() => void startRecording()} aria-label={`Record ${label}`}>
        <Mic className="size-3.5" /> Record
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} aria-label={`Upload a clip for ${label}`}>
        <Upload className="size-3.5" /> Upload
      </Button>
      {clip ? (
        <Button type="button" variant="ghost" size="sm" onClick={() => void new Audio(clipUrl(clip)).play()} aria-label={`Play saved clip for ${label}`}>
          <Play className="size-3.5" /> Play
        </Button>
      ) : (
        <span className="text-xs text-muted-foreground">No recording</span>
      )}
    </div>
  )
}
