import { useState, useEffect, useRef } from 'react'
import type { AdminMatchDisplay } from '@/hooks/useAdminSession'
import { useAdminActions } from '@/hooks/useAdminActions'

function formatElapsed(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

interface Props {
  court1Current: AdminMatchDisplay | null
  court2Current: AdminMatchDisplay | null
  queued: AdminMatchDisplay[]
  isLoading: boolean
  sessionId: string | null
  onDone: () => void
}

function CourtCard({
  courtNumber,
  current,
  sessionId,
  isSaving,
  onMarkDone,
}: {
  courtNumber: 1 | 2
  current: AdminMatchDisplay | null
  sessionId: string | null
  isSaving: boolean
  onMarkDone: (matchId: string, court: 1 | 2, sessionId: string) => void
}) {
  const [elapsed, setElapsed] = useState(0)
  const matchStartRef = useRef<number>(Date.now())
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    matchStartRef.current = Date.now()
    setElapsed(0)
  }, [current?.id])

  useEffect(() => {
    if (current) {
      intervalRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - matchStartRef.current) / 1000))
      }, 1000)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [current?.id])

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
        Court {courtNumber}
      </p>
      {current ? (
        <div className="rounded-xl border border-primary/30 bg-[var(--primary-subtle)] p-4">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-3">
              <span className="text-3xl font-bold text-primary">{current.gameNumber}</span>
              <span className="flex items-center gap-1.5 text-xs font-bold text-red-500 tracking-widest">
                <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                LIVE
              </span>
              <span className="text-xs font-mono font-semibold text-[#FFB200]">{formatElapsed(elapsed)}</span>
            </div>
            <button
              onClick={() => sessionId && onMarkDone(current.id, courtNumber, sessionId)}
              disabled={isSaving || !sessionId}
              className="text-xs px-2 py-1 rounded border border-destructive text-destructive hover:bg-destructive/10 disabled:opacity-40 transition-colors"
            >
              Mark Done
            </button>
          </div>
          <p className="text-sm font-medium">{current.t1p1} &amp; {current.t1p2}</p>
          <p className="text-xs text-muted-foreground my-0.5">vs</p>
          <p className="text-sm font-medium">{current.t2p1} &amp; {current.t2p2}</p>
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">No match playing</p>
      )}
    </div>
  )
}

interface EditForm {
  t1p1: string
  t1p2: string
  t2p1: string
  t2p2: string
}

export function CourtTabs({ court1Current, court2Current, queued, isLoading, sessionId, onDone }: Props) {
  const { isSaving, editMatch, moveUp, moveDown, markDone } = useAdminActions(onDone)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<EditForm>({ t1p1: '', t1p2: '', t2p1: '', t2p2: '' })

  function startEdit(m: AdminMatchDisplay) {
    setEditingId(m.id)
    setEditForm({ t1p1: m.t1p1, t1p2: m.t1p2, t2p1: m.t2p1, t2p2: m.t2p2 })
  }

  async function handleSave(matchId: string) {
    await editMatch(matchId, editForm)
    setEditingId(null)
  }

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-2 gap-4">
          <div className="h-24 bg-muted rounded-xl" />
          <div className="h-24 bg-muted rounded-xl" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-12 bg-muted rounded" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Both courts side by side */}
      <div className="grid grid-cols-2 gap-4">
        <CourtCard courtNumber={1} current={court1Current} sessionId={sessionId} isSaving={isSaving} onMarkDone={markDone} />
        <CourtCard courtNumber={2} current={court2Current} sessionId={sessionId} isSaving={isSaving} onMarkDone={markDone} />
      </div>

      {/* Global queue */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
          Queue
        </p>
        {queued.length === 0 ? (
          <p className="text-muted-foreground text-sm">Queue is empty</p>
        ) : (
          <div className="divide-y divide-border">
            {queued.map((m, idx) => (
              <div key={m.id} className="py-3">
                {editingId === m.id ? (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        value={editForm.t1p1}
                        onChange={(e) => setEditForm((f) => ({ ...f, t1p1: e.target.value }))}
                        className="border border-border rounded px-2 py-1 text-sm w-full bg-background"
                        placeholder="Player 1"
                      />
                      <input
                        value={editForm.t1p2}
                        onChange={(e) => setEditForm((f) => ({ ...f, t1p2: e.target.value }))}
                        className="border border-border rounded px-2 py-1 text-sm w-full bg-background"
                        placeholder="Player 2"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground text-center">vs</p>
                    <div className="flex gap-2">
                      <input
                        value={editForm.t2p1}
                        onChange={(e) => setEditForm((f) => ({ ...f, t2p1: e.target.value }))}
                        className="border border-border rounded px-2 py-1 text-sm w-full bg-background"
                        placeholder="Player 3"
                      />
                      <input
                        value={editForm.t2p2}
                        onChange={(e) => setEditForm((f) => ({ ...f, t2p2: e.target.value }))}
                        className="border border-border rounded px-2 py-1 text-sm w-full bg-background"
                        placeholder="Player 4"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSave(m.id)}
                        disabled={isSaving}
                        className="flex-1 py-1.5 rounded bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        disabled={isSaving}
                        className="flex-1 py-1.5 rounded border border-border text-sm text-muted-foreground disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <span className="text-lg font-bold text-muted-foreground w-8 shrink-0">{m.gameNumber}</span>
                    <div className="text-sm flex-1 min-w-0">
                      <p className="font-medium">{m.t1p1} &amp; {m.t1p2}</p>
                      <p className="text-muted-foreground text-xs mt-0.5">vs {m.t2p1} &amp; {m.t2p2}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => moveUp(m.id, m.gameNumber, queued)}
                        disabled={isSaving || idx === 0}
                        className="px-1.5 py-1 text-xs rounded border border-border text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => moveDown(m.id, m.gameNumber, queued)}
                        disabled={isSaving || idx === queued.length - 1}
                        className="px-1.5 py-1 text-xs rounded border border-border text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        ↓
                      </button>
                      <button
                        onClick={() => startEdit(m)}
                        disabled={isSaving}
                        className="px-2 py-1 text-xs rounded border border-border text-muted-foreground hover:text-foreground disabled:opacity-30"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
