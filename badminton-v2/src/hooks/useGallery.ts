import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import {
  fetchGallery,
  fetchGalleryAccess,
  galleryEnabled,
  isGalleryOpen,
  type GalleryPhoto,
  type GallerySession,
} from '@/lib/galleryApi'

export type GalleryAlbum = GallerySession & {
  live: boolean
  /** Photos can be added/changed: in progress, or finished but not yet closed. */
  open: boolean
  /** Photos the viewer may see, oldest first; includes their own unfinished upload. */
  photos: GalleryPhoto[]
  /** May add a photo here now (admin: always; player: open + registered + none yet). */
  canUpload: boolean
  mine: GalleryPhoto | null
}

export type GalleryState = {
  enabled: boolean
  loading: boolean
  error: string | null
  isAdmin: boolean
  canView: boolean
  /** The signed-in person's nickname, for "Shown as". */
  myName: string
  albums: GalleryAlbum[]
  reload: () => Promise<void>
  /** May change this photo now (same rule as the database's). */
  canChange: (p: GalleryPhoto) => boolean
}

export function useGallery(): GalleryState {
  const { user, role } = useAuth()
  const isAdmin = role === 'admin'
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sessions, setSessions] = useState<GallerySession[]>([])
  const [photos, setPhotos] = useState<GalleryPhoto[]>([])
  const [canView, setCanView] = useState(false)
  const [myName, setMyName] = useState('You')
  const [registeredOpen, setRegisteredOpen] = useState<Set<string>>(new Set())

  const reload = useCallback(async () => {
    if (!user || !galleryEnabled) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const g = await fetchGallery()
      const access = await fetchGalleryAccess(
        user.id,
        g.sessions.filter(isGalleryOpen).map((s) => s.id),
      )
      setSessions(g.sessions)
      setPhotos(g.photos)
      setCanView(access.canView)
      setMyName(access.myName)
      setRegisteredOpen(access.registeredOpen)
    } catch (e) {
      // A failed load is an error, never the empty state.
      setError(e instanceof Error ? e.message : 'Could not load the Gallery.')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    void reload()
  }, [reload])

  const openIds = useMemo(() => new Set(sessions.filter(isGalleryOpen).map((s) => s.id)), [sessions])

  const canChange = useCallback(
    (p: GalleryPhoto) => isAdmin || (p.playerId === user?.id && openIds.has(p.sessionId)),
    [isAdmin, user?.id, openIds],
  )

  const albums = useMemo<GalleryAlbum[]>(() => {
    return sessions.map((s) => {
      const live = s.status === 'in_progress'
      const open = isGalleryOpen(s)
      const list = photos.filter((p) => p.sessionId === s.id)
      const mine = list.find((p) => p.playerId === user?.id && !p.byAdmin) ?? null
      const canUpload = isAdmin || (open && registeredOpen.has(s.id) && !mine)
      return { ...s, live, open, photos: list, canUpload, mine }
    })
  }, [sessions, photos, user?.id, isAdmin, registeredOpen])

  return { enabled: galleryEnabled, loading, error, isAdmin, canView, myName, albums, reload, canChange }
}
