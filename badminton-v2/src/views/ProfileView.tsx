import { useState, useEffect, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { useAuth } from '@/hooks/useAuth'
import { useProfileStats } from '@/hooks/useProfileStats'
import { useNotifications } from '@/contexts/NotificationContext'
import { supabase } from '@/lib/supabase'
import { ATTENDANCE_AWARD_EXCLUDED, fetchEligiblePlayerIds } from '@/lib/boardEligibility'
import { cheerSharePct, rankCheerShares } from '@/lib/cheerShare'
import { CHEER_CATEGORIES, signatureCheer } from '@/lib/cheerTypes'
import { resizeImageFile } from '@/lib/imageResize'
import { toast } from 'sonner'
import { Avatar } from '@/components/Avatar'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useTheme } from '@/contexts/ThemeContext'
import { Camera } from 'lucide-react'

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">{label}</p>
        <p className="text-2xl font-bold text-primary">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  )
}

/**
 * What this player is cheered for: their strongest cheer type, and a bar
 * showing how their received cheers split across all six.
 *
 * A share rather than a count, for the same reason the boards are — cheering
 * is compulsory after every game, so a raw total only says how many matches
 * someone played. The segments add to 100% by construction: the trigger in
 * migration 036 increments `cheers_received` and exactly one category per row.
 */
function CheerSignature({ stats }: { stats: CheerStats | null }) {
  if (!stats || stats.cheers_received <= 0) return null

  const signature = signatureCheer(stats)
  if (!signature) return null

  return (
    <div>
      <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
        Cheered for
      </h2>
      <Card>
        <CardContent className="pt-4 pb-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl leading-none" aria-hidden="true">{signature.emoji}</span>
            <div className="flex-1 min-w-0">
              <p className="truncate text-[15px] font-semibold leading-tight">{signature.name}</p>
              <p className="text-xs text-muted-foreground tabular-nums">
                of {stats.cheers_received} cheers received
              </p>
            </div>
            <span className="shrink-0 text-[17px] font-bold text-primary tabular-nums">
              {cheerSharePct(signature.of(stats), stats.cheers_received)}%
            </span>
          </div>

          <div
            className="flex h-2.5 overflow-hidden rounded-full bg-secondary"
            role="img"
            aria-label={CHEER_CATEGORIES
              .filter((c) => c.of(stats) > 0)
              .map((c) => `${c.name} ${cheerSharePct(c.of(stats), stats.cheers_received)} percent`)
              .join(', ')}
          >
            {CHEER_CATEGORIES.map((category) => {
              const pct = cheerSharePct(category.of(stats), stats.cheers_received)
              if (pct <= 0) return null
              return (
                <span
                  key={category.slug}
                  style={{ width: `${pct}%`, backgroundColor: category.color }}
                  className="h-full"
                />
              )
            })}
          </div>

          <div className="flex flex-wrap gap-x-3 gap-y-1.5">
            {CHEER_CATEGORIES.filter((c) => c.of(stats) > 0).map((category) => (
              <span key={category.slug} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span
                  className="h-2 w-2 shrink-0 rounded-[2px]"
                  style={{ backgroundColor: category.color }}
                  aria-hidden="true"
                />
                {category.emoji} {category.name}
                <span className="font-semibold text-foreground tabular-nums">
                  {cheerSharePct(category.of(stats), stats.cheers_received)}%
                </span>
              </span>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

const RANK_LABELS = ['🥇', '🥈', '🥉']

function RankListCard({ label, items, subLabel }: {
  label: string
  items: Array<{ nameSlug: string; count: number }>
  subLabel: (count: number) => string
}) {
  return (
    <Card className="col-span-2">
      <CardContent className="pt-5 pb-4">
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-3">{label}</p>
        {items.length === 0 ? (
          <p className="text-2xl font-bold text-primary">—</p>
        ) : (
          <ul className="space-y-2">
            {items.map((item, i) => (
              <li key={i} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <span className="text-base">{RANK_LABELS[i]}</span>
                  <span className="font-semibold text-sm">{item.nameSlug}</span>
                </span>
                <span className="text-xs text-muted-foreground shrink-0">{subLabel(item.count)}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

interface CheerStats {
  cheers_received: number
  cheers_given: number
  offense_received: number
  defense_received: number
  technique_received: number
  movement_received: number
  good_sport_received: number
  solid_effort_received: number
}

interface Award {
  emoji: string
  label: string
}

interface NicknameRow {
  nickname: string | null
  avatar_url: string | null
}

const MAX_AVATAR_DIM = 1024
const MAX_AVATAR_BYTES = 1 * 1024 * 1024 // enforced after client-side resize/compression below
const MAX_AVATAR_INPUT_BYTES = 20 * 1024 * 1024 // reject absurdly large originals before we even try to process them

async function fetchAwards(userId: string): Promise<Award[]> {
  const latestSessionRes = await supabase
    .from('sessions')
    .select('id')
    .neq('status', 'setup')
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle()

  const latestSessionId = (latestSessionRes.data as { id: string } | null)?.id ?? null

  const [cheerRes, statsRes, earlyBirdRes, eligibleIds] = await Promise.all([
    supabase.from('player_cheer_stats').select('player_id, cheers_received, offense_received, defense_received, technique_received, movement_received, good_sport_received, solid_effort_received'),
    supabase.from('player_stats').select('player_id, sessions_attended'),
    latestSessionId
      ? supabase.from('session_registrations').select('player_id').eq('session_id', latestSessionId).eq('source', 'self').order('registered_at', { ascending: true }).limit(1).maybeSingle()
      : Promise.resolve({ data: null }),
    fetchEligiblePlayerIds(),
  ])

  // These badges must agree with the Awards tab exactly — a badge here that the
  // leaderboard does not show is a contradiction the reader cannot diagnose. So
  // the same eligibility, the same share ranking, and the same six awards.
  const cheers = ((cheerRes.data ?? []) as Array<{ player_id: string; cheers_received: number; offense_received: number; defense_received: number; technique_received: number; movement_received: number; good_sport_received: number; solid_effort_received: number }>)
    .filter(c => eligibleIds.has(c.player_id))
  const stats = ((statsRes.data ?? []) as Array<{ player_id: string; sessions_attended: number }>)
    .filter(s => eligibleIds.has(s.player_id))
  const earlyBirdPlayerId = (earlyBirdRes.data as { player_id: string } | null)?.player_id ?? null

  /** Sole holder of the highest share in one category, or nobody if it is tied. */
  function topShare(getCount: (c: typeof cheers[number]) => number): string | null {
    const ranked = rankCheerShares(
      cheers.map(c => ({ playerId: c.player_id, categoryCount: getCount(c), totalReceived: c.cheers_received })),
      { maxPlaces: 1 },
    )
    return ranked.length === 1 ? ranked[0].playerId : null
  }

  function top(arr: Array<{ player_id: string; value: number }>): string | null {
    if (arr.length === 0) return null
    const sorted = [...arr].sort((a, b) => b.value - a.value)
    if (sorted[0].value === 0) return null
    if (sorted.length > 1 && sorted[0].value === sorted[1].value) return null
    return sorted[0].player_id
  }

  const awards: Award[] = []

  if (topShare(c => c.offense_received) === userId)
    awards.push({ emoji: '⚔️', label: 'Top Offense' })
  if (topShare(c => c.defense_received) === userId)
    awards.push({ emoji: '🛡️', label: 'Top Defense' })
  if (topShare(c => c.technique_received) === userId)
    awards.push({ emoji: '🎯', label: 'Top Technique' })
  if (topShare(c => c.movement_received) === userId)
    awards.push({ emoji: '💨', label: 'Top Movement' })
  if (topShare(c => c.good_sport_received) === userId)
    awards.push({ emoji: '🤝', label: 'Top Good Sport' })
  if (topShare(c => c.solid_effort_received) === userId)
    awards.push({ emoji: '💪', label: 'Top Solid Effort' })
  // Same carve-out the Awards tab applies: this one award is still a raw count.
  if (top(stats.filter(s => !ATTENDANCE_AWARD_EXCLUDED.has(s.player_id)).map(s => ({ player_id: s.player_id, value: s.sessions_attended }))) === userId)
    awards.push({ emoji: '📅', label: 'Most Sessions Joined' })
  if (earlyBirdPlayerId === userId)
    awards.push({ emoji: '🐦', label: 'Registration Early Bird' })

  return awards
}

export function ProfileView() {
  const { user, isLoading: authLoading } = useAuth()
  const { stats, isLoading: statsLoading, refresh } = useProfileStats(user?.id)
  const { markAllRead } = useNotifications()
  const { theme } = useTheme()
  const [nickname, setNickname] = useState('')
  const [editingNickname, setEditingNickname] = useState(false)
  const [savingNickname, setSavingNickname] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [cheerStats, setCheerStats] = useState<CheerStats | null>(null)
  const [awards, setAwards] = useState<Award[]>([])

  // Mark notifications as read when visiting profile
  useEffect(() => { markAllRead() }, [markAllRead])

  useEffect(() => {
    if (!user) return
    supabase.from('profiles').select('nickname, avatar_url').eq('id', user.id).maybeSingle()
      .then(({ data }) => {
        if (!data) return
        const row = data as NicknameRow
        setNickname(row.nickname ?? '')
        setAvatarUrl(row.avatar_url)
      })
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) return
    supabase.from('player_cheer_stats').select('*').eq('player_id', user.id).maybeSingle()
      .then(({ data }) => { if (data) setCheerStats(data as CheerStats) })
    fetchAwards(user.id).then(setAwards)
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) return
    const channel = supabase
      .channel(`profile-stats-${user.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'player_stats',
        filter: `player_id=eq.${user.id}`,
      }, () => { refresh() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user?.id, refresh])

  async function handleSaveNickname() {
    if (!user) return
    setSavingNickname(true)
    const { error } = await supabase.from('profiles').update({ nickname: nickname.trim() || null } as never).eq('id', user.id)
    if (error) toast.error(error.message)
    else { toast.success('Nickname saved'); setEditingNickname(false) }
    setSavingNickname(false)
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !user) return

    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file')
      return
    }
    if (file.size > MAX_AVATAR_INPUT_BYTES) {
      toast.error('Image is too large')
      return
    }

    setUploadingAvatar(true)
    try {
      const resized = await resizeImageFile(file, MAX_AVATAR_DIM, MAX_AVATAR_BYTES)

      const path = `${user.id}/avatar`
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, resized, { upsert: true, cacheControl: '3600', contentType: 'image/jpeg' })
      if (uploadError) { toast.error(uploadError.message); return }

      const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(path)
      const bustedUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: bustedUrl } as never)
        .eq('id', user.id)
      if (updateError) { toast.error(updateError.message); return }

      setAvatarUrl(bustedUrl)
      toast.success('Profile picture updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to process image')
    } finally {
      setUploadingAvatar(false)
    }
  }

  if (authLoading) return <div className="p-6">Loading…</div>

  if (!user) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-3">
        <p className="text-muted-foreground">Please sign in to view your profile.</p>
      </div>
    )
  }

  const displayName = (user.user_metadata?.full_name as string | undefined) ?? user.email ?? 'Player'

  return (
    <div className="p-6 max-w-lg mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="relative shrink-0">
          <Avatar url={avatarUrl} name={displayName} size={72} />
          <button
            onClick={() => avatarInputRef.current?.click()}
            disabled={uploadingAvatar}
            title="Change profile picture"
            className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow disabled:opacity-50 hover:bg-primary/90 transition-colors"
          >
            <Camera className="h-3.5 w-3.5" />
          </button>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarChange}
          />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg font-semibold truncate">{displayName}</h1>
          <p className="text-sm text-muted-foreground truncate">{user.email}</p>
          {uploadingAvatar && <p className="text-xs text-muted-foreground mt-0.5">Uploading…</p>}
        </div>
      </div>

      {/* Nickname */}
      <div className="flex items-center gap-2">
        {editingNickname ? (
          <>
            <input
              autoFocus
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Add a nickname…"
              className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <button
              onClick={handleSaveNickname}
              disabled={savingNickname}
              className="px-4 h-9 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors shrink-0"
            >
              {savingNickname ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={() => setEditingNickname(false)}
              className="px-3 h-9 rounded-md border text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            onClick={() => setEditingNickname(true)}
            className="flex items-center gap-1.5 text-sm text-foreground hover:text-primary transition-colors"
            title="Edit nickname"
          >
            <span className="text-muted-foreground">Nickname: </span>
            <span>{nickname || <span className="text-muted-foreground">No nickname set</span>}</span>
            <span className="text-muted-foreground text-xs">edit</span>
          </button>
        )}
      </div>

      {/* Appearance */}
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border py-1.5 pl-4 pr-1.5">
        <div className="min-w-0">
          <p className="text-sm text-foreground">Appearance</p>
          <p className="text-xs text-muted-foreground">{theme === 'dark' ? 'Dark' : 'Light'}</p>
        </div>
        <ThemeToggle />
      </div>

      {/* Sign out */}
      <button
        onClick={() => supabase.auth.signOut()}
        className="w-full py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-destructive hover:border-destructive transition-colors"
      >
        Sign out
      </button>

      {/* What you're cheered for */}
      <CheerSignature stats={cheerStats} />

      {/* Awards */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Awards</h2>
        {awards.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {awards.map(a => (
              <div key={a.label} className="flex items-center gap-1.5 bg-[#FEFE6A]/10 border border-[#FEFE6A]/30 rounded-full px-3 py-1.5">
                <span className="text-base">{a.emoji}</span>
                <span className="text-xs font-semibold text-[#FEFE6A]">{a.label}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No awards yet — keep playing!</p>
        )}
      </div>

      {/* Stats */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Stats</h2>
        {statsLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />
            ))}
            <div className="col-span-2 h-24 bg-muted rounded-xl animate-pulse" />
            <div className="col-span-2 h-24 bg-muted rounded-xl animate-pulse" />
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="Sessions Attended"
              value={String(stats.sessionsAttended)}
            />
            <StatCard
              label="Games Played"
              value={String(stats.gamesPlayed)}
            />
            <StatCard
              label="Win Rate"
              value={stats.gamesPlayed > 0 ? `${stats.wins}W ${stats.gamesPlayed - stats.wins}L` : '—'}
              sub={stats.gamesPlayed > 0 && stats.winRate > 0 ? `${stats.winRate}% win rate` : 'No recorded games'}
            />
            <RankListCard
              label="Best Partners"
              items={stats.bestPartners.map(p => ({ nameSlug: p.nameSlug, count: p.wins }))}
              subLabel={(w) => `${w} win${w !== 1 ? 's' : ''} together`}
            />
            <RankListCard
              label="Toughest Opponents"
              items={stats.toughestOpponents.map(o => ({ nameSlug: o.nameSlug, count: o.losses }))}
              subLabel={(l) => `Lost ${l}x`}
            />
          </div>
        ) : null}
      </div>

    </div>
  )
}

export default ProfileView
