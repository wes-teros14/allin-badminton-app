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
  onEdit,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: {
  courtNumber: 1 | 2
  current: AdminMatchDisplay | null
  sessionId: string | null
  isSaving: boolean
  onMarkDone: (matchId: string, court: 1 | 2, sessionId: string, winningPairIndex?: 1 | 2, durationSeconds?: number) => void
  onEdit: (m: AdminMatchDisplay) => void
  onMoveUp: () => void
  onMoveDown: () => void
  canMoveUp: boolean
  canMoveDown: boolean
}) {
  const [elapsed, setElapsed] = useState(0)
  const [confirmingFinish, setConfirmingFinish] = useState(false)
  const matchStartRef = useRef<number>(Date.now())
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    matchStartRef.current = Date.now()
    setElapsed(0)
    setConfirmingFinish(false)
  }, [current?.id])

  useEffect(() => {
    if (current && !confirmingFinish) {
      intervalRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - matchStartRef.current) / 1000))
      }, 1000)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [current?.id, confirmingFinish])

  function handleFinish(winningPairIndex: 1 | 2) {
    if (!current || !sessionId) return
    onMarkDone(current.id, courtNumber, sessionId, winningPairIndex, elapsed)
    setConfirmingFinish(false)
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
        Court {courtNumber}
      </p>
      {current ? (
        <div className="rounded-xl border border-primary/30 bg-[var(--primary-subtle)] p-4 space-y-3">
          {/* Header row */}
          <div className="flex items-center gap-3">
            <span className="text-3xl font-bold text-primary">{current.gameNumber}</span>
            <span className="flex items-center gap-1.5 text-xs font-bold text-red-500 tracking-widest">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              LIVE
            </span>
            <span className="text-xs font-mono font-semibold text-[#FFB200] ml-auto">{formatElapsed(elapsed)}</span>
            <div className="flex flex-col gap-0.5">
              <button onClick={onMoveUp} disabled={isSaving || !canMoveUp} className="px-3 py-2 text-sm rounded border border-border text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed">↑</button>
              <button onClick={onMoveDown} disabled={isSaving || !canMoveDown} className="px-3 py-2 text-sm rounded border border-border text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed">↓</button>
            </div>
          </div>

          {confirmingFinish ? (
            /* Who won? */
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-widest text-[#FFB200] text-center">Who won?</p>
              <button
                onClick={() => handleFinish(1)}
                disabled={isSaving}
                className="w-full py-3 rounded-lg bg-primary/20 border border-primary/40 text-sm font-semibold hover:bg-primary/30 disabled:opacity-50 transition-colors"
              >
                {current.t1p1} &amp; {current.t1p2}
              </button>
              <button
                onClick={() => handleFinish(2)}
                disabled={isSaving}
                className="w-full py-3 rounded-lg bg-primary/20 border border-primary/40 text-sm font-semibold hover:bg-primary/30 disabled:opacity-50 transition-colors"
              >
                {current.t2p1} &amp; {current.t2p2}
              </button>
              <button
                onClick={() => { if (current && sessionId) { onMarkDone(current.id, courtNumber, sessionId, undefined, elapsed); setConfirmingFinish(false) } }}
                disabled={isSaving}
                className="w-full py-3 rounded-lg border border-border text-sm font-semibold text-muted-foreground hover:bg-muted/50 disabled:opacity-50 transition-colors"
              >
                Draw / No Winner
              </button>
              <button
                onClick={() => setConfirmingFinish(false)}
                disabled={isSaving}
                className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
              >
                Cancel
              </button>
            </div>
          ) : (
            /* Normal view */
            <>
              <div>
                <p className="text-sm font-medium text-primary">{current.t1p1} &amp; {current.t1p2}</p>
                <p className="text-xs text-muted-foreground my-0.5">vs</p>
                <p className="text-sm font-medium text-primary">{current.t2p1} &amp; {current.t2p2}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmingFinish(true)}
                  disabled={isSaving || !sessionId}
                  className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  Finish
                </button>
                <button
                  onClick={() => onEdit(current)}
                  disabled={isSaving}
                  className="px-3 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
                >
                  Edit
                </button>
              </div>
            </>
          )}
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
  const { isSaving, editMatch, moveUp, moveDown, markDone, swapCourts } = useAdminActions(onDone)
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

  function EditFormInline({ matchId }: { matchId: string }) {
    return (
      <div className="space-y-2 mt-3">
        <div className="flex gap-2">
          <input value={editForm.t1p1} onChange={(e) => setEditForm((f) => ({ ...f, t1p1: e.target.value }))} className="border border-border rounded px-2 py-1 text-sm w-full bg-background" placeholder="Player 1" />
          <input value={editForm.t1p2} onChange={(e) => setEditForm((f) => ({ ...f, t1p2: e.target.value }))} className="border border-border rounded px-2 py-1 text-sm w-full bg-background" placeholder="Player 2" />
        </div>
        <p className="text-xs text-muted-foreground text-center">vs</p>
        <div className="flex gap-2">
          <input value={editForm.t2p1} onChange={(e) => setEditForm((f) => ({ ...f, t2p1: e.target.value }))} className="border border-border rounded px-2 py-1 text-sm w-full bg-background" placeholder="Player 3" />
          <input value={editForm.t2p2} onChange={(e) => setEditForm((f) => ({ ...f, t2p2: e.target.value }))} className="border border-border rounded px-2 py-1 text-sm w-full bg-background" placeholder="Player 4" />
        </div>
        <div className="flex gap-2">
          <button onClick={() => handleSave(matchId)} disabled={isSaving} className="flex-1 py-1.5 rounded bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">Save</button>
          <button onClick={() => setEditingId(null)} disabled={isSaving} className="flex-1 py-1.5 rounded border border-border text-sm text-muted-foreground disabled:opacity-50">Cancel</button>
        </div>
      </div>
    )
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
        <div>
          <CourtCard
            courtNumber={1} current={court1Current} sessionId={sessionId} isSaving={isSaving}
            onMarkDone={markDone} onEdit={startEdit}
            canMoveUp={false} canMoveDown={!!court2Current}
            onMoveUp={() => {}} onMoveDown={() => court1Current && court2Current && swapCourts(court1Current.id, court2Current.id)}
          />
          {editingId === court1Current?.id && <EditFormInline matchId={court1Current.id} />}
        </div>
        <div>
          <CourtCard
            courtNumber={2} current={court2Current} sessionId={sessionId} isSaving={isSaving}
            onMarkDone={markDone} onEdit={startEdit}
            canMoveUp={!!court1Current} canMoveDown={false}
            onMoveUp={() => court1Current && court2Current && swapCourts(court1Current.id, court2Current.id)} onMoveDown={() => {}}
          />
          {editingId === court2Current?.id && <EditFormInline matchId={court2Current.id} />}
        </div>
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
                      <p className="text-muted-foreground text-xs mt-0.5 mb-0.5">vs</p>
                      <p className="font-medium">{m.t2p1} &amp; {m.t2p2}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => moveUp(m.id, m.gameNumber, queued)}
                        disabled={isSaving || idx === 0}
                        className="px-3 py-2 text-sm rounded border border-border text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => moveDown(m.id, m.gameNumber, queued)}
                        disabled={isSaving || idx === queued.length - 1}
                        className="px-3 py-2 text-sm rounded border border-border text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
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
