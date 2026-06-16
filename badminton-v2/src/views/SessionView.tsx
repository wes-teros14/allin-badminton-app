import { useRef, useState, useEffect, type ReactNode } from 'react'
import { useParams, Link } from 'react-router'
import { Calendar, Clock, FileText, MapPin, Timer } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import { useSession } from '@/hooks/useSession'
import { useAdminSession } from '@/hooks/useAdminSession'
import { useRealtime } from '@/hooks/useRealtime'
import { useAuth } from '@/hooks/useAuth'
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
      Back to Admin
    </Link>
  )
}

function formatSessionDate(date: string) {
  return new Date(date + 'T00:00:00')
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    .replace(/^(\w{3})/, '$1.')
}

function formatSessionTime(time: string | null) {
  return time
    ? new Date(`1970-01-01T${time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    : null
}

function DetailItem({
  icon: Icon,
  iconClassName,
  children,
}: {
  icon: typeof Calendar
  iconClassName: string
  children: ReactNode
}) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <Icon className={`h-4 w-4 shrink-0 ${iconClassName}`} aria-hidden="true" />
      <span className="truncate">{children}</span>
    </span>
  )
}

function SessionSummary({
  name,
  date,
  time,
  duration,
  price,
  venue,
  notes,
}: {
  name: string
  date: string
  time: string | null
  duration: string | null
  price: number | null
  venue: string | null
  notes: string | null
}) {
  const formattedTime = formatSessionTime(time)

  return (
    <div className="min-w-0">
      <h1 className="text-lg font-semibold text-primary">{name}</h1>
      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
        <DetailItem icon={Calendar} iconClassName="text-[#D91656]">{formatSessionDate(date)}</DetailItem>
        {formattedTime && <DetailItem icon={Clock} iconClassName="text-[#D91656]">{formattedTime}</DetailItem>}
        {duration && <DetailItem icon={Timer} iconClassName="text-[#D91656]">{duration} hrs</DetailItem>}
        {price != null && <span>PHP {price}</span>}
      </p>
      {venue && (
        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4 shrink-0 text-[#D91656]" aria-hidden="true" />
          <span className="truncate">{venue}</span>
        </p>
      )}
      {notes && (
        <p className="mt-1 flex items-start gap-1.5 text-sm text-muted-foreground">
          <FileText className="mt-0.5 h-4 w-4 shrink-0 text-[#D91656]" aria-hidden="true" />
          <span>{notes}</span>
        </p>
      )}
    </div>
  )
}

function LiveSessionView({ sessionId, splitScoring }: { sessionId: string; splitScoring: boolean }) {
  const { courts, queued, sessionId: sid, sessionName, sessionDate, isLoading, refresh } =
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
            Match Schedule
          </button>
          <button
            onClick={() => window.open(`/live-board/${sessionId}`, '_blank')}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Open LiveBoard
          </button>
          <BackToAdmin />
        </div>
      </div>
      <CourtTabs
        courts={courts}
        queued={queued}
        isLoading={isLoading}
        sessionId={sid}
        onDone={refresh}
        splitScoring={splitScoring}
      />
    </div>
  )
}

function SetupCard({
  sessionId, initialName, initialDate, initialVenue, initialTime, initialDuration,
  initialPrice, initialSessionNotes, initialRegistrationOpensAt, initialCourtCount, onConfirm,
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
  initialCourtCount: number
  onConfirm: () => void
}) {
  const [name, setName] = useState(initialName)
  const [date, setDate] = useState(initialDate)
  const [venue, setVenue] = useState(initialVenue ?? '')
  const [time, setTime] = useState(initialTime ?? '')
  const [duration, setDuration] = useState(initialDuration ?? '')
  const [price, setPrice] = useState(initialPrice != null ? String(initialPrice) : '')
  const [courtCount, setCourtCount] = useState(String(initialCourtCount))
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
  useEffect(() => { setCourtCount(String(initialCourtCount)) }, [initialCourtCount])
  useEffect(() => { setSessionNotes(initialSessionNotes ?? '') }, [initialSessionNotes])
  useEffect(() => {
    setScheduleOpen(initialRegistrationOpensAt != null)
    setScheduledDate(initialRegistrationOpensAt ? new Date(initialRegistrationOpensAt).toLocaleDateString('en-CA') : '')
    setScheduledHour(initialRegistrationOpensAt ? String(new Date(initialRegistrationOpensAt).getHours()) : '')
  }, [initialRegistrationOpensAt])

  async function handleConfirm() {
    if (!name.trim() || !date) { toast.error('Session name and date are required'); return }
    if (scheduleOpen && (!scheduledDate || scheduledHour === '')) { toast.error('Select a date and time for scheduled registration open'); return }

    const parsedCourtCount = Number(courtCount)
    if (!Number.isInteger(parsedCourtCount) || parsedCourtCount < 1) {
      toast.error('Court count must be a whole number of at least 1')
      return
    }

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
        court_count: parsedCourtCount,
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
          <Label htmlFor="setup-price">Price (PHP)</Label>
          <Input id="setup-price" type="number" min="0" placeholder="e.g. 150" value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="setup-court-count">Court count</Label>
          <Input id="setup-court-count" type="number" min="1" step="1" placeholder="e.g. 3" value={courtCount} onChange={(e) => setCourtCount(e.target.value)} />
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
          {saving ? 'Saving...' : 'Confirm'}
        </Button>
      </CardContent>
    </Card>
  )
}

export function SessionView() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const { role } = useAuth()
  const isModerator = role === 'moderator'
  const {
    session, invitation, playerCount, isLoading,
    openRegistration, closeRegistration, reopenRegistration, lockSchedule, unlockSchedule, startSession, unstartSession,
  } = useSession(sessionId)

  const [confirmingClose, setConfirmingClose] = useState(false)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [splitScoring, setSplitScoring] = useState(session?.split_match_scoring ?? false)
  const [splitSaving, setSplitSaving] = useState(false)

  useEffect(() => {
    setSplitScoring(session?.split_match_scoring ?? false)
  }, [session?.split_match_scoring])

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

  async function handleSplitScoringChange() {
    if (!session) return
    const newValue = !splitScoring
    setSplitScoring(newValue)
    setSplitSaving(true)
    const { error } = await supabase
      .from('sessions')
      .update({ split_match_scoring: newValue })
      .eq('id', session.id)
    setSplitSaving(false)
    if (error) {
      toast.error(error.message)
      setSplitScoring(!newValue)
    } else {
      toast.success(newValue ? 'Split scoring enabled' : 'Split scoring disabled')
    }
  }

  if (isLoading) return <div className="p-6">Loading...</div>

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
            <p>{formatSessionDate(session.date)}</p>
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
        <LiveSessionView sessionId={session.id} splitScoring={session.split_match_scoring ?? false} />
        {!isModerator && (
          <Button variant="outline" onClick={unstartSession} className="w-full text-muted-foreground">
            Back to Schedule
          </Button>
        )}
      </div>
    )
  }

  if (isModerator) {
    return (
      <div className="p-6 max-w-lg mx-auto space-y-4">
        <BackToAdmin />
        <SessionStepper status={session.status} />
        <Card>
          <CardContent className="pt-4 space-y-1">
            <SessionSummary
              name={session.name}
              date={session.date}
              time={session.time}
              duration={session.duration}
              price={session.price}
              venue={session.venue}
              notes={session.session_notes}
            />
            <p className="text-sm text-muted-foreground pt-2">Actions are available once the session is Live.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-lg mx-auto space-y-6">
      <div className="flex items-center justify-between">
        {session.status === 'setup' ? (
          <div />
        ) : (
          <SessionSummary
            name={session.name}
            date={session.date}
            time={session.time}
            duration={session.duration}
            price={session.price}
            venue={session.venue}
            notes={session.session_notes}
          />
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
          initialCourtCount={session.court_count ?? 2}
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
          <MatchGeneratorPanel sessionId={session.id} sessionStatus={session.status} onLock={lockSchedule} />
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="split-scoring"
              checked={splitScoring}
              onChange={handleSplitScoringChange}
              disabled={splitSaving}
              className="h-4 w-4 rounded border-input accent-primary disabled:opacity-50"
            />
            <Label htmlFor="split-scoring" className="cursor-pointer">
              Split match scoring
            </Label>
          </div>
          <Button variant="outline" onClick={reopenRegistration} className="w-full">Reopen Registration</Button>
        </div>
      )}

      {session.status === 'schedule_locked' && (
        <div className="space-y-4">
          <MatchGeneratorPanel sessionId={session.id} sessionStatus={session.status} />
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="split-scoring"
              checked={splitScoring}
              onChange={handleSplitScoringChange}
              disabled={splitSaving}
              className="h-4 w-4 rounded border-input accent-primary disabled:opacity-50"
            />
            <Label htmlFor="split-scoring" className="cursor-pointer">
              Split match scoring
            </Label>
          </div>
          <Button onClick={startSession} className="w-full">Start Session</Button>
          <Button variant="outline" onClick={() => window.open(`/live-board/${session.id}`, '_blank')} className="w-full">Open LiveBoard</Button>
          <Button variant="outline" onClick={unlockSchedule} className="w-full">Unlock Schedule</Button>
        </div>
      )}
    </div>
  )
}

export default SessionView
