/**
 * Gallery data + files (plan: tasks/todo.md "Photo Gallery"; rules: scripts/neon/migrations/092).
 *
 * Rows go through the normal data client (Neon Data API, RLS decides what each person sees and may
 * change). Files go through the `gallery` Neon Function (VITE_NEON_GALLERY_URL), which signs links
 * for the private bucket. Upload order matters, so a half-finished upload is never shown to others:
 *   insert row (ready=false) → sign → PUT photo + thumb → set version + ready → cleanup old files.
 */
import { supabase, usesNeonData } from '@/lib/supabase'
import { prepareGalleryImage, type GalleryImage } from '@/lib/galleryImage'

const FN_URL: string | undefined = import.meta.env.VITE_NEON_GALLERY_URL

/** The Gallery needs Neon data and the gallery Function; without them the tab says so. */
export const galleryEnabled = Boolean(FN_URL && usesNeonData)

export type GallerySession = { id: string; name: string; date: string; status: string }

export type GalleryPhoto = {
  id: string
  sessionId: string
  playerId: string
  nickname: string
  caption: string | null
  version: number
  ready: boolean
  byAdmin: boolean
  createdAt: string
  width: number | null
  height: number | null
  url: string | null
  thumbUrl: string | null
}

export class GalleryError extends Error {}

async function accessToken(): Promise<string> {
  const token = (await supabase.auth.getSession()).data.session?.access_token
  if (!token) throw new GalleryError('Please sign in again.')
  return token
}

async function callFn<T>(action: string, payload: Record<string, unknown>): Promise<T> {
  if (!FN_URL) throw new GalleryError('The Gallery is not set up on this site yet.')
  const res = await fetch(FN_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload }),
  })
  const body = (await res.json().catch(() => ({}))) as { error?: string } & T
  if (!res.ok) throw new GalleryError(body.error ?? `Gallery request failed (${res.status})`)
  return body
}

type Row = {
  id: string
  session_id: string
  player_id: string
  caption: string | null
  version: number
  ready: boolean
  by_admin: boolean
  created_at: string
  width: number | null
  height: number | null
}

/** Sessions that can have an album (live or finished), newest first, with every photo the caller may see. */
export async function fetchGallery(): Promise<{ sessions: GallerySession[]; photos: GalleryPhoto[] }> {
  const { data: sessionRows, error: sErr } = await supabase
    .from('sessions')
    .select('id, name, date, status')
    .in('status', ['in_progress', 'complete'])
    .order('date', { ascending: false })
    .limit(40)
  if (sErr) throw new GalleryError(sErr.message)
  const sessions = (sessionRows ?? []) as GallerySession[]
  if (sessions.length === 0) return { sessions, photos: [] }

  const { data: photoRows, error: pErr } = await supabase
    .from('session_photos')
    .select('id, session_id, player_id, caption, version, ready, by_admin, created_at, width, height')
    .in('session_id', sessions.map((s) => s.id))
    .order('created_at', { ascending: true })
  if (pErr) throw new GalleryError(pErr.message)
  const rows = (photoRows ?? []) as Row[]

  const playerIds = [...new Set(rows.map((r) => r.player_id))]
  const names = new Map<string, string>()
  if (playerIds.length) {
    const { data: people, error: nErr } = await supabase.from('profiles').select('id, nickname').in('id', playerIds)
    if (nErr) throw new GalleryError(nErr.message)
    for (const p of (people ?? []) as Array<{ id: string; nickname: string | null }>) names.set(p.id, p.nickname ?? 'Player')
  }

  const links = new Map<string, { url: string; thumbUrl: string }>()
  const ready = rows.filter((r) => r.ready).map((r) => r.id)
  for (let i = 0; i < ready.length; i += 60) {
    const { urls } = await callFn<{ urls: Array<{ id: string; url: string; thumbUrl: string }> }>('urls', { ids: ready.slice(i, i + 60) })
    for (const u of urls) links.set(u.id, { url: u.url, thumbUrl: u.thumbUrl })
  }

  return {
    sessions,
    photos: rows.map((r) => ({
      id: r.id,
      sessionId: r.session_id,
      playerId: r.player_id,
      nickname: names.get(r.player_id) ?? 'Player',
      caption: r.caption,
      version: r.version,
      ready: r.ready,
      byAdmin: r.by_admin,
      createdAt: r.created_at,
      width: r.width,
      height: r.height,
      url: links.get(r.id)?.url ?? null,
      thumbUrl: links.get(r.id)?.thumbUrl ?? null,
    })),
  }
}

/** What the signed-in person may do, for showing the right buttons. The database enforces it regardless. */
export async function fetchGalleryAccess(userId: string, liveSessionIds: string[]): Promise<{ canView: boolean; registeredLive: Set<string>; myName: string }> {
  const [profile, stats, regs] = await Promise.all([
    supabase.from('profiles').select('is_guest, role, nickname').eq('id', userId).maybeSingle(),
    supabase.from('player_stats').select('sessions_attended').eq('player_id', userId).maybeSingle(),
    liveSessionIds.length
      ? supabase.from('session_registrations').select('session_id').eq('player_id', userId).in('session_id', liveSessionIds)
      : Promise.resolve({ data: [], error: null }),
  ])
  for (const r of [profile, stats, regs]) if (r.error) throw new GalleryError(r.error.message)
  const p = profile.data as { is_guest: boolean | null; role: string | null; nickname: string | null } | null
  const attended = (stats.data as { sessions_attended: number } | null)?.sessions_attended ?? 0
  return {
    canView: p?.role === 'admin' || (!p?.is_guest && attended >= 1),
    myName: p?.nickname ?? 'You',
    registeredLive: new Set(((regs.data ?? []) as Array<{ session_id: string }>).map((r) => r.session_id)),
  }
}

async function putFile(url: string, body: Blob, type: string) {
  const res = await fetch(url, { method: 'PUT', body, headers: { 'Content-Type': type } })
  if (!res.ok) throw new GalleryError(`Upload failed (${res.status}). Check your connection and try again.`)
}

/** Shrinks a chosen file for upload (see galleryImage.ts). Re-exported so the sheet can preview the result. */
export const prepareImage = prepareGalleryImage

/** Sends a new photo, or a replacement for `photoId`. Returns the row id. */
export async function uploadPhoto(opts: { sessionId: string; userId: string; image: GalleryImage; caption: string | null; photoId?: string }): Promise<string> {
  const img = opts.image
  let id = opts.photoId
  if (!id) {
    const { data, error } = await supabase
      .from('session_photos')
      .insert({ session_id: opts.sessionId, player_id: opts.userId, caption: opts.caption })
      .select('id')
    if (error) {
      if (error.code === '23505') throw new GalleryError('You already added a photo for this session — open it to replace it.')
      if (error.code === '42501') throw new GalleryError('Uploads for this session are closed.')
      throw new GalleryError(error.message)
    }
    id = (data as Array<{ id: string }> | null)?.[0]?.id
    if (!id) throw new GalleryError('Could not start the upload.')
  } else {
    await updateCaption(id, opts.caption)
  }

  const slot = await callFn<{ version: number; put: string; putThumb: string }>('sign', { id, type: img.type })
  await putFile(slot.put, img.photo, img.type)
  await putFile(slot.putThumb, img.thumb, img.type)

  const { error: doneErr } = await supabase
    .from('session_photos')
    .update({ version: slot.version, ready: true, width: img.width, height: img.height })
    .eq('id', id)
  if (doneErr) throw new GalleryError(doneErr.message)
  // Best effort: an old version left behind costs storage, not correctness.
  await callFn('cleanup', { id }).catch(() => undefined)
  return id
}

export async function updateCaption(photoId: string, caption: string | null): Promise<void> {
  const { data, error } = await supabase.from('session_photos').update({ caption }).eq('id', photoId).select('id')
  if (error) throw new GalleryError(error.message)
  if (!data || (data as unknown[]).length === 0) throw new GalleryError('This photo is locked.')
}

export async function deletePhoto(photoId: string): Promise<void> {
  await callFn('delete', { id: photoId })
}

export const CAPTION_MAX = 140
