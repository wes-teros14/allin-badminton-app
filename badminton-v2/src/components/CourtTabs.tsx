import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import type { AdminMatchDisplay } from '@/hooks/useAdminSession'
import { useAdminActions } from '@/hooks/useAdminActions'
import { usePlayerList } from '@/hooks/usePlayerList'
import { supabase } from '@/lib/supabase'
import { elapsedSecondsFromStartedAt } from '@/utils/matchTiming'

function formatElapsed(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function defaultCourtLabel(courtNumber: 1 | 2) {
  return `Court ${courtNumber}`
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
  courtLabel,
  onCourtLabelChange,
  onCourtLabelCommit,
}: {
  courtNumber: 1 | 2
  current: AdminMatchDisplay | null
  sessionId: string | null
  isSaving: boolean
  onMarkDone: (matchId: string, court: 1 | 2, sessionId: string, winningPairIndex?: 1 | 2, startedAt?: string | null) => void
  onEdit: (m: AdminMatchDisplay) => void
  onMoveUp: () => void
  onMoveDown: () => void
  canMoveUp: boolean | null
  canMoveDown: boolean | null
  courtLabel: string
  onCourtLabelChange: (courtNumber: 1 | 2, label: string) => void
  onCourtLabelCommit: (courtNumber: 1 | 2, label: string) => void
}) {
  const [elapsed, setElapsed] = useState(0)
  const [confirmingFinish, setConfirmingFinish] = useState(false)

  useEffect(() => {
    setElapsed(elapsedSecondsFromStartedAt(current?.startedAt ?? null) ?? 0)
    setConfirmingFinish(false)
  }, [current?.id, current?.startedAt])

  useEffect(() => {
    if (!current || confirmingFinish) return

    const intervalId = setInterval(() => {
      setElapsed(elapsedSecondsFromStartedAt(current.startedAt) ?? 0)
    }, 1000)

    return () => clearInterval(intervalId)
  }, [current, confirmingFinish])

  function handleFinish(winningPairIndex: 1 | 2) {
    if (!current || !sessionId) return
    onMarkDone(current.id, courtNumber, sessionId, winningPairIndex, current.startedAt)
    setConfirmingFinish(false)
  }

  return (
    <div>
      <input
        value={courtLabel}
        onChange={(e) => onCourtLabelChange(courtNumber, e.target.value)}
        onBlur={(e) => {
          const label = e.target.value.trim() || defaultCourtLabel(courtNumber)
          onCourtLabelChange(courtNumber, label)
          onCourtLabelCommit(courtNumber, label)
        }}
        aria-label={`Court ${courtNumber} label`}
        className="mb-2 w-full max-w-[10rem] rounded bg-transparent px-0 py-0.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground outline-none transition-colors focus:bg-background focus:px-2 focus:text-foreground focus:ring-1 focus:ring-border"
      />
      {current ? (
        <div className="relative overflow-hidden rounded-xl border border-primary/30 bg-[var(--primary-subtle)] p-4 space-y-3">
          {/* Header row */}
          <div className="flex min-w-0 flex-col gap-1 pr-16">
            <span className="text-xs font-bold uppercase tracking-widest text-red-500">Playing</span>
            <span className="whitespace-nowrap text-2xl font-bold leading-none text-primary">Game {current.gameNumber}</span>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-xs font-bold text-red-500 tracking-widest">
                <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                LIVE
              </span>
              <span className="text-xs font-mono font-semibold text-[#FFB200]">{formatElapsed(elapsed)}</span>
            </div>
            <div className="absolute right-3 top-3 flex shrink-0 flex-col gap-0.5">
              {canMoveUp !== null && <button onClick={onMoveUp} disabled={isSaving || !canMoveUp} className="px-3 py-2 text-sm rounded border border-border text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed">↑</button>}
              {canMoveDown !== null && <button onClick={onMoveDown} disabled={isSaving || !canMoveDown} className="px-3 py-2 text-sm rounded border border-border text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed">↓</button>}
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
                onClick={() => { if (current && sessionId) { onMarkDone(current.id, courtNumber, sessionId, undefined, current.startedAt); setConfirmingFinish(false) } }}
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
  t1p1Id: string
  t1p2Id: string
  t2p1Id: string
  t2p2Id: string
}

function PlayerSelect({
  value,
  onChange,
  players,
  disabled,
  placeholder,
}: {
  value: string
  onChange: (id: string) => void
  players: Array<{ id: string; displayName: string }>
  disabled?: boolean
  placeholder: string
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="border border-border rounded px-2 py-1 text-sm w-full bg-background text-foreground"
    >
      <option value="">{placeholder}</option>
      {players.map((p) => (
        <option key={p.id} value={p.id}>{p.displayName}</option>
      ))}
    </select>
  )
}

export function CourtTabs({ court1Current, court2Current, queued, isLoading, sessionId, onDone }: Props) {
  const { isSaving, editMatch, moveUp, moveDown, markDone, swapCourts, demoteToQueue, promoteTocourt } = useAdminActions(onDone)
  const { players } = usePlayerList(sessionId ?? undefined)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<EditForm>({ t1p1Id: '', t1p2Id: '', t2p2Id: '', t2p1Id: '' })
  const [courtLabels, setCourtLabels] = useState<Record<1 | 2, string>>({
    1: defaultCourtLabel(1),
    2: defaultCourtLabel(2),
  })

  useEffect(() => {
    if (!sessionId) {
      setCourtLabels({ 1: defaultCourtLabel(1), 2: defaultCourtLabel(2) })
      return
    }

    const activeSessionId = sessionId
    let cancelled = false
    async function loadCourtLabels() {
      const { data, error } = await supabase
        .from('sessions')
        .select('court_1_label, court_2_label')
        .eq('id', activeSessionId)
        .maybeSingle()

      if (cancelled) return
      if (error) {
        toast.error(error.message)
        return
      }

      setCourtLabels({
        1: data?.court_1_label || defaultCourtLabel(1),
        2: data?.court_2_label || defaultCourtLabel(2),
      })
    }

    void loadCourtLabels()
    return () => { cancelled = true }
  }, [sessionId])

  function handleCourtLabelChange(courtNumber: 1 | 2, label: string) {
    setCourtLabels((current) => {
      return { ...current, [courtNumber]: label }
    })
  }

  async function handleCourtLabelCommit(courtNumber: 1 | 2, label: string) {
    if (!sessionId) return

    const field = courtNumber === 1 ? 'court_1_label' : 'court_2_label'
    const { error } = await supabase
      .from('sessions')
      .update({ [field]: label })
      .eq('id', sessionId)

    if (error) {
      toast.error(error.message)
    }
  }

  function startEdit(m: AdminMatchDisplay) {
    setEditingId(m.id)
    setEditForm({
      t1p1Id: m.t1p1Id,
      t1p2Id: m.t1p2Id,
      t2p1Id: m.t2p1Id,
      t2p2Id: m.t2p2Id,
    })
  }

  async function handleSave(matchId: string) {
    if (!editForm.t1p1Id || !editForm.t1p2Id || !editForm.t2p1Id || !editForm.t2p2Id) {
      return
    }
    await editMatch(matchId, editForm)
    setEditingId(null)
    onDone()
  }

  function EditFormInline({ matchId }: { matchId: string }) {
    return (
      <div className="space-y-2 mt-3">
        <div className="flex gap-2">
          <PlayerSelect value={editForm.t1p1Id} onChange={(id) => setEditForm((f) => ({ ...f, t1p1Id: id }))} players={players} disabled={isSaving} placeholder="Player 1" />
          <PlayerSelect value={editForm.t1p2Id} onChange={(id) => setEditForm((f) => ({ ...f, t1p2Id: id }))} players={players} disabled={isSaving} placeholder="Player 2" />
        </div>
        <p className="text-xs text-muted-foreground text-center">vs</p>
        <div className="flex gap-2">
          <PlayerSelect value={editForm.t2p1Id} onChange={(id) => setEditForm((f) => ({ ...f, t2p1Id: id }))} players={players} disabled={isSaving} placeholder="Player 3" />
          <PlayerSelect value={editForm.t2p2Id} onChange={(id) => setEditForm((f) => ({ ...f, t2p2Id: id }))} players={players} disabled={isSaving} placeholder="Player 4" />
        </div>
        <div className="flex gap-2">
          <button onClick={() => handleSave(matchId)} disabled={isSaving || !editForm.t1p1Id || !editForm.t1p2Id || !editForm.t2p1Id || !editForm.t2p2Id} className="flex-1 py-1.5 rounded bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">Save</button>
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <CourtCard
            courtNumber={1} current={court1Current} sessionId={sessionId} isSaving={isSaving}
            courtLabel={courtLabels[1]} onCourtLabelChange={handleCourtLabelChange} onCourtLabelCommit={handleCourtLabelCommit}
            onMarkDone={markDone} onEdit={startEdit}
            canMoveUp={!!court1Current} canMoveDown={!!court2Current}
            onMoveUp={() => court1Current && sessionId && demoteToQueue(court1Current.id, sessionId)}
            onMoveDown={() => court1Current && court2Current && swapCourts(court1Current.id, court2Current.id)}
          />
          {editingId === court1Current?.id && <EditFormInline matchId={court1Current.id} />}
        </div>
        <div>
          <CourtCard
            courtNumber={2} current={court2Current} sessionId={sessionId} isSaving={isSaving}
            courtLabel={courtLabels[2]} onCourtLabelChange={handleCourtLabelChange} onCourtLabelCommit={handleCourtLabelCommit}
            onMarkDone={markDone} onEdit={startEdit}
            canMoveUp={!!court1Current} canMoveDown={!!court2Current}
            onMoveUp={() => court1Current && court2Current && swapCourts(court1Current.id, court2Current.id)}
            onMoveDown={() => court2Current && sessionId && demoteToQueue(court2Current.id, sessionId)}
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
                      <PlayerSelect value={editForm.t1p1Id} onChange={(id) => setEditForm((f) => ({ ...f, t1p1Id: id }))} players={players} disabled={isSaving} placeholder="Player 1" />
                      <PlayerSelect value={editForm.t1p2Id} onChange={(id) => setEditForm((f) => ({ ...f, t1p2Id: id }))} players={players} disabled={isSaving} placeholder="Player 2" />
                    </div>
                    <p className="text-xs text-muted-foreground text-center">vs</p>
                    <div className="flex gap-2">
                      <PlayerSelect value={editForm.t2p1Id} onChange={(id) => setEditForm((f) => ({ ...f, t2p1Id: id }))} players={players} disabled={isSaving} placeholder="Player 3" />
                      <PlayerSelect value={editForm.t2p2Id} onChange={(id) => setEditForm((f) => ({ ...f, t2p2Id: id }))} players={players} disabled={isSaving} placeholder="Player 4" />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSave(m.id)}
                        disabled={isSaving || !editForm.t1p1Id || !editForm.t1p2Id || !editForm.t2p1Id || !editForm.t2p2Id}
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
                    <span className="w-20 shrink-0 whitespace-nowrap text-lg font-bold text-muted-foreground">Game {m.gameNumber}</span>
                    <div className="text-sm flex-1 min-w-0">
                      <p className="font-medium">{m.t1p1} &amp; {m.t1p2}</p>
                      <p className="text-muted-foreground text-xs mt-0.5 mb-0.5">vs</p>
                      <p className="font-medium">{m.t2p1} &amp; {m.t2p2}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => {
                          if (idx === 0) {
                            const availableCourt = !court1Current ? 1 : !court2Current ? 2 : null
                            if (availableCourt) promoteTocourt(m.id, availableCourt)
                          } else {
                            moveUp(m.id, m.gameNumber, queued)
                          }
                        }}
                        disabled={isSaving || (idx === 0 && !!court1Current && !!court2Current)}
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
