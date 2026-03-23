import { Link } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import { usePlayerSessions } from '@/hooks/usePlayerSessions'
import type { SessionPickerItem } from '@/hooks/usePlayerSessions'

const ACTIVE_STATUSES = new Set(['in_progress', 'schedule_locked', 'registration_open'])

function isCheerWindowOpen(s: SessionPickerItem): boolean {
  if (s.status !== 'complete' || !s.completed_at) return false
  return Date.now() < new Date(s.completed_at).getTime() + 24 * 60 * 60 * 1000
}

function hasPendingCheers(s: SessionPickerItem): boolean {
  return isCheerWindowOpen(s) && !s.cheersAllGiven
}

function cheerTimeLeft(s: SessionPickerItem): string {
  if (!s.completed_at) return ''
  const msLeft = new Date(s.completed_at).getTime() + 24 * 60 * 60 * 1000 - Date.now()
  const h = Math.floor(msLeft / (60 * 60 * 1000))
  const m = Math.floor((msLeft % (60 * 60 * 1000)) / 60000)
  if (h > 0) return `${h}h left`
  if (m > 0) return `${m}m left`
  return '<1m left'
}

function statusBadge(s: SessionPickerItem) {
  if (s.status === 'in_progress')       return { label: 'Live',              className: 'bg-[#DC595E]/20 text-[#DC595E]' }
  if (s.status === 'schedule_locked')   return { label: 'Active',            className: 'bg-blue-100 text-blue-700' }
  if (s.status === 'registration_open') return { label: 'Registration Open', className: 'bg-yellow-100 text-yellow-700' }
  if (hasPendingCheers(s))              return { label: `Give Cheers · ${cheerTimeLeft(s)}`, className: 'bg-yellow-100 text-yellow-700' }
  return                                       { label: 'Completed',                         className: 'bg-muted text-muted-foreground' }
}

export function MySessionsView() {
  const { user, isLoading: authLoading } = useAuth()
  const { sessions, isLoading } = usePlayerSessions(user?.id ?? null)

  const loading = authLoading || isLoading

  const sorted = [...sessions].sort((a, b) => {
    // Priority: active > give-cheers > completed
    const priority = (s: SessionPickerItem) =>
      ACTIVE_STATUSES.has(s.status) ? 2 : hasPendingCheers(s) ? 1 : 0
    const diff = priority(b) - priority(a)
    if (diff !== 0) return diff
    return b.date.localeCompare(a.date)
  })

  return (
    <div className="max-w-sm mx-auto px-4 py-8">
      <h1 className="text-xl font-bold mb-6">My Sessions</h1>

      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <p className="text-muted-foreground text-sm">You're not registered in any sessions yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {sorted.map((s) => {
            const badge = statusBadge(s)
            const formattedDate = new Date(s.date + 'T00:00:00').toLocaleDateString('en-US', {
              weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
            })
            const formattedTime = s.time
              ? new Date(`1970-01-01T${s.time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
              : null

            return (
              <Link
                key={s.id}
                to={`/sessions/${s.id}`}
                className="flex items-center justify-between px-4 py-4 rounded-xl border border-border hover:bg-muted/50 transition-colors"
              >
                <div className="min-w-0">
                  <div className="font-semibold truncate">{s.name}</div>
                  <div className="text-sm text-muted-foreground mt-0.5">
                    {formattedDate}
                    {formattedTime && <span> · {formattedTime}</span>}
                    {s.duration && <span> · {s.duration}</span>}
                    {s.venue && <span> · {s.venue}</span>}
                  </div>
                </div>
                <span className={`ml-3 shrink-0 text-xs font-semibold px-2 py-1 rounded-full ${badge.className}`}>
                  {badge.label}
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default MySessionsView
