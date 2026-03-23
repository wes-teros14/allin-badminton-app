import { useRef, useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'
import { useSessionList } from '@/hooks/useSessionList'
import type { Session } from '@/hooks/useSession'

const STATUS_LABELS: Record<string, string> = {
  setup: 'Setup',
  registration_open: 'Registration Open',
  registration_closed: 'Registration Closed',
  schedule_locked: 'Schedule Locked',
  in_progress: 'Playing',
  complete: 'Complete',
}

const STATUS_COLORS: Record<string, string> = {
  setup: 'text-muted-foreground',
  registration_open: 'text-[#EB5B00]',
  registration_closed: 'text-[#FFB200]',
  schedule_locked: 'text-[#FFB200]',
  in_progress: 'text-[#D91656] font-bold',
  complete: 'text-muted-foreground',
}

function SessionCard({ session, onClose, onDelete }: { session: Session; onClose: () => void; onDelete: () => void }) {
  const navigate = useNavigate()
  const [closing, setClosing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current) }, [])

  async function handleClose(e: React.MouseEvent) {
    e.stopPropagation()
    setClosing(true)
    const { error } = await supabase
      .from('sessions')
      .update({ status: 'complete' })
      .eq('id', session.id)
    if (error) toast.error(error.message)
    else onClose()
    setClosing(false)
  }

  function handleDeleteClick(e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirmDelete) {
      setConfirmDelete(true)
      deleteTimerRef.current = setTimeout(() => setConfirmDelete(false), 3000)
    } else {
      clearTimeout(deleteTimerRef.current!)
      setConfirmDelete(false)
      handleDelete()
    }
  }

  async function handleDelete() {
    setDeleting(true)
    const { error } = await supabase.from('sessions').delete().eq('id', session.id)
    if (error) toast.error(error.message)
    else onDelete()
    setDeleting(false)
  }

  return (
    <Card
      className="cursor-pointer hover:bg-muted/40 transition-colors"
      onClick={() => navigate(`/session/${session.id}`)}
    >
      <CardContent className="pt-4 pb-4 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="font-semibold truncate">{session.name}</p>
          <p className="text-sm text-muted-foreground">
            {new Date(session.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).replace(/^(\w{3})/, '$1.')}
            {session.time && <span> · {session.time}</span>}
          </p>
          {session.venue && (
            <p className="text-sm text-muted-foreground truncate">{session.venue}</p>
          )}
          <p className={`text-xs font-medium mt-0.5 ${STATUS_COLORS[session.status] ?? 'text-muted-foreground'}`}>
            {STATUS_LABELS[session.status] ?? session.status}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          {session.status === 'in_progress' && (
            <Button variant="destructive" size="sm" disabled={closing} onClick={handleClose}>
              Close
            </Button>
          )}
          <Button
            variant={confirmDelete ? 'destructive' : 'ghost'}
            size="sm"
            disabled={deleting}
            onClick={handleDeleteClick}
          >
            {confirmDelete ? 'Confirm?' : 'Delete'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export function AdminView() {
  const navigate = useNavigate()
  const { sessions, isLoading, refresh } = useSessionList()
  const [showPast, setShowPast] = useState(false)
  const [creating, setCreating] = useState(false)

  async function handleCreateSession() {
    setCreating(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { toast.error('Not authenticated'); setCreating(false); return }

    const today = new Date().toISOString().slice(0, 10)
    const { data, error } = await supabase
      .from('sessions')
      .insert({ name: 'New Session', date: today, created_by: user.id })
      .select('id')
      .single()

    if (error) { toast.error(error.message); setCreating(false); return }
    navigate(`/session/${(data as { id: string }).id}`)
  }

  const activeSessions = sessions.filter((s) => s.status !== 'complete')
  const pastSessions = sessions.filter((s) => s.status === 'complete')

  return (
    <div className="p-6 max-w-lg mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-primary">Admin</h1>
        <Button onClick={handleCreateSession} disabled={creating} size="sm">
          {creating ? 'Creating…' : 'Create Session'}
        </Button>
      </div>

      {/* Active sessions */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Sessions</h2>
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />
          ))
        ) : activeSessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active sessions.</p>
        ) : (
          activeSessions.map((s) => <SessionCard key={s.id} session={s} onClose={refresh} onDelete={refresh} />)
        )}
      </div>

      {/* Past sessions (collapsed by default) */}
      {!isLoading && pastSessions.length > 0 && (
        <div className="space-y-3">
          <button
            onClick={() => setShowPast((p) => !p)}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {showPast ? '▾' : '▸'} Past Sessions ({pastSessions.length})
          </button>
          {showPast && pastSessions.map((s) => (
            <SessionCard key={s.id} session={s} onClose={refresh} onDelete={refresh} />
          ))}
        </div>
      )}
    </div>
  )
}

export default AdminView
