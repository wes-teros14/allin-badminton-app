import { useRef, useState, useEffect } from 'react'
import { useParams, Link } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import { useSession } from '@/hooks/useSession'
import { useAdminSession } from '@/hooks/useAdminSession'
import { useRealtime } from '@/hooks/useRealtime'
import { RegistrationURLCard } from '@/components/RegistrationURLCard'
import { RosterPanel } from '@/components/RosterPanel'
import { MatchGeneratorPanel } from '@/components/MatchGeneratorPanel'
import { CourtTabs } from '@/components/CourtTabs'
import { LiveIndicator } from '@/components/LiveIndicator'

const STATUS_STEP: Record<string, number> = {
  setup: 0, registration_open: 1, registration_closed: 2,
  schedule_locked: 3, in_progress: 4, complete: 5,
}

function SessionStepper({ status }: { status: string }) {
  const steps = ['Setup', 'Reg Open', 'Reg Closed', 'Locked', 'Live', 'Done']
  const current = STATUS_STEP[status] ?? 0
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1">
      {steps.map((label, i) => (
        <div key={i} className="flex items-center gap-1 shrink-0">
          <div className="flex flex-col items-center gap-1">
            <div className={`w-4 h-4 rounded-full ${i <= current ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
            <span className={`text-xs ${i === current ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>{label}</span>
          </div>
          {i < steps.length - 1 && (
            <div className={`w-8 h-0.5 mb-5 ${i < current ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

function BackToAdmin() {
  return (
    <Link to="/admin" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
      ← Admin
    </Link>
  )
}

function LiveSessionView({ sessionId }: { sessionId: string }) {
  const { court1Current, court2Current, queued, sessionId: sid, sessionName, sessionDate, isLoading, refresh } =
    useAdminSession(sessionId)
  const { status } = useRealtime(sid, refresh, 'session')

  return (
    <div className="space-y-4 relative">
      <LiveIndicator status={status} onRefresh={refresh} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{sessionName || 'Session'}</h1>
          {sessionDate && (
            <p className="text-sm text-muted-foreground">
              {new Date(sessionDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).replace(/^(\w{3})/, '$1.')}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.open(`/match-schedule/session/${sessionId}`, '_blank')}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Match Schedule ↗
          </button>
          <button
            onClick={() => window.open(`/live-board/${sessionId}`, '_blank')}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Open LiveBoard ↗
          </button>
          <BackToAdmin />
        </div>
      </div>
      <CourtTabs
        court1Current={court1Current}
        court2Current={court2Current}
        queued={queued}
        isLoading={isLoading}
        sessionId={sid}
        onDone={refresh}
      />
    </div>
  )
}

function SetupCard({ sessionId, initialDate, onOpenRegistration }: { sessionId: string; initialDate: string; onOpenRegistration: () => void }) {
  const [date, setDate] = useState(initialDate)
  const [saving, setSaving] = useState(false)

  async function handleSaveDate() {
    if (!date) return
    setSaving(true)
    const { error } = await supabase.from('sessions').update({ date }).eq('id', sessionId)
    if (error) toast.error(error.message)
    else toast.success('Date updated')
    setSaving(false)
  }

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <div className="space-y-1">
          <Label htmlFor="setup-date">Date</Label>
          <div className="flex gap-2">
            <Input
              id="setup-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="flex-1"
            />
            <Button variant="outline" size="sm" disabled={saving || date === initialDate} onClick={handleSaveDate}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
        <Button onClick={onOpenRegistration} className="w-full">Open Registration</Button>
      </CardContent>
    </Card>
  )
}

export function SessionView() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const {
    session, invitation, playerCount, isLoading,
    openRegistration, closeRegistration, reopenRegistration, lockSchedule, unlockSchedule, startSession,
  } = useSession(sessionId)

  const [confirmingClose, setConfirmingClose] = useState(false)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (closeTimerRef.current) clearTimeout(closeTimerRef.current) }, [])

  function handleCloseRegistration() {
    if (!confirmingClose) {
      setConfirmingClose(true)
      closeTimerRef.current = setTimeout(() => setConfirmingClose(false), 5000)
    } else {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
      setConfirmingClose(false)
      closeRegistration()
    }
  }

  if (isLoading) return <div className="p-6">Loading…</div>

  if (!session) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-3">
        <p className="text-muted-foreground text-lg">Session not found</p>
        <BackToAdmin />
      </div>
    )
  }

  if (session.status === 'complete') {
    return (
      <div className="p-6 max-w-lg mx-auto space-y-4">
        <BackToAdmin />
        <SessionStepper status={session.status} />
        <Card>
          <CardHeader><CardTitle>{session.name}</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            <p>Date: {session.date}</p>
            <p className="text-muted-foreground">This session has been closed.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (session.status === 'in_progress') {
    return (
      <div className="p-4 max-w-lg mx-auto space-y-4">
        <SessionStepper status={session.status} />
        <LiveSessionView sessionId={session.id} />
      </div>
    )
  }

  // Setup / registration / match generation states
  return (
    <div className="p-6 max-w-lg mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-primary">{session.name}</h1>
          <p className="text-sm text-muted-foreground">
            {new Date(session.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).replace(/^(\w{3})/, '$1.')}
          </p>
        </div>
        <BackToAdmin />
      </div>

      <SessionStepper status={session.status} />

      {session.status === 'setup' && (
        <SetupCard sessionId={session.id} initialDate={session.date} onOpenRegistration={openRegistration} />
      )}

      {session.status === 'registration_open' && invitation && (
        <div className="space-y-4">
          <RegistrationURLCard invitation={invitation} playerCount={playerCount} />
          <RosterPanel sessionId={session.id} />
          <Button
            variant={confirmingClose ? 'destructive' : 'outline'}
            onClick={handleCloseRegistration}
            className="w-full"
          >
            {confirmingClose ? 'Confirm Close?' : 'Close Registration'}
          </Button>
        </div>
      )}

      {session.status === 'registration_closed' && (
        <div className="space-y-4">
          <RosterPanel sessionId={session.id} editable />
          <MatchGeneratorPanel sessionId={session.id} sessionStatus={session.status} onLock={lockSchedule} />
          <Button variant="outline" onClick={reopenRegistration} className="w-full">Reopen Registration</Button>
        </div>
      )}

      {session.status === 'schedule_locked' && (
        <div className="space-y-4">
          <MatchGeneratorPanel sessionId={session.id} sessionStatus={session.status} />
          <Button onClick={startSession} className="w-full">Start Session</Button>
          <Button variant="outline" onClick={() => window.open(`/live-board/${session.id}`, '_blank')} className="w-full">Open LiveBoard ↗</Button>
          <Button variant="outline" onClick={() => window.open(`/match-schedule/session/${session.id}`, '_blank')} className="w-full">Share Match Schedule ↗</Button>
          <Button variant="outline" onClick={unlockSchedule} className="w-full">Unlock Schedule</Button>
        </div>
      )}

    </div>
  )
}

export default SessionView
