import { Link } from 'react-router'
import { Card, CardContent } from '@/components/ui/card'
import { usePlayers } from '@/hooks/usePlayers'

const LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

export function PlayersView() {
  const { players, isLoading, updatePlayer } = usePlayers()

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-primary">Players ({players.length})</h1>
        <Link to="/admin" className="text-sm text-muted-foreground hover:text-foreground transition-colors">← Admin</Link>
      </div>

      <Card>
        <CardContent className="pt-4 px-3">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 bg-muted rounded animate-pulse" />
              ))}
            </div>
          ) : players.length === 0 ? (
            <p className="text-sm text-muted-foreground">No players yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground uppercase tracking-wide">
                    <th className="text-left py-2 pr-3 font-medium">Name</th>
                    <th className="text-left py-2 pr-3 font-medium">Email</th>
                    <th className="text-left py-2 pr-3 font-medium">Nickname</th>
                    <th className="text-left py-2 pr-3 font-medium">Gender</th>
                    <th className="text-left py-2 font-medium">Level</th>
                  </tr>
                </thead>
                <tbody>
                  {players.map((player) => (
                    <tr key={player.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="py-2 pr-3 font-medium max-w-[150px] truncate">{player.nameSlug}</td>
                      <td className="py-2 pr-3 text-muted-foreground text-xs max-w-[180px] truncate">{player.email ?? '—'}</td>
                      <td className="py-2 pr-3 text-muted-foreground text-xs">{player.nickname ?? '—'}</td>
                      <td className="py-2 pr-3">
                        <div className="flex rounded overflow-hidden border text-xs w-fit">
                          {(['M', 'F'] as const).map((g) => (
                            <button
                              key={g}
                              onClick={() => updatePlayer(player.id, { gender: player.gender === g ? null : g })}
                              className={`px-2 py-1 transition-colors ${
                                player.gender === g
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-background text-muted-foreground hover:bg-muted'
                              }`}
                            >
                              {g}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="py-2">
                        <select
                          value={player.level ?? ''}
                          onChange={(e) => updatePlayer(player.id, { level: e.target.value ? +e.target.value : null })}
                          className="h-7 rounded border border-input bg-background text-foreground px-1 text-xs w-14"
                        >
                          <option value="">—</option>
                          {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default PlayersView
