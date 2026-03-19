import { useRef, useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useSession } from '@/hooks/useSession'
import { RegistrationURLCard } from '@/components/RegistrationURLCard'
import { RosterPanel } from '@/components/RosterPanel'
import { MatchGeneratorPanel } from '@/components/MatchGeneratorPanel'

const sessionSchema = z.object({
  name: z.string().min(1, 'Session name is required'),
  date: z.string().min(1, 'Date is required'),
})

type SessionFormValues = z.infer<typeof sessionSchema>

export function AdminView() {
  const { session, invitation, playerCount, isLoading, createSession, openRegistration, closeRegistration, lockSchedule, startSession } =
    useSession()

  const [confirmingClose, setConfirmingClose] = useState(false)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    }
  }, [])

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

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SessionFormValues>({
    resolver: zodResolver(sessionSchema),
  })

  async function onSubmit(values: SessionFormValues) {
    const result = await createSession(values.name, values.date)
    if (result) reset()
  }

  if (isLoading) return <div>Loading…</div>

  return (
    <div className="p-6 max-w-lg mx-auto space-y-6">
      {!session ? (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="name">Session name</Label>
            <Input id="name" placeholder="e.g. Friday Night Badminton" {...register('name')} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="date">Date</Label>
            <Input id="date" type="date" {...register('date')} />
            {errors.date && <p className="text-sm text-destructive">{errors.date.message}</p>}
          </div>
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? 'Creating…' : 'Create Session'}
          </Button>
        </form>
      ) : session.status === 'setup' ? (
        <Card>
          <CardHeader>
            <CardTitle>{session.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>Date: {session.date}</p>
            <p>Status: <span className="font-medium">{session.status}</span></p>
            <Button onClick={openRegistration} className="w-full">
              Open Registration
            </Button>
          </CardContent>
        </Card>
      ) : session.status === 'registration_open' && invitation ? (
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
      ) : session.status === 'registration_closed' ? (
        <MatchGeneratorPanel sessionId={session.id} sessionStatus={session.status} onLock={lockSchedule} />
      ) : session.status === 'schedule_locked' ? (
        <div className="space-y-4">
          <MatchGeneratorPanel sessionId={session.id} sessionStatus={session.status} />
          <Button onClick={startSession} className="w-full">
            Start Session
          </Button>
        </div>
      ) : session.status === 'in_progress' ? (
        <Card>
          <CardHeader>
            <CardTitle>{session.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>Date: {session.date}</p>
            <p>Status: <span className="font-medium">In Progress</span></p>
            <a
              href={`/session/${session.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full"
            >
              <Button className="w-full">Open Session View ↗</Button>
            </a>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{session.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>Date: {session.date}</p>
            <p>Status: <span className="font-medium">{session.status}</span></p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default AdminView
