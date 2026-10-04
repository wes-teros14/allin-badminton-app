import { useId, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Calendar, ChevronDown, Clock, FileText, MapPin, PhilippinePeso, SlidersVertical, Timer, WalletCards } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { usePlayerSessions } from '@/hooks/usePlayerSessions'
import type { SessionPickerItem, SessionRegistrant } from '@/hooks/usePlayerSessions'
import { Avatar } from '@/components/Avatar'
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

/** "9 of 14 going", "All 14 slots taken", or "11 going" when there is no limit. */
export function registrantsCountLabel(count: number, maxPlayers: number | null | undefined): string {
  if (maxPlayers == null) return `${count} going`
  if (count >= maxPlayers) return `All ${maxPlayers} slots taken`
  return `${count} of ${maxPlayers} going`
}

/**
 * Who's going on an open session: the first few faces and the count, which
 * expand into name chips. It replaces the old "N / M registered" line, so the
 * card states the headcount once.
 *
 * It sits inside the card but outside the card's <Link> — a button inside an
 * anchor would navigate on every tap. `aside` is the admin shortcut, placed
 * level with this row so it does not move when the list opens.
 */
function RegistrantsRow({
  registrants,
  maxPlayers,
  currentUserId,
  aside,
}: {
  registrants: SessionRegistrant[] | null
  maxPlayers: number | null | undefined
  currentUserId: string | null
  aside: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const listId = useId()

  let row: ReactNode
  if (registrants === null) {
    row = (
      <p className="flex min-h-11 items-center text-xs text-destructive">
        Couldn’t load who’s going. Reload to try again.
      </p>
    )
  } else if (registrants.length === 0) {
    // Nothing to expand, so this is plain text rather than a button.
    row = (
      <p className="flex min-h-11 items-center text-xs font-bold text-primary-ink">
        {maxPlayers == null ? 'No one yet' : `0 of ${maxPlayers} going`}. Be the first.
      </p>
    )
  } else {
    const slotsLeft = maxPlayers != null ? Math.max(maxPlayers - registrants.length, 0) : 0
    row = (
      <>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={listId}
          className="flex min-h-11 w-full items-center gap-2.5 rounded-lg text-xs font-bold text-primary-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex" aria-hidden="true">
            {registrants.slice(0, 4).map((r, i) => (
              <Avatar key={r.id} url={r.avatarUrl} name={r.name} size={24} className={`ring-2 ring-card ${i > 0 ? '-ml-1.5' : ''}`} />
            ))}
          </span>
          <span>{registrantsCountLabel(registrants.length, maxPlayers)}</span>
          <ChevronDown
            className={`ml-auto h-4 w-4 shrink-0 transition-transform duration-200 motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>

        {/* grid-rows 0fr -> 1fr animates the height without measuring it. */}
        <div
          id={listId}
          aria-hidden={!open}
          className={`grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
        >
          <div className="overflow-hidden">
            <div className="flex flex-wrap gap-1.5 pb-2 pt-0.5">
              {registrants.map((r) => {
                const isMe = r.id === currentUserId
                return (
                  <span
                    key={r.id}
                    className={`inline-flex items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-2.5 text-xs ${
                      isMe ? 'border-gold/45 bg-gold/10 font-semibold text-gold-ink' : 'border-border text-foreground'
                    }`}
                  >
                    <Avatar url={r.avatarUrl} name={r.name} size={20} />
                    {isMe ? 'You' : r.name}
                  </span>
                )
              })}
              {slotsLeft > 0 && (
                <span className="inline-flex items-center rounded-full border border-dashed border-border px-2.5 py-0.5 text-xs text-muted-foreground">
                  {slotsLeft} {slotsLeft === 1 ? 'slot' : 'slots'} left
                </span>
              )}
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <div className={`relative pb-2.5 pl-5 ${aside ? 'pr-16' : 'pr-4'}`}>
      {aside}
      {row}
    </div>
  )
}

/**
 * Session notes are written as a pipe-separated list of rules
 * ("6 games | 21 pts/game | 1 new shuttle/game @ 1st 20 games"), so the card
 * can lay them out as separate chips instead of clamping one long sentence and
 * cutting it mid-word. Returns null when the note is not a list — a note
 * written as prose has nothing to split on and falls back to plain text.
 */
export function splitSessionNotes(notes: string): string[] | null {
  const parts = notes.split('|').map((p) => p.trim()).filter(Boolean)
  return parts.length > 1 ? parts : null
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
      className: 'border-gold/40 bg-gold/10 text-gold-ink',
      accentClassName: 'bg-gold',
      isActive: true,
    }
  }

  // Finished but not yet closed by the admin: results are in, and the card
  // stays in Upcoming so an unpaid amount is still in front of the player.
  if (s.status === 'complete' && s.closed_at == null) {
    return {
      label: 'Finished',
      className: 'border-court2/40 bg-court2/10 text-court2',
      accentClassName: 'bg-court2/70',
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

/** Upcoming vs Past is decided by the admin's Close, not by play ending. */
export function isUpcomingForPlayer(s: Pick<SessionPickerItem, 'status' | 'closed_at'>): boolean {
  if (ACTIVE_STATUSES.has(s.status)) return true
  return s.status === 'complete' && s.closed_at == null
}

function SessionRow({ s, index, isAdmin, currentUserId }: { s: SessionPickerItem; index: number; isAdmin: boolean; currentUserId: string | null }) {
  const badge = statusBadge(s)
  const isActive = isUpcomingForPlayer(s)
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
  const noteChips = s.session_notes ? splitSessionNotes(s.session_notes) : null
  const paymentState = derivePaymentState({ paid: s.paid, activeReceiptCount: s.activeReceiptCount, exempt: s.paymentExempt })
  const paymentClassName =
    paymentState === 'paid' ? 'text-green-700'
    : paymentState === 'submitted' ? 'text-amber-600 dark:text-amber-500'
    : paymentState === 'exempt' ? 'text-muted-foreground'
    : 'text-destructive'
  const showRegistrants = s.status === 'registration_open' && s.registrants !== undefined
  const adminShortcut = (position: string) => isAdmin && (
    <Link
      to={`/session/${s.id}`}
      aria-label={`Manage ${s.name} (admin)`}
      title="Manage session"
      className={`absolute ${position} right-2.5 grid h-11 w-11 place-items-center rounded-xl border border-primary bg-primary-subtle text-primary transition-[background-color,color,transform] hover:bg-primary hover:text-primary-foreground active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
    >
      <SlidersVertical className="h-5 w-5" aria-hidden="true" />
    </Link>
  )

  return (
    // The card body is a single <Link>, and an anchor cannot contain another
    // anchor or a button. So the admin shortcut and the "who's going" toggle
    // live outside it — the card's border, background and hover/lift state sit
    // on this wrapper so all the pieces read and animate as one card.
    <div
      style={{ animationDelay: `${index * 60}ms` }}
      className={`animate-card-fade-up group relative overflow-hidden rounded-2xl border bg-card shadow-sm transition-all hover:-translate-y-0.5 ${
        isActive
          ? 'border-primary/30 hover:border-primary/50 hover:shadow-[0_8px_24px_-4px_rgba(111,62,135,0.15)]'
          : 'border-border hover:shadow-md'
      }`}
    >
      <div className={`absolute inset-y-0 left-0 w-1 ${badge.accentClassName}`} />
      <div className="relative">
      <Link
        to={`/sessions/${s.id}`}
        className={`relative flex w-full flex-col rounded-2xl py-4 pl-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${
          // Reserve a gutter for the admin button so long venue or note text
          // cannot run underneath it.
          isAdmin ? 'pr-16' : 'pr-4'
        } ${showRegistrants ? 'pb-1' : ''}`}
      >

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
          noteChips
            ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {noteChips.map((chip, i) => (
                  <span
                    key={i}
                    className="rounded-lg bg-muted px-2.5 py-1 text-xs leading-snug text-muted-foreground"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            )
            : (
              <p className="mt-2 flex items-start gap-1.5 text-sm leading-relaxed text-muted-foreground">
                <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#A84767]" aria-hidden="true" />
                <span>{s.session_notes}</span>
              </p>
            )
        )}

        {s.isRegistered && s.paid !== null && (
          <p className={`mt-2 flex items-center gap-1.5 text-xs font-medium ${paymentClassName}`}>
            <WalletCards className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Payment: {PAYMENT_STATE_LABEL[paymentState]}</span>
          </p>
        )}

        {!showRegistrants && s.status === 'registration_open' && s.playerCount !== undefined && (
          <p className="mt-2 text-xs font-bold text-primary">
            {s.maxPlayers != null
              ? `${s.playerCount} / ${s.maxPlayers} registered`
              : `${s.playerCount} registered`}
          </p>
        )}
      </Link>

      {!showRegistrants && adminShortcut('bottom-2.5')}
      </div>

      {showRegistrants && (
        <RegistrantsRow
          registrants={s.registrants ?? null}
          maxPlayers={s.maxPlayers}
          currentUserId={currentUserId}
          aside={adminShortcut('top-0')}
        />
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
    .filter(isUpcomingForPlayer)
    .sort(compareSessionsByScheduledDate)

  const pastSessions = sessions
    .filter((s) => !isUpcomingForPlayer(s))
    .sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div className="max-w-sm sm:max-w-md md:max-w-lg mx-auto px-4 py-8">
      <div className="mb-6 space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Sessions</h1>
        <p className="text-sm text-muted-foreground">
          Upcoming, live, and past badminton sessions. Tap a session to register, pay, and see your games.
        </p>
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
          {activeSessions.map((s, i) => <SessionRow key={s.id} s={s} index={i} isAdmin={isAdmin} currentUserId={user?.id ?? null} />)}

          {pastSessions.length > 0 && (
            <div className="space-y-3 pt-2">
              <button
                onClick={() => setShowPast((p) => !p)}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {showPast ? 'Hide' : 'Show'} Past Sessions ({pastSessions.length})
              </button>
              {showPast && pastSessions.map((s, i) => <SessionRow key={s.id} s={s} index={activeSessions.length + i} isAdmin={isAdmin} currentUserId={user?.id ?? null} />)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default MySessionsView
