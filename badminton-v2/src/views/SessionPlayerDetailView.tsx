import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router'
import { toast } from 'sonner'
import { Paperclip, Trash2 } from 'lucide-react'
import { computeStatsFromResults } from '@/lib/matchResults'
import { supabase } from '@/lib/supabase'
import { formatDisplayName } from '@/lib/formatDisplayName'
import { derivePaymentState } from '@/lib/paymentState'
import { MAX_RECEIPTS_PER_SESSION } from '@/lib/receipts'
import { useAuth } from '@/hooks/useAuth'
import { useCourtState } from '@/hooks/useCourtState'
import { usePlayerSchedule } from '@/hooks/usePlayerSchedule'
import { usePaymentSettings } from '@/hooks/usePaymentSettings'
import { useRealtime } from '@/hooks/useRealtime'
import { useSessionReceipts, signReceiptUrls, type SessionReceipt } from '@/hooks/useSessionReceipts'
import { PersonalGameCard, SessionProgress } from '@/components/MatchBoard'
import { PlayerCourtTabs } from '@/components/PlayerCourtTabs'
import { AllMatchesView } from '@/views/PlayerView'
import { LiveIndicator } from '@/components/LiveIndicator'
import { PlayerScheduleHeader } from '@/components/PlayerScheduleHeader'
import { ReceiptUploadDialog } from '@/components/ReceiptUploadDialog'
import { Avatar } from '@/components/Avatar'

export function shouldShowPaymentInfo({
  isRegistered,
  paid,
  hasPaymentInfo,
}: {
  isRegistered: boolean
  paid: boolean | null
  hasPaymentInfo: boolean
}): boolean {
  return isRegistered && paid !== true && hasPaymentInfo
}

// ---------------------------------------------------------------------------
// Submitted receipts strip (player's own, inside the payment banner)
//
// The `receipts` bucket is private, so thumbnails render through
// short-lived signed URLs minted on demand -- never getPublicUrl().
// ---------------------------------------------------------------------------
function SubmittedReceipts({
  receipts,
  canRemove,
  onRemove,
}: {
  receipts: SessionReceipt[]
  canRemove: boolean
  onRemove: (receipt: SessionReceipt) => void
}) {
  const [urls, setUrls] = useState<Record<string, string | null>>({})
  // An image can legitimately be missing: maintenance deletes the storage
  // object before the row (see supabase/maintenance/receipts-cleanup.sql), so
  // there is a window where the row still exists and the file does not.
  const [failed, setFailed] = useState<Record<string, boolean>>({})

  useEffect(() => {
    let cancelled = false
    const paths = receipts.map((r) => r.storagePath)
    if (paths.length === 0) { setUrls({}); return }
    signReceiptUrls(paths).then((signed) => {
      if (cancelled) return
      const next: Record<string, string | null> = {}
      receipts.forEach((r, i) => { next[r.id] = signed[i] })
      setUrls(next)
    })
    return () => { cancelled = true }
  }, [receipts])

  if (receipts.length === 0) return null

  return (
    <ul className="space-y-2">
      {receipts.map((r) => (
        <li key={r.id} className="flex items-start gap-2 px-2 py-2 rounded-lg bg-card border border-border">
          {failed[r.id] ? (
            <div className="w-12 h-12 rounded border border-border bg-muted flex items-center justify-center shrink-0">
              <span className="text-[9px] text-muted-foreground text-center leading-tight px-0.5">image<br />removed</span>
            </div>
          ) : urls[r.id] ? (
            <a href={urls[r.id] ?? undefined} target="_blank" rel="noopener noreferrer" className="shrink-0">
              <img
                src={urls[r.id] ?? undefined}
                alt="Submitted receipt"
                className="w-12 h-12 object-cover rounded border border-border"
                onError={() => setFailed((f) => ({ ...f, [r.id]: true }))}
              />
            </a>
          ) : (
            <div className="w-12 h-12 rounded border border-border bg-muted animate-pulse shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            {r.note
              ? <p className="text-xs text-foreground break-words">{r.note}</p>
              : <p className="text-xs text-muted-foreground italic">No note</p>}
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {new Date(r.uploadedAt).toLocaleString('en-US', {
                month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
              })}
            </p>
          </div>
          {canRemove && (
            <button
              onClick={() => onRemove(r)}
              aria-label="Remove receipt"
              className="shrink-0 p-1 rounded text-destructive hover:bg-destructive/10 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}

// ---------------------------------------------------------------------------
// Leaderboard helpers (mirrors TodayView logic, scoped to a single session)
// ---------------------------------------------------------------------------
interface LeaderboardEntry {
  playerId: string
  displayName: string
  avatarUrl: string | null
  wins: number
  games: number
  winRate: number
}

type MatchRow = {
  team1_player1_id: string
  team1_player2_id: string
  team2_player1_id: string
  team2_player2_id: string
  match_results: Array<{ winning_pair_index: 1 | 2; game_number: number | null }>
}

async function fetchLeaderboard(sessionId: string): Promise<LeaderboardEntry[]> {
  const [regsRes, matchesRes] = await Promise.all([
    supabase.from('session_registrations').select('player_id').eq('session_id', sessionId),
    supabase
      .from('matches')
      .select('team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id, match_results(winning_pair_index, game_number)')
      .eq('session_id', sessionId)
      .eq('status', 'complete'),
  ])

  const playerIds = ((regsRes.data ?? []) as Array<{ player_id: string }>).map((r) => r.player_id)
  if (playerIds.length === 0) return []

  const profilesRes = await supabase.from('profiles').select('id, nickname, name_slug, avatar_url').in('id', playerIds)

  type ProfileRow = { id: string; nickname: string | null; name_slug: string; avatar_url: string | null }
  const profileRows = (profilesRes.data ?? []) as ProfileRow[]
  const nameMap = new Map(profileRows.map((p) => [p.id, formatDisplayName(p.nickname, p.name_slug)]))
  const avatarMap = new Map(profileRows.map((p) => [p.id, p.avatar_url]))

  const statsMap = new Map<string, { wins: number; games: number }>(
    playerIds.map((id) => [id, { wins: 0, games: 0 }])
  )

  for (const match of (matchesRes.data ?? []) as MatchRow[]) {
    for (const [id, matchStats] of computeStatsFromResults(match)) {
      const s = statsMap.get(id)
      if (!s) continue
      s.games += matchStats.games
      s.wins += matchStats.wins
    }
  }

  const entries: LeaderboardEntry[] = []
  for (const [playerId, s] of statsMap) {
    if (s.games === 0) continue
    const winRate = Math.round((s.wins / s.games) * 100)
    entries.push({
      playerId,
      displayName: nameMap.get(playerId) ?? playerId,
      avatarUrl: avatarMap.get(playerId) ?? null,
      wins: s.wins,
      games: s.games,
      winRate,
    })
  }

  return entries.sort((a, b) => b.winRate - a.winRate || b.wins - a.wins)
}

const RANK_ICON = (i: number) => (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : String(i + 1))

/**
 * One step of the payment flow. `on` is the step you can act on now, `done` is
 * behind you, `off` is ahead — step 3 is always `off` until a receipt exists,
 * because it is the one you cannot complete yourself.
 */
function PayStep({
  n,
  state,
  title,
  last,
  children,
}: {
  n: number
  state: 'on' | 'done' | 'off'
  title: string
  last?: boolean
  children?: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-[26px_1fr] gap-3">
      <span
        className={`relative z-10 grid h-[26px] w-[26px] place-items-center rounded-full font-mono text-[11px] font-bold ${
          state === 'done'
            ? 'bg-success/20 text-success'
            : state === 'on'
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-muted-foreground'
        }`}
      >
        {state === 'done' ? '✓' : n}
      </span>
      <div className={last ? 'pb-1' : 'pb-4'}>
        <p className={`mt-1 text-[13.5px] ${state === 'off' ? 'font-medium text-muted-foreground' : 'font-semibold'}`}>
          {title}
        </p>
        {children ? <div className="mt-2.5">{children}</div> : null}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Schedule tab
// ---------------------------------------------------------------------------
function ScheduleTab({
  nameSlug,
  sessionId,
  playerId,
  sessionStatus,
  isRegistered,
  isRegistering,
  paid,
  sessionPrice,
  sessionNotes,
  registrationOpensAt,
  onRegister,
}: {
  nameSlug: string
  sessionId: string
  playerId: string | undefined
  sessionStatus: string | null
  isRegistered: boolean
  isRegistering: boolean
  paid: boolean | null
  sessionPrice: number | null
  sessionNotes: string | null
  registrationOpensAt: string | null
  onRegister: () => void
}) {
  const { matches, playerDisplayName, playerAvatarUrl, sessionMatchTotal, sessionMatchPlayed, sessionName, sessionDate, sessionVenue, sessionTime, sessionDuration, sessionId: resolvedId, isLoading, refresh } = usePlayerSchedule(nameSlug, sessionId)
  const { courts, isLoading: courtsLoading, refresh: refreshCourts } = useCourtState(resolvedId || undefined)
  // Courts and the personal schedule are two reads; a realtime ping has to
  // refresh both or the strip goes stale while your own card updates.
  const refreshAll = useCallback(() => {
    refresh()
    refreshCourts()
  }, [refresh, refreshCourts])
  const { status } = useRealtime(resolvedId, refreshAll)
  const { phoneNumber, qrCodeUrl } = usePaymentSettings()
  const hasPaymentInfo = phoneNumber != null || qrCodeUrl != null
  const showPaymentInfo = shouldShowPaymentInfo({ isRegistered, paid, hasPaymentInfo })

  const { receipts, activeReceiptCount, isUploading, uploadReceipt, deleteReceipt } =
    useSessionReceipts(isRegistered ? sessionId : undefined, isRegistered ? playerId : undefined)
  const [uploadOpen, setUploadOpen] = useState(false)

  // Derived, never stored -- `paid` remains the sole input to revenue.
  const paymentState = derivePaymentState({ paid, activeReceiptCount })

  function handleCopyPhone() {
    if (!phoneNumber) return
    navigator.clipboard.writeText(phoneNumber)
      .then(() => toast.success('Phone number copied'))
      .catch(() => toast.error('Could not copy — please copy it manually'))
  }

  const firstQueuedIndex = matches.findIndex((m) => m.status === 'queued')
  const playingMatch = matches.find((m) => m.status === 'playing')
  const nextUpMatch = firstQueuedIndex >= 0 ? matches[firstQueuedIndex] : null

  return (
    <div className="relative">
      <LiveIndicator status={status} onRefresh={refresh} />
      {isLoading ? (
        <div className="bg-primary px-4 py-5 animate-pulse">
          <div className="h-7 w-32 bg-primary-foreground/30 rounded mb-1" />
          <div className="h-4 w-48 bg-primary-foreground/20 rounded" />
        </div>
      ) : (
        <PlayerScheduleHeader
          nameSlug={playerDisplayName}
          sessionName={sessionName}
          sessionDate={sessionDate}
          sessionVenue={sessionVenue}
          sessionTime={sessionTime}
          sessionDuration={sessionDuration}
          gameCount={matches.length}
          sessionId={resolvedId}
        />
      )}

      {/* Payment — shown whenever registered + unpaid + configured, regardless
          of session status (a player may still owe after registration closes,
          the schedule locks, or the session starts).

          Three steps rather than one wall of instructions: the flow ends with
          something the player cannot do themselves, and saying so is the point. */}
      {isRegistered && showPaymentInfo && (
        <div className="max-w-sm mx-auto px-4 mt-3">
          <div className="rounded-2xl border border-border bg-card p-3.5">
            <div className="mb-4 flex items-center gap-2.5">
              <span className="font-mono text-[9.5px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                Session fee
              </span>
              {sessionPrice != null && (
                <span className="ml-auto text-[28px] font-bold leading-none tracking-[-0.03em] tabular-nums">
                  ₱{sessionPrice}
                </span>
              )}
              <span
                className={`shrink-0 rounded-md px-2 py-1.5 font-mono text-[9.5px] font-bold uppercase tracking-[0.12em] ${
                  paymentState === 'submitted'
                    ? 'bg-gold/20 text-gold-ink'
                    : 'bg-destructive/20 text-destructive'
                }`}
              >
                {paymentState === 'submitted' ? 'Sent' : 'Unpaid'}
              </span>
            </div>

            <div className="relative">
              {/* the rail the step markers sit on */}
              <span className="absolute left-[12.5px] top-6 bottom-3 w-px bg-border" aria-hidden="true" />

              <PayStep n={1} state={paymentState === 'unpaid' ? 'on' : 'done'} title={`Send ${sessionPrice != null ? `₱${sessionPrice}` : 'the fee'} on GCash`}>
                {paymentState === 'unpaid' && (
                  <>
                    {phoneNumber && (
                      <div className="flex items-center justify-between gap-2.5 rounded-[10px] border border-border bg-background px-3 py-2.5">
                        <span className="text-[15px] font-semibold tabular-nums">{phoneNumber}</span>
                        <button
                          onClick={handleCopyPhone}
                          className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-primary"
                        >
                          Copy
                        </button>
                      </div>
                    )}
                    {qrCodeUrl && (
                      <details className="mt-2">
                        <summary className="cursor-pointer list-none text-center text-xs font-semibold text-muted-foreground [&::-webkit-details-marker]:hidden">
                          Show QR instead ⌄
                        </summary>
                        <img
                          src={qrCodeUrl}
                          alt="GCash payment QR code"
                          className="mx-auto mt-2.5 h-36 w-36 rounded-lg border border-border object-contain"
                          onError={(e) => { e.currentTarget.style.display = 'none' }}
                        />
                        <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
                          Press and hold to save it
                        </p>
                      </details>
                    )}
                  </>
                )}
              </PayStep>

              <PayStep
                n={2}
                state={paymentState === 'submitted' ? 'done' : paymentState === 'unpaid' ? 'on' : 'off'}
                title="Upload the receipt"
              >
                {paymentState === 'unpaid' && (
                  <p className="mb-2.5 text-xs leading-relaxed text-muted-foreground">
                    A screenshot from GCash is enough.
                  </p>
                )}
                <SubmittedReceipts
                  receipts={receipts}
                  canRemove={paid !== true}
                  onRemove={(r) => { void deleteReceipt(r) }}
                />
                <button
                  onClick={() => setUploadOpen(true)}
                  disabled={isUploading}
                  className={`mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-[11px] text-sm font-semibold transition-colors disabled:opacity-50 ${
                    receipts.length > 0
                      ? 'border border-border text-foreground hover:border-primary'
                      : 'bg-primary text-primary-foreground hover:bg-primary/90'
                  }`}
                >
                  <Paperclip className="h-4 w-4" />
                  {receipts.length > 0 ? 'Add another receipt' : 'Add receipt'}
                </button>
                {receipts.length > 0 && receipts.length < MAX_RECEIPTS_PER_SESSION && (
                  <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
                    {receipts.length} of {MAX_RECEIPTS_PER_SESSION} submitted
                  </p>
                )}
              </PayStep>

              <PayStep n={3} state={paymentState === 'submitted' ? 'on' : 'off'} title="Wes confirms it" last>
                {paymentState === 'submitted' && (
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Nothing more to do — he checks your receipt against GCash, then marks it paid.
                  </p>
                )}
              </PayStep>
            </div>
          </div>

          <ReceiptUploadDialog
            open={uploadOpen}
            onOpenChange={setUploadOpen}
            onSubmit={uploadReceipt}
            isUploading={isUploading}
            currentCount={activeReceiptCount}
          />
        </div>
      )}

      {/* Registration banner */}
      {sessionStatus === 'registration_open' && (
        <div className="max-w-sm mx-auto px-4 mt-3">
          {isRegistered ? (
            !showPaymentInfo && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-primary/10 border border-primary/20 text-sm text-primary font-medium">
                ✅ You&apos;re registered!
              </div>
            )
          ) : (() => {
            const opensLater = registrationOpensAt && new Date(registrationOpensAt) > new Date()
            const opensLabel = opensLater
              ? new Date(registrationOpensAt!).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) +
                ' · ' + new Date(registrationOpensAt!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              : null
            return (
              <div className="px-4 py-4 rounded-xl border border-border bg-card space-y-3">
                {(sessionPrice != null || sessionNotes) && (
                  <div className="space-y-0.5">
                    {sessionPrice != null && <p className="text-sm font-semibold">₱{sessionPrice}</p>}
                    {sessionNotes && <p className="text-xs text-muted-foreground">{sessionNotes}</p>}
                  </div>
                )}
                {opensLater ? (
                  <div className="w-full py-2.5 rounded-lg bg-muted text-muted-foreground text-sm font-semibold text-center">
                    Opens at {opensLabel}
                  </div>
                ) : (
                  <button
                    onClick={onRegister}
                    disabled={isRegistering}
                    className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold transition-opacity disabled:opacity-50"
                  >
                    {isRegistering ? 'Registering…' : 'Register for this session'}
                  </button>
                )}
              </div>
            )
          })()}
        </div>
      )}

      {!isLoading && resolvedId && sessionStatus !== 'registration_open' && (
        <div className="flex justify-end px-4 mt-2">
          <Link
            to={`/match-schedule/session/${resolvedId}?show=all`}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            All Matches ↗
          </Link>
        </div>
      )}

      {!isLoading && (playingMatch || (nextUpMatch && nextUpMatch.gameNumber <= 2)) && (
        <div className={`mx-4 mt-3 mb-1 px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 ${
          playingMatch ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
        }`}>
          {playingMatch
            ? "🏸 It's your turn! Please head to the court now."
            : "🏃 Your match is one of the first — late arrivals may result in fewer games played."}
        </div>
      )}

      {/*
        Every court in the session, whether or not you are on one. Your own card
        below shows only your game, so without this a player mid-game saw just
        their own court and a player between games saw none at all.
      */}
      {!isLoading && resolvedId && sessionStatus !== 'registration_open' && (
        <div className="max-w-sm mx-auto px-4 pt-4">
          <PlayerCourtTabs courts={courts} isLoading={courtsLoading} />
        </div>
      )}

      <div className="max-w-sm mx-auto px-4 py-4">
        <SessionProgress
          sessionPlayed={sessionMatchPlayed}
          sessionTotal={sessionMatchTotal}
          yourPlayed={matches.filter((m) => m.status === 'complete').length}
          yourTotal={matches.length}
        />

        {isLoading
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-[86px] rounded-xl bg-muted animate-pulse" />
            ))
          : matches.length === 0
          ? (
              <div className="text-center py-10 text-sm text-muted-foreground">
                No games scheduled for you in this session yet.
              </div>
            )
          : matches.map((m, i) => (
              // Your live game is already a full card in the court strip above,
              // so rendering it again here just duplicates a court.
              m.status === 'playing' ? null : (
                <PersonalGameCard
                  key={m.id}
                  match={m}
                  you={playerDisplayName}
                  yourAvatarUrl={playerAvatarUrl}
                  isNextUp={i === firstQueuedIndex}
                  promote={!playingMatch && i === firstQueuedIndex}
                />
              )
            ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Leaderboard tab
// ---------------------------------------------------------------------------
function LeaderboardTab({ sessionId }: { sessionId: string }) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      setEntries(await fetchLeaderboard(sessionId))
    } finally {
      setIsLoading(false)
    }
  }, [sessionId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const channel = supabase
      .channel(`session-leaderboard-rt-${sessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_results' }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [load, sessionId])

  if (isLoading) {
    return (
      <div className="max-w-sm mx-auto px-4 pt-6 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-14 bg-muted rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="max-w-sm mx-auto px-4 pt-6 pb-10 space-y-6">
      {entries.length === 0 ? (
        <p className="text-muted-foreground text-sm">No games completed yet.</p>
      ) : (
        <>
          <div className="space-y-2">
            {entries.map((entry, i) => (
              <div key={entry.playerId} className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3">
                <span className="text-sm font-bold text-muted-foreground w-5 text-center shrink-0">{RANK_ICON(i)}</span>
                <Avatar url={entry.avatarUrl} name={entry.displayName} size={28} />
                <span className="flex-1 font-medium text-sm truncate">{entry.displayName}</span>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-primary">{entry.winRate}%</p>
                  <p className="text-xs text-muted-foreground">{entry.wins}W {entry.games - entry.wins}L</p>
                </div>
              </div>
            ))}
          </div>

        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------
type Tab = 'schedule' | 'allmatches' | 'leaderboard'

const TAB_LABELS: Record<Tab, string> = {
  schedule: 'Schedule',
  allmatches: 'All matches',
  leaderboard: 'Leaderboard',
}

export function SessionPlayerDetailView() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('schedule')
  const [nameSlug, setNameSlug] = useState<string | null>(null)
  const [slugLoading, setSlugLoading] = useState(true)

  const [isRegistered, setIsRegistered] = useState(false)
  const [isRegistering, setIsRegistering] = useState(false)
  const [paid, setPaid] = useState<boolean | null>(null)
  const [sessionStatus, setSessionStatus] = useState<string | null>(null)
  const [sessionPrice, setSessionPrice] = useState<number | null>(null)
  const [sessionNotes, setSessionNotes] = useState<string | null>(null)
  const [registrationOpensAt, setRegistrationOpensAt] = useState<string | null>(null)

  useEffect(() => {
    if (!user) { setSlugLoading(false); return }
    supabase.from('profiles').select('name_slug').eq('id', user.id).maybeSingle().then(({ data }) => {
      setNameSlug((data as { name_slug: string | null } | null)?.name_slug ?? null)
      setSlugLoading(false)
    })
  }, [user])

  // Fetch registration status + session info
  useEffect(() => {
    if (!sessionId || !user) return
    Promise.all([
      supabase.from('sessions').select('status, price, session_notes, registration_opens_at').eq('id', sessionId).maybeSingle(),
      supabase.from('session_registrations').select('player_id, paid').eq('session_id', sessionId).eq('player_id', user.id).maybeSingle(),
    ]).then(([sessionRes, regRes]) => {
      const s = sessionRes.data as { status: string; price: number | null; session_notes: string | null; registration_opens_at: string | null } | null
      const r = regRes.data as { player_id: string; paid: boolean | null } | null
      setSessionStatus(s?.status ?? null)
      setSessionPrice(s?.price ?? null)
      setSessionNotes(s?.session_notes ?? null)
      setRegistrationOpensAt(s?.registration_opens_at ?? null)
      setIsRegistered(r != null)
      setPaid(r?.paid ?? null)
    })
  }, [sessionId, user])

  // When an admin confirms payment, the player's card should follow without a
  // manual reload. session_registrations is already in the realtime publication
  // (072), and RLS scopes the event to this player's own row.
  useEffect(() => {
    if (!sessionId || !user) return
    const channel = supabase
      .channel(`my-registration:${sessionId}:${user.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'session_registrations',
        filter: `session_id=eq.${sessionId}`,
      }, () => {
        supabase
          .from('session_registrations')
          .select('player_id, paid')
          .eq('session_id', sessionId)
          .eq('player_id', user.id)
          .maybeSingle()
          .then(({ data }) => {
            const r = data as { player_id: string; paid: boolean | null } | null
            setIsRegistered(r != null)
            setPaid(r?.paid ?? null)
          })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [sessionId, user])

  async function handleRegister() {
    if (!sessionId || !user || isRegistering) return
    setIsRegistering(true)
    const { error } = await supabase
      .from('session_registrations')
      .insert({ session_id: sessionId, player_id: user.id })
    if (error) {
      if (error.message.includes('session_full')) {
        toast.error('Session is full — no more slots available.')
      } else if (error.code === '42501' || error.message.toLowerCase().includes('violates row-level security')) {
        toast.error('Registration is not open yet.')
      } else {
        toast.error(error.message)
      }
    } else {
      setIsRegistered(true)
    }
    setIsRegistering(false)
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Tab bar */}
      <div className="flex justify-center items-center gap-1 px-4 py-3 border-b border-border">
        <div className="flex gap-1">
          {(['schedule', 'allmatches', 'leaderboard'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`relative px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                tab === t
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {tab === 'schedule' && (
        slugLoading ? (
          <div className="max-w-sm mx-auto px-4 pt-6 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-14 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        ) : nameSlug && sessionId ? (
          <ScheduleTab
            nameSlug={nameSlug}
            sessionId={sessionId}
            playerId={user?.id}
            sessionStatus={sessionStatus}
            isRegistered={isRegistered}
            isRegistering={isRegistering}
            paid={paid}
            sessionPrice={sessionPrice}
            sessionNotes={sessionNotes}
            registrationOpensAt={registrationOpensAt}
            onRegister={handleRegister}
          />
        ) : (
          <div className="h-48 flex items-center justify-center">
            <p className="text-muted-foreground text-sm">No schedule found for your account.</p>
          </div>
        )
      )}

      {tab === 'allmatches' && sessionId && (
        <AllMatchesView sessionId={sessionId} embedded />
      )}

      {tab === 'leaderboard' && sessionId && (
        <LeaderboardTab sessionId={sessionId} />
      )}
    </div>
  )
}

export default SessionPlayerDetailView
