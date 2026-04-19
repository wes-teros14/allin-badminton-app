import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { useAuth } from '@/hooks/useAuth'
import { useProfileStats } from '@/hooks/useProfileStats'
import { useNotifications } from '@/contexts/NotificationContext'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

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

async function fetchAwards(userId: string): Promise<Award[]> {
  const [cheerRes, statsRes, regsRes] = await Promise.all([
    supabase.from('player_cheer_stats').select('player_id, cheers_received, cheers_given, offense_received, defense_received, technique_received, movement_received, good_sport_received, solid_effort_received'),
    supabase.from('player_stats').select('player_id, sessions_attended'),
    supabase.from('session_registrations').select('session_id, player_id, registered_at').eq('source', 'self').order('registered_at', { ascending: true }),
  ])

  const cheers = (cheerRes.data ?? []) as Array<{ player_id: string; cheers_received: number; cheers_given: number; offense_received: number; defense_received: number; technique_received: number; movement_received: number; good_sport_received: number; solid_effort_received: number }>
  const stats = (statsRes.data ?? []) as Array<{ player_id: string; sessions_attended: number }>
  const regs = (regsRes.data ?? []) as Array<{ session_id: string; player_id: string; registered_at: string }>

  // Count how many times each player was first to register (self-registered only)
  const firstRegistrantCount = new Map<string, number>()
  const seenSessions = new Set<string>()
  for (const r of regs) {
    if (!seenSessions.has(r.session_id)) {
      seenSessions.add(r.session_id)
      firstRegistrantCount.set(r.player_id, (firstRegistrantCount.get(r.player_id) ?? 0) + 1)
    }
  }

  function top(arr: Array<{ player_id: string; value: number }>): string | null {
    if (arr.length === 0) return null
    const sorted = [...arr].sort((a, b) => b.value - a.value)
    if (sorted[0].value === 0) return null
    if (sorted.length > 1 && sorted[0].value === sorted[1].value) return null
    return sorted[0].player_id
  }

  const earlyBirdEntries = Array.from(firstRegistrantCount.entries()).map(([player_id, value]) => ({ player_id, value }))

  const STREAK_EXCLUDED = new Set(['d3def74c-7367-4553-af30-eaa58e45ddb7', '8e48d7bf-c7dc-45a5-a468-7ee9b81db677'])
  const cheerFiltered = cheers.filter(c => !STREAK_EXCLUDED.has(c.player_id))

  const awards: Award[] = []

  if (top(cheerFiltered.map(c => ({ player_id: c.player_id, value: c.cheers_received }))) === userId)
    awards.push({ emoji: '🌟', label: 'Most Cheers Received' })
  if (top(cheerFiltered.map(c => ({ player_id: c.player_id, value: c.cheers_given }))) === userId)
    awards.push({ emoji: '🙌', label: 'Most Cheers Given' })
  if (top(cheers.map(c => ({ player_id: c.player_id, value: c.offense_received }))) === userId)
    awards.push({ emoji: '⚔️', label: 'Top Offense' })
  if (top(cheers.map(c => ({ player_id: c.player_id, value: c.defense_received }))) === userId)
    awards.push({ emoji: '🛡️', label: 'Top Defense' })
  if (top(cheers.map(c => ({ player_id: c.player_id, value: c.technique_received }))) === userId)
    awards.push({ emoji: '🎯', label: 'Top Technique' })
  if (top(cheers.map(c => ({ player_id: c.player_id, value: c.movement_received }))) === userId)
    awards.push({ emoji: '💨', label: 'Top Movement' })
  if (top(cheers.map(c => ({ player_id: c.player_id, value: c.good_sport_received }))) === userId)
    awards.push({ emoji: '🤝', label: 'Top Good Sport' })
  if (top(cheers.map(c => ({ player_id: c.player_id, value: c.solid_effort_received }))) === userId)
    awards.push({ emoji: '💪', label: 'Top Solid Effort' })
  if (top(stats.map(s => ({ player_id: s.player_id, value: s.sessions_attended }))) === userId)
    awards.push({ emoji: '📅', label: 'Most Sessions Joined' })
  if (top(earlyBirdEntries) === userId)
    awards.push({ emoji: '🐦', label: 'Registration Early Bird' })

  return awards
}

export function ProfileView() {
  const { user, isLoading: authLoading } = useAuth()
  const { stats, isLoading: statsLoading, refresh } = useProfileStats(user?.id)
  const { markAllRead } = useNotifications()
  const [nickname, setNickname] = useState('')
  const [editingNickname, setEditingNickname] = useState(false)
  const [savingNickname, setSavingNickname] = useState(false)
  const [cheerStats, setCheerStats] = useState<CheerStats | null>(null)
  const [awards, setAwards] = useState<Award[]>([])

  // Mark notifications as read when visiting profile
  useEffect(() => { markAllRead() }, [markAllRead])

  useEffect(() => {
    if (!user) return
    supabase.from('profiles').select('nickname').eq('id', user.id).maybeSingle()
      .then(({ data }) => { if (data) setNickname((data as any).nickname ?? '') })
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
      <div>
        <h1 className="text-lg font-semibold">{displayName}</h1>
        <p className="text-sm text-muted-foreground">{user.email}</p>
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

      {/* Sign out */}
      <button
        onClick={() => supabase.auth.signOut()}
        className="w-full py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-destructive hover:border-destructive transition-colors"
      >
        Sign out
      </button>

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

      {/* Cheers */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Cheers</h2>
        {cheerStats ? (
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Received" value={String(cheerStats.cheers_received)} />
            <StatCard label="Given" value={String(cheerStats.cheers_given)} />
            {[
              { label: '⚔️ Fierce Offense',   val: cheerStats.offense_received },
              { label: '🛡️ Iron Defense',     val: cheerStats.defense_received },
              { label: '🎯 Smooth Technique', val: cheerStats.technique_received },
              { label: '💨 Swift Movement',   val: cheerStats.movement_received },
              { label: '🤝 Good Sport', val: cheerStats.good_sport_received },
              { label: '💪 Solid Effort', val: cheerStats.solid_effort_received },
            ]
              .filter(t => t.val > 0)
              .map(t => (
                <StatCard key={t.label} label={t.label} value={String(t.val)} />
              ))
            }
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No cheers yet — join a session!</p>
        )}
      </div>

    </div>
  )
}

export default ProfileView
