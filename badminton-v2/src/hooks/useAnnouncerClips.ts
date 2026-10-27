import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

export const ANNOUNCER_BUCKET = 'announcer-clips'

export interface AnnouncerClip {
  path: string
  updatedAt: string
}

/** Public URL of a clip, versioned so a re-record is never served from a stale cache. */
export function clipUrl(clip: AnnouncerClip): string {
  const { data } = supabase.storage.from(ANNOUNCER_BUCKET).getPublicUrl(clip.path)
  return `${data.publicUrl}?v=${encodeURIComponent(clip.updatedAt)}`
}

/** Clip index keyed by player id or phrase key (migration 088). */
export async function fetchAnnouncerClips(): Promise<Map<string, AnnouncerClip>> {
  const { data, error } = await supabase.from('announcer_clips').select('key, path, updated_at')
  if (error) throw new Error(error.message)
  return new Map(
    ((data ?? []) as Array<{ key: string; path: string; updated_at: string }>).map((r) => [r.key, { path: r.path, updatedAt: r.updated_at }]),
  )
}

/** Admin side: which keys have a clip, and saving a new one. */
export function useAnnouncerClips() {
  const { user } = useAuth()
  const [clips, setClips] = useState<Map<string, AnnouncerClip>>(new Map())
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchAnnouncerClips()
      .then((map) => { if (!cancelled) setClips(map) })
      .catch((e: Error) => { if (!cancelled) setLoadError(e.message) })
      .finally(() => { if (!cancelled) setIsLoading(false) })
    return () => { cancelled = true }
  }, [])

  const save = useCallback(async (key: string, wav: Blob): Promise<boolean> => {
    // ':' is not a safe storage path character; phrase keys become phrase-court-1.wav.
    const path = `${key.replace(/[^a-zA-Z0-9-]/g, '-')}.wav`
    const { error: uploadError } = await supabase.storage
      .from(ANNOUNCER_BUCKET)
      .upload(path, wav, { upsert: true, contentType: 'audio/wav', cacheControl: '3600' })
    if (uploadError) { toast.error(uploadError.message); return false }

    const updatedAt = new Date().toISOString()
    const { error } = await supabase
      .from('announcer_clips')
      .upsert({ key, path, updated_at: updatedAt, updated_by: user?.id ?? null } as never)
    if (error) { toast.error(error.message); return false }

    setClips((prev) => new Map(prev).set(key, { path, updatedAt }))
    return true
  }, [user?.id])

  /** Removes the recording; that word falls back to the computer voice. */
  const remove = useCallback(async (key: string): Promise<boolean> => {
    const clip = clips.get(key)
    if (!clip) return true
    // Row first: the live board reads the table, so the clip stops being played even if the file delete fails.
    const { error } = await supabase.from('announcer_clips').delete().eq('key', key)
    if (error) { toast.error(error.message); return false }
    await supabase.storage.from(ANNOUNCER_BUCKET).remove([clip.path])
    setClips((prev) => { const next = new Map(prev); next.delete(key); return next })
    return true
  }, [clips])

  return { clips, isLoading, loadError, save, remove }
}
