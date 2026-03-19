import { Link } from 'react-router'
import { Card, CardContent } from '@/components/ui/card'
import { useAuth } from '@/hooks/useAuth'
import { useProfileStats } from '@/hooks/useProfileStats'

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

export function ProfileView() {
  const { user, role, isLoading: authLoading } = useAuth()
  const { stats, isLoading: statsLoading } = useProfileStats(user?.id)

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

      {/* Stats */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Stats</h2>
        {statsLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />
            ))}
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
            <StatCard
              label="Best Partner"
              value={stats.bestPartner?.nameSlug ?? '—'}
              sub={stats.bestPartner ? `${stats.bestPartner.wins} wins together` : undefined}
            />
            <StatCard
              label="Toughest Opponent"
              value={stats.toughestOpponent?.nameSlug ?? '—'}
              sub={stats.toughestOpponent ? `Lost ${stats.toughestOpponent.losses}x against them` : undefined}
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
