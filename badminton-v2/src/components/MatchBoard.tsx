import { Avatar } from '@/components/Avatar'
import type { PaymentState } from '@/lib/paymentState'

/**
 * The All Matches board.
 *
 * Sorted by state, not by number: whatever is on court renders as a full
 * 2-versus-2 band, the next few as medium rows, the rest as one-liners, and
 * everything played folds behind a disclosure with the winner recorded.
 * Twenty identical cards told you nothing about which one mattered.
 *
 * The zone headings change before the session starts. Nothing is "up next"
 * when nothing is running, and "first open court" would be false — no court
 * is open yet.
 */

export interface BoardPlayer {
  name: string
  avatarUrl: string | null
}

export interface BoardMatch {
  id: string
  gameNumber: number
  status: 'queued' | 'playing' | 'complete'
  courtNumber: number | null
  startedAt: string | null
  /** 1, 2, or null when the match has no recorded result. */
  winningPairIndex: 1 | 2 | null
  team1: BoardPlayer[]
  team2: BoardPlayer[]
}

const UP_NEXT_COUNT = 3

// ---------------------------------------------------------------------------
// Small pieces
// ---------------------------------------------------------------------------

function pairNames(pair: BoardPlayer[]) {
  return pair.map((p) => p.name).join(' & ')
}

/** Court 1 borrows the brand purple; court 2 needs its own hue to be tellable apart at 20px. */
function courtChipClass(courtNumber: number) {
  return courtNumber === 1
    ? 'bg-primary-subtle text-primary dark:text-[#DCC2EE]'
    : 'bg-court2/15 text-court2'
}

function ZoneHeading({ label, count }: { label: string; count?: number }) {
  return (
    <div className="flex items-center gap-2 mb-2.5">
      <h2 className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{label}</h2>
      {count != null && (
        <span className="ml-auto text-[10px] font-semibold text-muted-foreground tabular-nums">{count}</span>
      )}
    </div>
  )
}

/** Four faces in a row, two a side, with the divider between them. */
function MiniBand({ match, size }: { match: BoardMatch; size: number }) {
  return (
    <div className="flex items-center gap-1">
      {match.team1.map((p, i) => (
        <Avatar key={`t1-${i}`} url={p.avatarUrl} name={p.name} size={size} />
      ))}
      <span className="px-1 text-[8.5px] font-bold uppercase tracking-[0.1em] text-muted-foreground shrink-0">vs</span>
      {match.team2.map((p, i) => (
        <Avatar key={`t2-${i}`} url={p.avatarUrl} name={p.name} size={size} />
      ))}
    </div>
  )
}

/** The hero. Two left, two right, a net down the middle — the shape of the game. */
function MatchupBand({ match, elapsed }: { match: BoardMatch; elapsed: string | null }) {
  const court = match.courtNumber ?? 1
  return (
    <div
      className="rounded-2xl border bg-card p-3 mb-2.5"
      style={{ borderColor: `color-mix(in srgb, var(--${court === 1 ? 'primary' : 'court2'}) 55%, transparent)` }}
    >
      <div className="flex items-center gap-2 mb-3">
        {match.courtNumber != null && (
          <span className={`shrink-0 rounded-md px-2 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] ${courtChipClass(court)}`}>
            Court {match.courtNumber}
          </span>
        )}
        {elapsed && <span className="font-mono text-xs font-semibold text-gold-ink">{elapsed}</span>}
        <span className="ml-auto flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-destructive">
          <span className="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" />
          Live
        </span>
      </div>

      <p className="mb-2.5 text-center font-mono text-[11px] font-bold tracking-[0.08em] text-muted-foreground">
        Game {match.gameNumber}
      </p>

      <div className="grid items-start gap-1" style={{ gridTemplateColumns: '1fr 26px 1fr' }}>
        <BandSide players={match.team1} />
        <div className="flex flex-col items-center justify-center pt-3.5">
          <span className="font-mono text-[9px] font-bold tracking-[0.1em] text-muted-foreground">vs</span>
          <span className="my-1.5 block h-5 w-px bg-border" />
        </div>
        <BandSide players={match.team2} />
      </div>
    </div>
  )
}

function BandSide({ players }: { players: BoardPlayer[] }) {
  return (
    <div className="flex justify-evenly gap-1.5">
      {players.map((p, i) => (
        <div key={i} className="w-16 text-center">
          <div className="mx-auto mb-1.5 w-fit">
            <Avatar url={p.avatarUrl} name={p.name} size={48} />
          </div>
          {/* Names wrap rather than truncate — nicknames run long. */}
          <p className="text-[11.5px] font-semibold leading-tight tracking-[-0.01em] break-words">{p.name}</p>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Payment
// ---------------------------------------------------------------------------

/**
 * Deliberately hands off to `/sessions/:id` rather than repeating the receipt
 * upload. One upload flow, one derivation — the same reasoning as
 * `src/lib/paymentState.ts`.
 */
export function PaymentBanner({
  paymentState,
  price,
  sessionId,
  yourGameCount,
  scheduleDrawn,
}: {
  paymentState: PaymentState
  price: number | null
  sessionId: string
  yourGameCount: number | null
  scheduleDrawn: boolean
}) {
  const amount = price != null ? `₱${price}` : null

  if (paymentState === 'paid') {
    return (
      <span className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-success/15 px-2 py-1.5 text-[9.5px] font-bold uppercase tracking-[0.12em] text-success">
        ✓ Paid{amount ? ` ${amount}` : ''}
      </span>
    )
  }

  if (paymentState === 'submitted') {
    return (
      <div className="mt-3 rounded-2xl border border-gold/50 bg-gold/10 p-3">
        <div className="flex items-center gap-2">
          <span className="shrink-0 rounded-md bg-gold/20 px-2 py-1 text-[9.5px] font-bold uppercase tracking-[0.12em] text-gold-ink">
            Awaiting confirmation
          </span>
          {amount && <span className="ml-auto text-[17px] font-bold tracking-[-0.02em] tabular-nums">{amount}</span>}
        </div>
        <p className="mt-2 text-[12.5px] leading-snug text-muted-foreground">
          Receipt received — nothing more to do until it&apos;s confirmed.
        </p>
        <a
          href={`/sessions/${sessionId}`}
          className="mt-2.5 flex min-h-11 w-full items-center justify-center rounded-[10px] border border-border text-[13.5px] font-semibold text-foreground transition-colors hover:bg-muted"
        >
          View my receipt
        </a>
      </div>
    )
  }

  return (
    <div className="mt-3 rounded-2xl border border-destructive/45 bg-destructive/[0.09] p-3">
      <div className="flex items-center gap-2">
        <span className="shrink-0 rounded-md bg-destructive/20 px-2 py-1 text-[9.5px] font-bold uppercase tracking-[0.12em] text-destructive">
          Unpaid
        </span>
        {amount && (
          <span className="ml-auto text-[17px] font-bold tracking-[-0.02em] tabular-nums text-destructive">{amount}</span>
        )}
      </div>
      <p className="mt-2 text-[12.5px] leading-snug text-muted-foreground">
        {scheduleDrawn && yourGameCount != null && yourGameCount > 0
          ? `Your games are drawn and you're in ${yourGameCount} of them. `
          : ''}
        Send{amount ? ` ${amount}` : ''} via GCash, then upload the receipt so it can be confirmed.
      </p>
      <a
        href={`/sessions/${sessionId}`}
        className="mt-2.5 flex min-h-11 w-full items-center justify-center rounded-[10px] bg-primary text-[13.5px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Pay &amp; upload receipt →
      </a>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Header + empty state
// ---------------------------------------------------------------------------

const STATUS_LABEL: Record<string, string> = {
  setup: 'Setup',
  registration_open: 'Registration open',
  registration_closed: 'Registration closed',
  schedule_locked: 'Schedule locked',
  in_progress: 'In progress',
  complete: 'Complete',
}

export function BoardHeader({
  sessionName,
  sessionDate,
  sessionStatus,
  venue,
  played,
  total,
  liveCount,
}: {
  sessionName: string
  sessionDate: string | null
  sessionStatus: string | null
  venue: string | null
  played: number
  total: number
  liveCount: number
}) {
  const formattedDate = sessionDate
    ? new Date(`${sessionDate}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null
  const statusLabel = sessionStatus ? STATUS_LABEL[sessionStatus] ?? sessionStatus : null
  const showMeter = total > 0

  return (
    <>
      {/* The title row stays clear of the top-right corner: LiveIndicator is
          absolutely positioned there and its offline state is a full button. */}
      <h1 className="text-[17px] font-semibold tracking-[-0.01em] pr-24">{sessionName || 'All matches'}</h1>
      {(formattedDate || statusLabel || venue) && (
        <p className="mt-1 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          {[formattedDate, statusLabel, venue].filter(Boolean).join(' · ')}
        </p>
      )}
      {showMeter && (
        <div className="mt-2.5">
          <div className="h-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${Math.round((played / total) * 100)}%` }} />
          </div>
          <div className="mt-1.5 flex justify-between font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            <span>{played} of {total} played</span>
            <span>{liveCount > 0 ? `${liveCount} on court` : played === total ? 'finished' : 'not started'}</span>
          </div>
        </div>
      )}
    </>
  )
}

/**
 * Before the matches are generated the list had nothing to render, so the page
 * was a header over blank space for two whole session statuses. The steps
 * double as an answer to "what happens next", which otherwise lives only in
 * the organiser's head.
 */
export function NoScheduleYet({ paymentState, registered }: { paymentState: PaymentState; registered: boolean }) {
  const steps: Array<{ label: string; done: boolean }> = [
    { label: registered ? "You're registered" : 'Register for this session', done: registered },
    { label: 'Payment confirmed', done: paymentState === 'paid' },
    { label: 'Registration closes · matches drawn', done: false },
    { label: 'Session starts', done: false },
  ]

  return (
    <div className="mt-5 rounded-2xl border border-dashed border-border p-6 text-center">
      <div className="text-[26px] leading-none" aria-hidden="true">🏸</div>
      <h2 className="mt-3 text-[15px] font-semibold tracking-[-0.01em]">Matches aren&apos;t drawn yet</h2>
      <p className="mx-auto mt-1.5 max-w-[30ch] text-[12.5px] leading-relaxed text-muted-foreground">
        The schedule is generated once registration closes. Every game will show up here.
      </p>
      <div className="mt-4 border-t border-border pt-3.5 text-left">
        {steps.map((s) => (
          <div key={s.label} className={`flex items-start gap-2.5 py-1.5 text-xs ${s.done ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
            <span className={`mt-px grid h-4 w-4 shrink-0 place-items-center rounded-full font-mono text-[9px] font-bold ${s.done ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
              {s.done ? '✓' : steps.indexOf(s) + 1}
            </span>
            <span>{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// The board
// ---------------------------------------------------------------------------

export function MatchBoard({
  matches,
  sessionStarted,
  elapsedByMatchId,
}: {
  matches: BoardMatch[]
  /** Before the session starts nothing is "next" and no court is open. */
  sessionStarted: boolean
  elapsedByMatchId: Record<string, string>
}) {
  const live = matches.filter((m) => m.status === 'playing')
  const queued = matches.filter((m) => m.status === 'queued')
  const played = matches.filter((m) => m.status === 'complete')

  const upNext = queued.slice(0, UP_NEXT_COUNT)
  const later = queued.slice(UP_NEXT_COUNT)
  const allDone = played.length > 0 && queued.length === 0 && live.length === 0

  return (
    <>
      {live.length > 0 && (
        <section className="mt-5">
          <ZoneHeading label="On court now" />
          {live.map((m) => (
            <MatchupBand key={m.id} match={m} elapsed={elapsedByMatchId[m.id] ?? null} />
          ))}
        </section>
      )}

      {upNext.length > 0 && (
        <section className="mt-5">
          <ZoneHeading label={sessionStarted ? 'Up next' : 'Starts with'} count={upNext.length} />
          {upNext.map((m, i) => (
            <div key={m.id} className="mb-1.5 flex items-center gap-2.5 rounded-xl border border-border bg-card p-2.5">
              <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[9px] bg-muted font-mono text-xs font-bold text-muted-foreground">
                {m.gameNumber}
              </span>
              <div className="min-w-0 flex-1">
                <MiniBand match={m} size={26} />
                <p className="mt-1.5 truncate text-xs font-semibold">
                  {pairNames(m.team1)} vs {pairNames(m.team2)}
                </p>
                <p className="mt-1.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
                  {sessionStarted
                    ? i === 0 ? 'First open court' : `${i + 1} games away`
                    : i === 0 ? 'First on court' : `Game ${i + 1} of the night`}
                </p>
              </div>
            </div>
          ))}
        </section>
      )}

      {later.length > 0 && (
        <section className="mt-5">
          <ZoneHeading label="Later" count={later.length} />
          {later.map((m) => (
            <div key={m.id} className="flex items-center gap-2.5 border-b border-border py-2 last:border-b-0">
              <span className="w-[22px] shrink-0 text-right font-mono text-[11px] font-bold text-muted-foreground">
                {m.gameNumber}
              </span>
              <MiniBand match={m} size={18} />
              <span className="min-w-0 truncate text-xs text-muted-foreground">
                {pairNames(m.team1)} vs {pairNames(m.team2)}
              </span>
            </div>
          ))}
        </section>
      )}

      {played.length > 0 && (
        <details className="mt-5 border-t border-border pt-3.5" open={allDone}>
          <summary className="flex cursor-pointer list-none items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground [&::-webkit-details-marker]:hidden">
            {allDone ? 'All results' : 'Played'}
            <span className="ml-auto tabular-nums">{played.length}</span>
          </summary>
          <div className="mt-2.5">
            {[...played].reverse().map((m) => {
              const winners = m.winningPairIndex === 2 ? m.team2 : m.team1
              const losers = m.winningPairIndex === 2 ? m.team1 : m.team2
              const hasResult = m.winningPairIndex != null
              return (
                <div key={m.id} className="flex items-center gap-2.5 border-b border-border py-2.5 last:border-b-0">
                  <span className="w-[22px] shrink-0 text-right font-mono text-[11px] font-bold text-muted-foreground">
                    {m.gameNumber}
                  </span>
                  {winners.map((p, i) => (
                    <Avatar key={i} url={p.avatarUrl} name={p.name} size={18} />
                  ))}
                  <span className={`min-w-0 truncate text-xs ${hasResult ? 'font-semibold text-gold-ink' : 'text-foreground'}`}>
                    {pairNames(winners)}
                  </span>
                  <span className="shrink-0 px-0.5 text-xs text-muted-foreground">{hasResult ? 'beat' : 'vs'}</span>
                  <span className="min-w-0 truncate text-xs text-muted-foreground">{pairNames(losers)}</span>
                </div>
              )
            })}
          </div>
        </details>
      )}
    </>
  )
}
