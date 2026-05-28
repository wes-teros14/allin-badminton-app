import { useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import { usePlayerSessions } from '@/hooks/usePlayerSessions'
import type { SessionPickerItem } from '@/hooks/usePlayerSessions'

const ACTIVE_STATUSES = new Set(['in_progress', 'schedule_locked', 'registration_open', 'registration_closed'])
const SHOW_REGISTERED_PILL_STATUSES = new Set(['in_progress', 'schedule_locked', 'registration_closed'])
const REGISTERED_BADGE_CLASS = 'border-green-500/30 bg-green-500/10 text-green-700'

function statusBadge(s: SessionPickerItem) {
  if (s.status === 'in_progress') {
    return {
      label: 'Live',
      className: 'border-destructive/50 bg-destructive text-white',
      accentClassName: 'bg-destructive',
      isActive: true,
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
      isActive: true,
    }
  }

  if (s.status === 'registration_open' && s.isRegistered) {
    return {
      label: 'Registered',
      className: REGISTERED_BADGE_CLASS,
      accentClassName: 'bg-green-500',
      isActive: true,
    }
  }

  if (s.status === 'registration_closed') {
    return {
      label: 'Registration Closed',
      className: 'border-border bg-secondary text-muted-foreground',
      accentClassName: 'bg-muted-foreground/50',
      isActive: true,
    }
  }

  if (s.status === 'schedule_locked') {
    return {
      label: 'Schedule Ready',
      className: 'border-[#FFB200]/40 bg-[#FFB200]/10 text-[#FFB200]',
      accentClassName: 'bg-[#FFB200]',
      isActive: true,
    }
  }

  return {
    label: 'Ended',
    className: 'border-border bg-secondary/60 text-muted-foreground',
    accentClassName: 'bg-border',
    isActive: false,
  }
}

function SessionRow({ s, index }: { s: SessionPickerItem; index: number }) {
  const badge = statusBadge(s)
  const isActive = ACTIVE_STATUSES.has(s.status)
  const showRegisteredPill = s.isRegistered && SHOW_REGISTERED_PILL_STATUSES.has(s.status)
  const formattedDate = new Date(s.date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  const formattedTime = s.time
    ? new Date(`1970-01-01T${s.time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    : null

  const metaLine = [
    formattedTime,
    s.duration ? `${s.duration} hrs` : null,
    s.price != null ? `PHP ${s.price}` : null,
    s.venue || null,
  ].filter(Boolean).join(' · ')

  return (
    <Link
      to={`/sessions/${s.id}`}
      style={{ animationDelay: `${index * 60}ms` }}
      className={`animate-card-fade-up group relative flex w-full flex-col overflow-hidden rounded-2xl border pl-5 pr-4 py-4 shadow-sm transition-all hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        isActive
          ? 'border-primary/30 bg-card hover:border-primary/50 hover:shadow-[0_8px_24px_-4px_rgba(111,62,135,0.15)]'
          : 'border-border bg-card hover:border-border hover:shadow-md'
      }`}
    >
      <div className={`absolute inset-y-0 left-0 w-1 ${badge.accentClassName}`} />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <p className="text-base font-semibold leading-tight text-foreground transition-colors group-hover:text-primary">
            {s.name}
          </p>
          <p className="text-sm font-normal text-muted-foreground">
            {formattedDate}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${badge.className}`}>
            {badge.label}
          </span>
          {showRegisteredPill && (
            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${REGISTERED_BADGE_CLASS}`}>
              Registered
            </span>
          )}
        </div>
      </div>

      {metaLine && (
        <p className="mt-2 text-xs text-muted-foreground">
          {metaLine}
        </p>
      )}

      {s.session_notes && (
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
          {s.session_notes}
        </p>
      )}
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
          {activeSessions.map((s, i) => <SessionRow key={s.id} s={s} index={i} />)}

          {pastSessions.length > 0 && (
            <div className="space-y-3 pt-2">
              <button
                onClick={() => setShowPast((p) => !p)}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {showPast ? 'Hide' : 'Show'} Past Sessions ({pastSessions.length})
              </button>
              {showPast && pastSessions.map((s, i) => <SessionRow key={s.id} s={s} index={activeSessions.length + i} />)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default MySessionsView
