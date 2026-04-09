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

function SetupCard({
  sessionId, initialName, initialDate, initialVenue, initialTime, initialDuration,
  initialPrice, initialSessionNotes, initialRegistrationOpensAt, onConfirm,
}: {
  sessionId: string
  initialName: string
  initialDate: string
  initialVenue: string | null
  initialTime: string | null
  initialDuration: string | null
  initialPrice: number | null
  initialSessionNotes: string | null
  initialRegistrationOpensAt: string | null
  onConfirm: () => void
}) {
  const [name, setName] = useState(initialName)
  const [date, setDate] = useState(initialDate)
  const [venue, setVenue] = useState(initialVenue ?? '')
  const [time, setTime] = useState(initialTime ?? '')
  const [duration, setDuration] = useState(initialDuration ?? '')
  const [price, setPrice] = useState(initialPrice != null ? String(initialPrice) : '')
  const [sessionNotes, setSessionNotes] = useState(initialSessionNotes ?? '')
  const [scheduleOpen, setScheduleOpen] = useState(initialRegistrationOpensAt != null)
  const [scheduledDate, setScheduledDate] = useState<string>(
    initialRegistrationOpensAt ? new Date(initialRegistrationOpensAt).toLocaleDateString('en-CA') : ''
  )
  const [scheduledHour, setScheduledHour] = useState<string>(
    initialRegistrationOpensAt ? String(new Date(initialRegistrationOpensAt).getHours()) : ''
  )
  const [saving, setSaving] = useState(false)

  useEffect(() => { setName(initialName) }, [initialName])
  useEffect(() => { setDate(initialDate) }, [initialDate])
  useEffect(() => { setVenue(initialVenue ?? '') }, [initialVenue])
  useEffect(() => { setTime(initialTime ?? '') }, [initialTime])
  useEffect(() => { setDuration(initialDuration ?? '') }, [initialDuration])
  useEffect(() => { setPrice(initialPrice != null ? String(initialPrice) : '') }, [initialPrice])
  useEffect(() => { setSessionNotes(initialSessionNotes ?? '') }, [initialSessionNotes])
  useEffect(() => {
    setScheduleOpen(initialRegistrationOpensAt != null)
    setScheduledDate(initialRegistrationOpensAt ? new Date(initialRegistrationOpensAt).toLocaleDateString('en-CA') : '')
    setScheduledHour(initialRegistrationOpensAt ? String(new Date(initialRegistrationOpensAt).getHours()) : '')
  }, [initialRegistrationOpensAt])

  async function handleConfirm() {
    if (!name.trim() || !date) { toast.error('Session name and date are required'); return }
    if (scheduleOpen && (!scheduledDate || scheduledHour === '')) { toast.error('Select a date and time for scheduled registration open'); return }
    setSaving(true)

    const registrationOpensAt = scheduleOpen && scheduledDate && scheduledHour !== ''
      ? new Date(`${scheduledDate}T${scheduledHour.padStart(2, '0')}:00:00`).toISOString()
      : null

    const { error } = await supabase
      .from('sessions')
      .update({
        name: name.trim(),
        date,
        venue: venue || null,
        time: time || null,
        duration: duration || null,
        price: price !== '' ? Number(price) : null,
        session_notes: sessionNotes || null,
        registration_opens_at: registrationOpensAt,
      })
      .eq('id', sessionId)
    if (error) { toast.error(error.message); setSaving(false); return }
    onConfirm()
  }

  const HOURS = Array.from({ length: 24 }, (_, i) => ({
    value: String(i),
    label: new Date(2000, 0, 1, i).toLocaleTimeString('en-US', { hour: 'numeric', hour12: true }),
  }))

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <div className="space-y-1">
          <Label htmlFor="setup-name">Session name</Label>
          <Input id="setup-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="setup-date">Date</Label>
          <Input id="setup-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="setup-venue">Venue</Label>
          <Input id="setup-venue" placeholder="e.g. Sports Hall A" value={venue} onChange={(e) => setVenue(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <div className="flex-1 space-y-1">
            <Label htmlFor="setup-time">Time</Label>
            <Input id="setup-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
          <div className="flex-1 space-y-1">
            <Label htmlFor="setup-duration">Duration (hrs)</Label>
            <Input id="setup-duration" type="number" min="1" placeholder="e.g. 2" value={duration} onChange={(e) => setDuration(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="setup-price">Price (₱)</Label>
          <Input id="setup-price" type="number" min="0" placeholder="e.g. 150" value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="setup-notes">Notes</Label>
          <textarea
            id="setup-notes"
            placeholder="e.g. Bring your own shuttle"
            value={sessionNotes}
            onChange={(e) => setSessionNotes(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="schedule-open"
              checked={scheduleOpen}
              onChange={(e) => { setScheduleOpen(e.target.checked); if (!e.target.checked) { setScheduledDate(''); setScheduledHour('') } }}
              className="h-4 w-4 rounded border-input accent-primary"
            />
            <Label htmlFor="schedule-open" className="cursor-pointer">Schedule registration open</Label>
          </div>
          {scheduleOpen && (
            <div className="flex gap-2">
              <Input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="flex-1"
              />
              <select
                value={scheduledHour}
                onChange={(e) => setScheduledHour(e.target.value)}
                className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Hour</option>
                {HOURS.map(h => (
                  <option key={h.value} value={h.value}>{h.label}</option>
                ))}
              </select>
            </div>
          )}
          {scheduleOpen && scheduledDate && scheduledHour !== '' && (
            <p className="text-xs text-muted-foreground">
              Registration will auto-open at {HOURS[Number(scheduledHour)]?.label} on {new Date(scheduledDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </p>
          )}
        </div>
        <Button onClick={handleConfirm} disabled={saving} className="w-full">
          {saving ? 'Saving…' : 'Confirm'}
        </Button>
      </CardContent>
    </Card>
  )
}

export function SessionView() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const {
    session, invitation, playerCount, isLoading,
    openRegistration, closeRegistration, reopenRegistration, lockSchedule, unlockSchedule, startSession, unstartSession,
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
            <p>{new Date(session.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).replace(/^(\w{3})/, '$1.')}</p>
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
        <Button variant="outline" onClick={unstartSession} className="w-full text-muted-foreground">
          ← Back to Schedule
        </Button>
      </div>
    )
  }

  // Setup / registration / match generation states
  return (
    <div className="p-6 max-w-lg mx-auto space-y-6">
      <div className="flex items-center justify-between">
        {session.status === 'setup' ? (
          <div />
        ) : (
          <div>
            <h1 className="text-lg font-semibold text-primary">{session.name}</h1>
            <p className="text-sm text-muted-foreground">
              {new Date(session.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).replace(/^(\w{3})/, '$1.')}
            </p>
          </div>
        )}
        <BackToAdmin />
      </div>

      <SessionStepper status={session.status} />

      {session.status === 'setup' && (
        <SetupCard
          sessionId={session.id}
          initialName={session.name}
          initialDate={session.date}
          initialVenue={session.venue ?? null}
          initialTime={session.time ?? null}
          initialDuration={session.duration ?? null}
          initialPrice={session.price ?? null}
          initialSessionNotes={session.session_notes ?? null}
          initialRegistrationOpensAt={session.registration_opens_at ?? null}
          onConfirm={openRegistration}
        />
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
          <RosterPanel sessionId={session.id} paymentOnly />
          <MatchGeneratorPanel sessionId={session.id} sessionStatus={session.status} onLock={lockSchedule} />
          <Button variant="outline" onClick={reopenRegistration} className="w-full">Reopen Registration</Button>
        </div>
      )}

      {session.status === 'schedule_locked' && (
        <div className="space-y-4">
          <RosterPanel sessionId={session.id} paymentOnly />
          <MatchGeneratorPanel sessionId={session.id} sessionStatus={session.status} />
          <Button onClick={startSession} className="w-full">Start Session</Button>
          <Button variant="outline" onClick={() => window.open(`/live-board/${session.id}`, '_blank')} className="w-full">Open LiveBoard ↗</Button>
          <Button variant="outline" onClick={unlockSchedule} className="w-full">Unlock Schedule</Button>
        </div>
      )}

    </div>
  )
}

export default SessionView
