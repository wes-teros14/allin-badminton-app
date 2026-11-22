/**
 * Gallery tab (plan: tasks/todo.md "Photo Gallery"; owner's picks 2026-11-20/21).
 *   /gallery             every album: six photos each, "+N" opens the rest (layout A)
 *   /gallery/:sessionId  one album, all photos
 * One photo per player per session, added while the session is live; editable until it
 * completes; admin can do anything. Viewing needs one completed session. The database enforces
 * all of it (migration 092) — this screen only shows the matching buttons.
 */
import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'
import { Camera, ChevronLeft, ImageIcon, Lock } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useGallery, type GalleryAlbum } from '@/hooks/useGallery'
import { PhotoViewer } from '@/components/gallery/PhotoViewer'
import { PhotoSheet, type PhotoSheetMode } from '@/components/gallery/PhotoSheet'
import { BottomSheet } from '@/components/BottomSheet'
import { deletePhoto, type GalleryPhoto } from '@/lib/galleryApi'
import { formatSessionDate } from '@/lib/sessionStamp'

const PREVIEW = 6

function albumTitle(a: GalleryAlbum) {
  return a.name?.trim() || formatSessionDate(a.date) || 'Session'
}
function albumSub(a: GalleryAlbum) {
  return a.name?.trim() ? formatSessionDate(a.date) : null
}

function LiveChip() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FEFE6A] px-2 py-0.5 text-[11px] font-bold text-[#1B1220]">
      <span className="h-1.5 w-1.5 rounded-full bg-[#B3252B]" aria-hidden="true" />Live now
    </span>
  )
}

function AddTile({ admin, onClick }: { admin: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex aspect-square flex-col items-center justify-center gap-1 border-[1.5px] border-dashed border-primary-ink bg-primary-subtle p-1.5 text-center text-xs font-semibold text-primary-ink"
    >
      <Camera className="h-5 w-5" aria-hidden="true" />
      {admin ? (<>Add photo<span className="text-[11px] font-normal">admin · no limit</span></>) : 'Add your photo'}
    </button>
  )
}

function Tile({ p, userId, locked, more, href, onOpen }: { p: GalleryPhoto; userId: string; locked: boolean; more?: number; href?: string; onOpen?: () => void }) {
  const mine = p.playerId === userId
  const cls = 'relative block aspect-square w-full overflow-hidden bg-muted'
  const inner = (
    <>
      {p.thumbUrl ? (
        <img src={p.thumbUrl} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <span className="absolute inset-0 grid place-items-center px-1 text-[11px] text-muted-foreground">Upload didn't finish</span>
      )}
      {mine && <span className="absolute bottom-1.5 left-1.5 rounded-full bg-[#FEFE6A] px-1.5 py-0.5 text-[11px] font-bold text-[#1B1220]">You</span>}
      {mine && locked && (
        <span className="absolute top-1.5 right-1.5 grid h-5.5 w-5.5 place-items-center rounded-full bg-black/60 text-white" aria-label="Locked">
          <Lock className="h-3 w-3" />
        </span>
      )}
      {more !== undefined && (
        <span className="absolute inset-0 grid place-items-center bg-black/60 text-lg font-bold text-white">+{more}</span>
      )}
    </>
  )
  return href ? (
    <Link to={href} aria-label={`See all photos (${more} more)`} className={cls}>{inner}</Link>
  ) : (
    <button type="button" onClick={onOpen} aria-label={`Photo by ${mine ? 'you' : p.nickname}`} className={cls}>{inner}</button>
  )
}

export function GalleryView() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const { user } = useAuth()
  const g = useGallery()
  const [viewer, setViewer] = useState<{ sessionId: string; index: number } | null>(null)
  const [sheet, setSheet] = useState<PhotoSheetMode | null>(null)
  const [toDelete, setToDelete] = useState<GalleryPhoto | null>(null)
  const [deleting, setDeleting] = useState(false)

  const userId = user?.id ?? ''
  const ownOnly = !g.canView

  const album = sessionId ? g.albums.find((a) => a.id === sessionId) ?? null : null
  // List: albums with something to show or somewhere to add; a first-timer sees only theirs.
  const listed = g.albums.filter((a) => a.photos.length > 0 || (a.canUpload && a.live))

  const viewerAlbum = viewer ? g.albums.find((a) => a.id === viewer.sessionId) : null

  async function confirmDelete() {
    if (!toDelete) return
    setDeleting(true)
    try {
      await deletePhoto(toDelete.id)
      toast.success('Photo deleted')
      setToDelete(null)
      setViewer(null)
      await g.reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not delete the photo')
    } finally {
      setDeleting(false)
    }
  }

  function grid(a: GalleryAlbum, limit: number | null) {
    const cells: ReactNode[] = []
    if (a.canUpload) cells.push(<AddTile key="add" admin={g.isAdmin} onClick={() => setSheet({ kind: 'add', sessionId: a.id, sessionName: albumTitle(a) })} />)
    const room = limit === null ? a.photos.length : Math.max(0, limit - cells.length)
    a.photos.slice(0, room).forEach((p, i) => {
      const last = limit !== null && i === room - 1 && a.photos.length > room
      cells.push(
        last ? (
          <Tile key={p.id} p={p} userId={userId} locked={!g.canChange(p)} more={a.photos.length - room + 1} href={`/gallery/${a.id}`} />
        ) : (
          <Tile key={p.id} p={p} userId={userId} locked={!g.canChange(p)} onOpen={() => setViewer({ sessionId: a.id, index: i })} />
        ),
      )
    })
    if (cells.length === 0) return <p className="rounded-xl bg-muted px-4 py-5 text-sm text-muted-foreground">No photos yet.</p>
    return <div className="grid grid-cols-3 gap-[3px] overflow-hidden rounded-xl">{cells}</div>
  }

  function head(a: GalleryAlbum, link: boolean) {
    const sub = albumSub(a)
    return (
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          {link ? (
            <Link to={`/gallery/${a.id}`} className="block truncate text-[15px] font-semibold hover:underline">{albumTitle(a)}</Link>
          ) : null}
          {link && sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
        {a.live ? <LiveChip /> : (
          <span className="shrink-0 text-xs text-muted-foreground">{a.photos.length} photo{a.photos.length === 1 ? '' : 's'}</span>
        )}
      </div>
    )
  }

  let body: ReactNode
  if (!g.enabled) {
    body = <p className="text-sm text-muted-foreground">The Gallery isn't switched on for this site yet.</p>
  } else if (g.loading) {
    body = (
      <div className="space-y-6">
        {[0, 1].map((i) => <div key={i} className="h-56 animate-pulse rounded-xl bg-muted" />)}
      </div>
    )
  } else if (g.error) {
    body = (
      <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
        <p className="font-semibold text-destructive">Couldn't load the Gallery</p>
        <p className="mt-1 text-muted-foreground">{g.error}</p>
        <button type="button" onClick={() => void g.reload()} className="mt-3 min-h-10 rounded-lg border border-border px-4 text-sm font-semibold">Try again</button>
      </div>
    )
  } else if (sessionId) {
    body = album ? (
      <>
        <p className="mb-3 text-sm text-muted-foreground">
          {album.live
            ? album.mine && !g.isAdmin ? "You've added your photo — open it to change it." : 'Session in progress'
            : g.isAdmin ? 'Session complete — locked for players; you can still change anything.' : 'Session complete — photos are locked.'}
        </p>
        <div className="mb-2 flex justify-between text-xs text-muted-foreground">
          <span>{album.photos.length} photo{album.photos.length === 1 ? '' : 's'}</span>
          {album.live ? <LiveChip /> : <span className="inline-flex items-center gap-1"><Lock className="h-3 w-3" />Locked</span>}
        </div>
        {grid(album, null)}
      </>
    ) : (
      <p className="text-sm text-muted-foreground">This album doesn't exist or has no photos you can see.</p>
    )
  } else {
    body = (
      <>
        {ownOnly && (
          <div className="mb-6 rounded-xl border border-border bg-card px-4 py-5 text-center text-sm text-muted-foreground">
            <ImageIcon className="mx-auto mb-1.5 h-7 w-7 text-primary-ink" aria-hidden="true" />
            <p className="mb-1 text-[15px] font-semibold text-foreground">Albums open after your first completed session</p>
            Add your photo during the session — once the admin closes it, every album is yours to browse.
          </div>
        )}
        {listed.length === 0 ? (
          !ownOnly && <p className="text-sm text-muted-foreground">No photos yet. During a session, players can add one photo each.</p>
        ) : (
          listed.map((a) => (
            <section key={a.id} className="mb-7">
              {head(a, true)}
              {grid(a, PREVIEW)}
            </section>
          ))
        )}
      </>
    )
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-8 sm:max-w-md md:max-w-lg">
      {sessionId ? (
        <>
          <Link to="/gallery" className="mb-2 inline-flex items-center gap-1 py-1 text-sm text-primary-ink"><ChevronLeft className="h-4 w-4" />Gallery</Link>
          <h1 className="text-2xl font-bold tracking-tight">{album ? albumTitle(album) : 'Album'}</h1>
          {album && albumSub(album) && <p className="text-sm text-muted-foreground">{albumSub(album)}</p>}
          <div className="mt-4">{body}</div>
        </>
      ) : (
        <>
          <div className="mb-6 space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">Gallery</h1>
            <p className="text-sm text-muted-foreground">One photo per player each session.</p>
          </div>
          {body}
        </>
      )}

      <PhotoViewer
        photos={viewerAlbum?.photos ?? []}
        index={viewer?.index ?? null}
        sessionLabel={viewerAlbum ? albumTitle(viewerAlbum) : ''}
        userId={userId}
        canChange={g.canChange}
        ownOnly={ownOnly}
        onIndex={(i) => setViewer((v) => (v ? { ...v, index: i } : v))}
        onClose={() => setViewer(null)}
        onReplace={(p) => { setViewer(null); setSheet({ kind: 'replace', photo: p }) }}
        onCaption={(p) => { setViewer(null); setSheet({ kind: 'caption', photo: p }) }}
        onDelete={(p) => { setViewer(null); setToDelete(p) }}
      />

      <PhotoSheet
        mode={sheet}
        userId={userId}
        displayName={g.myName}
        isAdmin={g.isAdmin}
        onClose={() => setSheet(null)}
        onSaved={() => void g.reload()}
      />

      <BottomSheet
        open={toDelete !== null}
        onOpenChange={(o) => { if (!o && !deleting) setToDelete(null) }}
        title={toDelete && toDelete.playerId === userId ? 'Delete your photo?' : `Delete ${toDelete?.nickname ?? ''}'s photo?`}
        description={toDelete && toDelete.playerId === userId ? 'You can add a new one while the session is in progress.' : "It's removed for everyone. This can't be undone."}
      >
        <div className="flex gap-2">
          <button type="button" onClick={() => setToDelete(null)} disabled={deleting} className="min-h-11 flex-1 rounded-lg border border-border text-sm font-semibold text-muted-foreground">Keep it</button>
          <button type="button" onClick={() => void confirmDelete()} disabled={deleting} className="min-h-11 flex-1 rounded-lg bg-destructive text-sm font-semibold text-white disabled:opacity-50">
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}

export default GalleryView
