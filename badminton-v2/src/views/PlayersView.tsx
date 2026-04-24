import { useState } from 'react'
import { Link } from 'react-router'
import { Card, CardContent } from '@/components/ui/card'
import { usePlayers } from '@/hooks/usePlayers'

const LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

function NicknameCell({ id, initial, onSave }: { id: string; initial: string | null; onSave: (id: string, val: string | null) => Promise<void> }) {
  const [value, setValue] = useState(initial ?? '')
  const [saving, setSaving] = useState(false)
  const dirty = value !== (initial ?? '')

  async function handleBlur() {
    if (!dirty) return
    setSaving(true)
    await onSave(id, value.trim() || null)
    setSaving(false)
  }

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={handleBlur}
      placeholder="—"
      disabled={saving}
      className="h-6 w-24 rounded border border-transparent bg-transparent px-1 text-xs text-foreground placeholder:text-muted-foreground hover:border-input focus:border-input focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 transition-colors"
    />
  )
}

export function PlayersView() {
  const { players, isLoading, updatePlayer, setActive } = usePlayers()

  async function saveNickname(id: string, nickname: string | null) {
    await updatePlayer(id, { nickname })
  }

  const activeCount = players.filter((p) => p.isActive).length

  const sortedPlayers = [...players].sort((a, b) => {
    // 1. Active before inactive
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1
    // 2. Has nickname before no nickname
    const aNick = a.nickname !== null
    const bNick = b.nickname !== null
    if (aNick !== bNick) return aNick ? -1 : 1
    // 3. Alphabetical by nickname then nameSlug
    return (a.nickname ?? a.nameSlug).localeCompare(b.nickname ?? b.nameSlug)
  })

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-primary">
          Players ({activeCount} active{players.length !== activeCount ? `, ${players.length - activeCount} inactive` : ''})
        </h1>
        <Link to="/admin" className="text-sm text-muted-foreground hover:text-foreground transition-colors">← Admin</Link>
      </div>

      <Card>
        <CardContent className="pt-2 px-2 pb-2">
          {isLoading ? (
            <div className="space-y-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-7 bg-muted rounded animate-pulse" />
              ))}
            </div>
          ) : players.length === 0 ? (
            <p className="text-sm text-muted-foreground">No players yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-[10px] text-muted-foreground uppercase tracking-wide">
                    <th className="text-left py-1 pr-2 font-medium">Name</th>
                    <th className="text-left py-1 pr-2 font-medium">Email</th>
                    <th className="text-left py-1 pr-2 font-medium">Nickname</th>
                    <th className="text-left py-1 pr-2 font-medium">G</th>
                    <th className="text-left py-1 pr-2 font-medium">Lvl</th>
                    <th className="text-left py-1 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPlayers.map((player) => (
                    <tr key={player.id} className={`border-b last:border-0 transition-colors ${player.isActive ? 'hover:bg-muted/30' : 'opacity-40'}`}>
                      <td className="py-1 pr-2 font-medium max-w-[120px] truncate">{player.nameSlug}</td>
                      <td className="py-1 pr-2 text-muted-foreground max-w-[160px] truncate">{player.email ?? '—'}</td>
                      <td className="py-1 pr-2">
                        <NicknameCell id={player.id} initial={player.nickname} onSave={saveNickname} />
                      </td>
                      <td className="py-1 pr-2">
                        <div className="flex rounded overflow-hidden border w-fit">
                          {(['M', 'F'] as const).map((g) => (
                            <button
                              key={g}
                              onClick={() => updatePlayer(player.id, { gender: player.gender === g ? null : g })}
                              className={`px-1.5 py-0.5 transition-colors ${
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
                      <td className="py-1 pr-2">
                        <select
                          value={player.level ?? ''}
                          onChange={(e) => updatePlayer(player.id, { level: e.target.value ? +e.target.value : null })}
                          className="h-6 rounded border border-input bg-background text-foreground px-1 w-12"
                        >
                          <option value="">—</option>
                          {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                        </select>
                      </td>
                      <td className="py-1">
                        <button
                          onClick={() => setActive(player.id, !player.isActive)}
                          className={`px-1.5 py-0.5 rounded transition-colors ${
                            player.isActive
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-muted-foreground hover:bg-muted/70'
                          }`}
                        >
                          {player.isActive ? 'Active' : 'Inactive'}
                        </button>
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
