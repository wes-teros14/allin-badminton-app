import { useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import { usePlayerSessions } from '@/hooks/usePlayerSessions'
import type { SessionPickerItem } from '@/hooks/usePlayerSessions'

const ACTIVE_STATUSES = new Set(['in_progress', 'schedule_locked', 'registration_open', 'registration_closed'])

function statusBadge(s: SessionPickerItem) {
  if (s.status === 'in_progress')        return { label: 'Live',                className: 'bg-[#DC595E]/20 text-[#DC595E]' }
  if (s.status === 'registration_open' && !s.isRegistered) {
    const opensLater = s.registration_opens_at && new Date(s.registration_opens_at) > new Date()
    let label = 'Registration Open'
    if (opensLater) {
      const d = new Date(s.registration_opens_at!)
      const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
      const isToday = d.toDateString() === new Date().toDateString()
      label = isToday
        ? `Opens at ${timeStr}`
        : `Opens at ${timeStr} · ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    }
    return { label, className: 'bg-yellow-100 text-yellow-700' }
  }
  if (s.status === 'registration_open' && s.isRegistered)
                                         return { label: 'Registered ✓',         className: 'bg-green-100 text-green-700' }
  if (s.status === 'registration_closed') return { label: 'Registration Closed', className: 'bg-orange-100 text-orange-700' }
  if (s.status === 'schedule_locked')    return { label: 'Schedule Ready',       className: 'bg-orange-100 text-orange-700' }
  return                                       { label: 'Ended',                 className: 'bg-muted text-muted-foreground' }
}

function SessionRow({ s }: { s: SessionPickerItem }) {
  const badge = statusBadge(s)
  const formattedDate = new Date(s.date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  })
  const formattedTime = s.time
    ? new Date(`1970-01-01T${s.time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    : null

  return (
    <Link
      to={`/sessions/${s.id}`}
      className="flex items-center justify-between px-4 py-4 rounded-xl border border-border hover:bg-muted/50 transition-colors"
    >
      <div className="min-w-0">
        <div className="font-semibold truncate">{s.name}</div>
        <div className="text-sm text-muted-foreground mt-0.5">
          {formattedDate}
          {formattedTime && <span> · {formattedTime}</span>}
          {s.duration && <span> · {s.duration} hrs</span>}
          {s.venue && <span> · {s.venue}</span>}
          {s.price != null && <span> · ₱{s.price}</span>}
        </div>
        {s.session_notes && (
          <div className="text-xs text-muted-foreground mt-0.5 truncate">{s.session_notes}</div>
        )}
      </div>
      <span className={`ml-3 shrink-0 text-xs font-semibold px-2 py-1 rounded-full ${badge.className}`}>
        {badge.label}
      </span>
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
      <h1 className="text-xl font-bold mb-6">Sessions</h1>

      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <p className="text-muted-foreground text-sm">You're not registered in any sessions yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {activeSessions.map((s) => <SessionRow key={s.id} s={s} />)}

          {pastSessions.length > 0 && (
            <div className="space-y-3">
              <button
                onClick={() => setShowPast((p) => !p)}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPast ? '▾' : '▸'} Past Sessions ({pastSessions.length})
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
