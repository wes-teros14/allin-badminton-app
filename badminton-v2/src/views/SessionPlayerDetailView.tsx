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
import { usePlayerSchedule } from '@/hooks/usePlayerSchedule'
import { usePaymentSettings } from '@/hooks/usePaymentSettings'
import { useRealtime } from '@/hooks/useRealtime'
import { useSessionReceipts, signReceiptUrls, type SessionReceipt } from '@/hooks/useSessionReceipts'
import { GameCard } from '@/components/GameCard'
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
  const { matches, playerDisplayName, sessionName, sessionDate, sessionVenue, sessionTime, sessionDuration, sessionId: resolvedId, isLoading, refresh } = usePlayerSchedule(nameSlug, sessionId)
  const { status } = useRealtime(resolvedId, refresh)
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

      {/* Payment info banner — shown whenever registered + unpaid + configured,
          regardless of session status (a player may still owe payment after
          registration closes, schedule locks, or the session starts) */}
      {isRegistered && showPaymentInfo && (
        <div className="max-w-sm mx-auto px-4 mt-3">
          <div className="px-4 py-4 rounded-xl border border-primary/20 bg-primary/10 space-y-3">
            <p className="text-sm font-semibold text-foreground">You&apos;re registered! GCash payment details below:</p>
            {phoneNumber && (
              <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-card border border-border">
                <span className="text-sm font-medium">{phoneNumber}</span>
                <button
                  onClick={handleCopyPhone}
                  className="text-xs font-semibold text-primary hover:underline shrink-0"
                >
                  Copy
                </button>
              </div>
            )}
            {qrCodeUrl && (
              <img
                src={qrCodeUrl}
                alt="Payment QR code"
                className="w-40 h-40 object-contain rounded-lg border border-border mx-auto"
                onError={(e) => { e.currentTarget.style.display = 'none' }}
              />
            )}
            <p className="text-xs text-muted-foreground">Once sent, please upload your receipt below so I can confirm it. I don&apos;t monitor GCash directly.</p>

            {/* Receipt upload — one combined action for image + note */}
            <div className="pt-1 border-t border-primary/20 space-y-2">
              {paymentState === 'submitted' && (
                <p className="text-xs font-semibold text-amber-600 dark:text-amber-500">
                  🟠 Receipt submitted — awaiting confirmation
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
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                <Paperclip className="w-4 h-4" />
                {receipts.length > 0 ? 'Add another receipt' : 'Add receipt + note'}
              </button>

              {receipts.length > 0 && receipts.length < MAX_RECEIPTS_PER_SESSION && (
                <p className="text-[11px] text-center text-muted-foreground">
                  {receipts.length} of {MAX_RECEIPTS_PER_SESSION} submitted
                </p>
              )}
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

      <div className="max-w-sm mx-auto px-4 py-4 flex flex-col gap-3">
        {isLoading
          ? Array.from({ length: 3 }).map((_, i) => (
              <GameCard key={i} gameNumber={0} partnerNameSlug="" opp1NameSlug="" opp2NameSlug="" status="queued" isNextUp={false} isLoading />
            ))
          : matches.length === 0
          ? (
              <div className="text-center py-10 text-sm text-muted-foreground">
                No games scheduled for you in this session yet.
              </div>
            )
          : matches.map((m, i) => (
              <GameCard
                key={m.id}
                gameNumber={m.gameNumber}
                partnerNameSlug={m.partnerNameSlug}
                opp1NameSlug={m.opp1NameSlug}
                opp2NameSlug={m.opp2NameSlug}
                partnerAvatarUrl={m.partnerAvatarUrl}
                opp1AvatarUrl={m.opp1AvatarUrl}
                opp2AvatarUrl={m.opp2AvatarUrl}
                status={m.status}
                isNextUp={i === firstQueuedIndex}
                outcome={m.outcome}
                won={m.won}
              />
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
type Tab = 'schedule' | 'leaderboard'

const TAB_LABELS: Record<Tab, string> = {
  schedule: 'Schedule',
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
          {(['schedule', 'leaderboard'] as Tab[]).map((t) => (
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

      {tab === 'leaderboard' && sessionId && (
        <LeaderboardTab sessionId={sessionId} />
      )}
    </div>
  )
}

export default SessionPlayerDetailView
