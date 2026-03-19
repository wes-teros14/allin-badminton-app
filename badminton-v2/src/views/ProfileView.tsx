import { useState, useEffect } from 'react'
import { Link } from 'react-router'
import { Card, CardContent } from '@/components/ui/card'
import { useAuth } from '@/hooks/useAuth'
import { useProfileStats } from '@/hooks/useProfileStats'
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

export function ProfileView() {
  const { user, role, isLoading: authLoading } = useAuth()
  const { stats, isLoading: statsLoading } = useProfileStats(user?.id)
  const [nickname, setNickname] = useState('')
  const [savingNickname, setSavingNickname] = useState(false)

  useEffect(() => {
    if (!user) return
    supabase.from('profiles').select('nickname').eq('id', user.id).maybeSingle()
      .then(({ data }) => { if (data) setNickname((data as any).nickname ?? '') })
  }, [user?.id])

  async function handleSaveNickname() {
    if (!user) return
    setSavingNickname(true)
    const { error } = await supabase.from('profiles').update({ nickname: nickname.trim() || null } as never).eq('id', user.id)
    if (error) toast.error(error.message)
    else toast.success('Nickname saved')
    setSavingNickname(false)
  }

  if (authLoading) return <div className="p-6">Loading…</div>

  if (!user) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-3">
        <p className="text-muted-foreground">Please sign in to view your profile.</p>
        <Link to="/" className="text-sm text-primary hover:underline">← Back</Link>
      </div>
    )
  }

  const displayName = (user.user_metadata?.full_name as string | undefined) ?? user.email ?? 'Player'

  return (
    <div className="p-6 max-w-lg mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{displayName}</h1>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">← Home</Link>
      </div>

      {/* Nickname */}
      <div className="flex items-center gap-2">
        <input
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
              value={stats.gamesPlayed > 0 ? `${stats.winRate}%` : '—'}
              sub={stats.gamesPlayed > 0 ? `${stats.wins} / ${stats.gamesPlayed} wins` : 'No recorded games'}
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

      {role === 'admin' && (
        <Link
          to="/admin"
          className="block w-full text-center py-3 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors"
        >
          Go to Admin
        </Link>
      )}
    </div>
  )
}

export default ProfileView
