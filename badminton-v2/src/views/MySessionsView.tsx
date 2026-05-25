import { useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import { usePlayerSessions } from '@/hooks/usePlayerSessions'
import type { SessionPickerItem } from '@/hooks/usePlayerSessions'

const ACTIVE_STATUSES = new Set(['in_progress', 'schedule_locked', 'registration_open', 'registration_closed'])

function statusBadge(s: SessionPickerItem) {
  if (s.status === 'in_progress') {
    return {
      label: 'Live',
      className: 'border-destructive bg-destructive text-white',
      accentClassName: 'bg-destructive',
    }
  }

  if (s.status === 'registration_open' && !s.isRegistered) {
    const opensLater = s.registration_opens_at && new Date(s.registration_opens_at) > new Date()
    let label = 'Registration Open'

    if (opensLater) {
      const d = new Date(s.registration_opens_at!)
      const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
      const isToday = d.toDateString() === new Date().toDateString()
      label = isToday
        ? `Opens at ${timeStr}`
        : `Opens at ${timeStr} on ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    }

    return {
      label,
      className: 'border-primary bg-primary text-primary-foreground',
      accentClassName: 'bg-primary',
    }
  }

  if (s.status === 'registration_open' && s.isRegistered) {
    return {
      label: 'Registered',
      className: 'border-primary/25 bg-primary/10 text-primary',
      accentClassName: 'bg-primary',
    }
  }

  if (s.status === 'registration_closed') {
    return {
      label: 'Registration Closed',
      className: 'border-border bg-secondary text-foreground',
      accentClassName: 'bg-foreground/60',
    }
  }

  if (s.status === 'schedule_locked') {
    return {
      label: 'Schedule Ready',
      className: 'border-border bg-secondary text-foreground',
      accentClassName: 'bg-primary',
    }
  }

  return {
    label: 'Ended',
    className: 'border-border bg-secondary text-muted-foreground',
    accentClassName: 'bg-muted-foreground',
  }
}

function SessionRow({ s }: { s: SessionPickerItem }) {
  const badge = statusBadge(s)
  const formattedDate = new Date(s.date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  const formattedTime = s.time
    ? new Date(`1970-01-01T${s.time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    : null

  const details = [
    formattedTime,
    s.venue || null,
    s.duration ? `${s.duration} hrs` : null,
    s.price != null ? `PHP ${s.price}` : null,
  ].filter(Boolean) as string[]

  return (
    <Link
      to={`/sessions/${s.id}`}
      className="group relative overflow-hidden rounded-2xl border border-border bg-card px-4 py-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className={`absolute inset-x-0 top-0 h-1 ${badge.accentClassName}`} />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-base font-semibold leading-tight text-foreground transition-colors group-hover:text-primary">
            {s.name}
          </p>
          <p className="text-sm font-medium text-foreground">{formattedDate}</p>
        </div>

        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${badge.className}`}>
          {badge.label}
        </span>
      </div>

      {details.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {details.map((detail) => (
            <span
              key={detail}
              className="inline-flex items-center rounded-full border border-border bg-secondary px-2.5 py-1 text-[11px] font-medium text-foreground"
            >
              {detail}
            </span>
          ))}
        </div>
      )}

      {s.session_notes && (
        <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
          {s.session_notes}
        </p>
      )}

      <div className="mt-4 flex items-center justify-between text-xs font-medium">
        <span className="text-foreground/80">
          {s.isRegistered ? 'View session details' : 'Open session'}
        </span>
        <span className="text-primary transition-transform group-hover:translate-x-0.5">View</span>
      </div>
    </Link>
  )
}

export function MySessionsView() {
  const { user, isLoading: authLoading } = useAuth()
  const { sessions, isLoading } = usePlayerSessions(user?.id ?? null)
  const [showPast, setShowPast] = useState(false)

  const loading = authLoading || isLoading

  const activeSessions = sessions
    .filter((s) => ACTIVE_STATUSES.has(s.status))
    .sort((a, b) => b.date.localeCompare(a.date))

  const pastSessions = sessions
    .filter((s) => !ACTIVE_STATUSES.has(s.status))
    .sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div className="max-w-sm mx-auto px-4 py-8">
      <div className="mb-6 space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Sessions</h1>
        <p className="text-sm text-muted-foreground">Upcoming, live, and past badminton sessions.</p>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-36 rounded-2xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <p className="text-sm text-muted-foreground">You're not registered in any sessions yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {activeSessions.map((s) => <SessionRow key={s.id} s={s} />)}

          {pastSessions.length > 0 && (
            <div className="space-y-3 pt-2">
              <button
                onClick={() => setShowPast((p) => !p)}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {showPast ? 'Hide' : 'Show'} Past Sessions ({pastSessions.length})
              </button>
              {showPast && pastSessions.map((s) => <SessionRow key={s.id} s={s} />)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default MySessionsView
