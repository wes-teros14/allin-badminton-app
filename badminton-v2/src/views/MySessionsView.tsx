import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Calendar, Clock, FileText, MapPin, PhilippinePeso, SlidersVertical, Timer, WalletCards } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { usePlayerSessions } from '@/hooks/usePlayerSessions'
import type { SessionPickerItem } from '@/hooks/usePlayerSessions'
import { derivePaymentState, PAYMENT_STATE_LABEL } from '@/lib/paymentState'

const ACTIVE_STATUSES = new Set(['in_progress', 'schedule_locked', 'registration_open', 'registration_closed'])
const SHOW_REGISTERED_PILL_STATUSES = new Set(['in_progress', 'schedule_locked', 'registration_closed'])
const REGISTERED_BADGE_CLASS = 'border-green-500/30 bg-green-500/10 text-green-700'

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
      <Icon className={`h-3.5 w-3.5 shrink-0 ${iconClassName}`} aria-hidden="true" />
      <span className="truncate">{children}</span>
    </span>
  )
}

export function compareSessionsByScheduledDate(a: { date: string; time: string | null }, b: { date: string; time: string | null }): number {
  const dateCompare = a.date.localeCompare(b.date)
  if (dateCompare !== 0) return dateCompare
  if (a.time === b.time) return 0
  if (a.time === null) return 1
  if (b.time === null) return -1
  return a.time.localeCompare(b.time)
}

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
      label: 'Closed',
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

function SessionRow({ s, index, isAdmin }: { s: SessionPickerItem; index: number; isAdmin: boolean }) {
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
  // Same derivation as the session card and the admin payment panel — all three
  // surfaces read from one helper so they cannot drift (FR-020).
  const paymentState = derivePaymentState({ paid: s.paid, activeReceiptCount: s.activeReceiptCount })
  const paymentClassName =
    paymentState === 'paid' ? 'text-green-700'
    : paymentState === 'submitted' ? 'text-amber-600 dark:text-amber-500'
    : 'text-destructive'

  return (
    // The card is a single <Link>, and an anchor cannot contain another anchor.
    // So the admin shortcut lives outside it as an absolutely positioned
    // sibling — the hover/lift state moves to this wrapper so both pieces
    // animate as one card.
    <div
      style={{ animationDelay: `${index * 60}ms` }}
      className="animate-card-fade-up group relative transition-transform hover:-translate-y-0.5"
    >
      <Link
        to={`/sessions/${s.id}`}
        className={`relative flex w-full flex-col overflow-hidden rounded-2xl border py-4 pl-5 shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          // Reserve a gutter for the admin button so long venue or note text
          // cannot run underneath it.
          isAdmin ? 'pr-16' : 'pr-4'
        } ${
          isActive
            ? 'border-primary/30 bg-card group-hover:border-primary/50 group-hover:shadow-[0_8px_24px_-4px_rgba(111,62,135,0.15)]'
            : 'border-border bg-card group-hover:shadow-md'
        }`}
      >
        <div className={`absolute inset-y-0 left-0 w-1 ${badge.accentClassName}`} />

        <div className="space-y-0.5">
          {/* The admin gutter is reserved on the whole card, but the button
              only occupies the bottom corner — so the name and status pills
              reclaim it and keep the width they have without the shortcut. */}
          <div className={`flex items-start justify-between gap-3 ${isAdmin ? '-mr-12' : ''}`}>
            <p className="text-base font-semibold leading-tight text-foreground transition-colors group-hover:text-primary">
              {s.name}
            </p>

            <div className="flex shrink-0 flex-nowrap justify-end gap-1.5">
              <span className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold ${badge.className}`}>
                {badge.label}
              </span>
              {showRegisteredPill && (
                <span className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold ${REGISTERED_BADGE_CLASS}`}>
                  Registered
                </span>
              )}
            </div>
          </div>

          <p className="flex items-center gap-1.5 whitespace-nowrap text-sm font-normal text-muted-foreground">
            <Calendar className="h-3.5 w-3.5 shrink-0 text-[#A84767]" aria-hidden="true" />
            <span>{formattedDate}</span>
          </p>
        </div>

        {(formattedTime || s.duration || s.price != null) && (
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {formattedTime && <DetailItem icon={Clock} iconClassName="text-[#A84767]">{formattedTime}</DetailItem>}
            {s.duration && <DetailItem icon={Timer} iconClassName="text-[#A84767]">{s.duration} hrs</DetailItem>}
            {s.price != null && <DetailItem icon={PhilippinePeso} iconClassName="text-[#A84767]">{s.price}</DetailItem>}
          </p>
        )}

        {s.venue && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-[#A84767]" aria-hidden="true" />
            <span className="truncate">{s.venue}</span>
          </p>
        )}

        {s.session_notes && (
          <p className="mt-2 flex items-start gap-1.5 text-sm leading-relaxed text-muted-foreground">
            <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#A84767]" aria-hidden="true" />
            <span className="line-clamp-2">{s.session_notes}</span>
          </p>
        )}

        {s.isRegistered && s.paid !== null && (
          <p className={`mt-2 flex items-center gap-1.5 text-xs font-medium ${paymentClassName}`}>
            <WalletCards className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Payment: {PAYMENT_STATE_LABEL[paymentState]}</span>
          </p>
        )}

        {s.status === 'registration_open' && s.playerCount !== undefined && (
          <p className="mt-2 text-xs font-bold text-primary">
            {s.maxPlayers != null
              ? `${s.playerCount} / ${s.maxPlayers} registered`
              : `${s.playerCount} registered`}
          </p>
        )}
      </Link>

      {isAdmin && (
        <Link
          to={`/session/${s.id}`}
          aria-label={`Manage ${s.name} (admin)`}
          title="Manage session"
          className="absolute bottom-2.5 right-2.5 grid h-11 w-11 place-items-center rounded-xl border border-primary bg-primary-subtle text-primary transition-[background-color,color,transform] hover:bg-primary hover:text-primary-foreground active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <SlidersVertical className="h-5 w-5" aria-hidden="true" />
        </Link>
      )}
    </div>
  )
}

export function MySessionsView() {
  const { user, role, isLoading: authLoading } = useAuth()
  const { sessions, isLoading } = usePlayerSessions(user?.id ?? null)
  const [showPast, setShowPast] = useState(false)

  // Same two roles AdminRoute admits, so the shortcut is never a dead end.
  const isAdmin = role === 'admin' || role === 'moderator'

  const loading = authLoading || isLoading

  const activeSessions = sessions
    .filter((s) => ACTIVE_STATUSES.has(s.status))
    .sort(compareSessionsByScheduledDate)

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
          {activeSessions.map((s, i) => <SessionRow key={s.id} s={s} index={i} isAdmin={isAdmin} />)}

          {pastSessions.length > 0 && (
            <div className="space-y-3 pt-2">
              <button
                onClick={() => setShowPast((p) => !p)}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {showPast ? 'Hide' : 'Show'} Past Sessions ({pastSessions.length})
              </button>
              {showPast && pastSessions.map((s, i) => <SessionRow key={s.id} s={s} index={activeSessions.length + i} isAdmin={isAdmin} />)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default MySessionsView
