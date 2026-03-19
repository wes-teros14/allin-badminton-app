import { useRef, useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'
import { useSessionList } from '@/hooks/useSessionList'
import type { Session } from '@/hooks/useSession'

const sessionSchema = z.object({
  name: z.string().min(1, 'Session name is required'),
  date: z.string().min(1, 'Date is required'),
})

type SessionFormValues = z.infer<typeof sessionSchema>

const STATUS_LABELS: Record<string, string> = {
  setup: 'Setup',
  registration_open: 'Registration Open',
  registration_closed: 'Registration Closed',
  schedule_locked: 'Schedule Locked',
  in_progress: 'In Progress',
  complete: 'Complete',
}

const STATUS_COLORS: Record<string, string> = {
  setup: 'text-muted-foreground',
  registration_open: 'text-blue-500',
  registration_closed: 'text-yellow-500',
  schedule_locked: 'text-orange-500',
  in_progress: 'text-primary',
  complete: 'text-muted-foreground',
}

function SessionCard({ session, onClose }: { session: Session; onClose: () => void }) {
  const navigate = useNavigate()
  const [closing, setClosing] = useState(false)

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

  return (
    <Card
      className="cursor-pointer hover:bg-muted/40 transition-colors"
      onClick={() => navigate(`/session/${session.id}`)}
    >
      <CardContent className="pt-4 pb-4 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="font-semibold truncate">{session.name}</p>
          <p className="text-sm text-muted-foreground">{session.date}</p>
          <p className={`text-xs font-medium mt-0.5 ${STATUS_COLORS[session.status] ?? 'text-muted-foreground'}`}>
            {STATUS_LABELS[session.status] ?? session.status}
          </p>
        </div>
        {session.status === 'in_progress' && (
          <Button
            variant="destructive"
            size="sm"
            disabled={closing}
            onClick={handleClose}
          >
            Close
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

export function AdminView() {
  const { sessions, isLoading, refresh } = useSessionList()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SessionFormValues>({ resolver: zodResolver(sessionSchema) })

  async function onSubmit(values: SessionFormValues) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { toast.error('Not authenticated'); return }

    const { error } = await supabase
      .from('sessions')
      .insert({ name: values.name, date: values.date, created_by: user.id })

    if (error) { toast.error(error.message); return }

    reset()
    refresh()
  }

  return (
    <div className="p-6 max-w-lg mx-auto space-y-6">
      {/* Create new session */}
      <Card>
        <CardHeader>
          <CardTitle>New Session</CardTitle>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

      {/* Session list */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Sessions</h2>
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />
          ))
        ) : sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sessions yet.</p>
        ) : (
          sessions.map((s) => <SessionCard key={s.id} session={s} onClose={refresh} />)
        )}
      </div>
    </div>
  )
}

export default AdminView
