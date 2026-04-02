import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useRoster } from '@/hooks/useRoster'

interface Props {
  sessionId: string
  editable?: boolean
}

const LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

export function RosterPanel({ sessionId, editable = false }: Props) {
  const { players, unregisteredPlayers, isLoading, addPlayer, removePlayer, updateSessionOverride, updatePaid } =
    useRoster(sessionId)
  const [open, setOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading roster…</div>

  const maleCount = players.filter((p) => p.gender === 'M').length
  const femaleCount = players.filter((p) => p.gender === 'F').length

  return (
    <Card>
      <CardHeader className="cursor-pointer select-none" onClick={() => setOpen((v) => !v)}>
        <CardTitle className="flex items-center justify-between">
          <span>Roster ({players.length}), Male ({maleCount}), Female ({femaleCount})</span>
          <span className="text-sm text-muted-foreground">{open ? '▲' : '▼'}</span>
        </CardTitle>
      </CardHeader>
      {open && <CardContent className="space-y-4">
        {players.length === 0 ? (
          <p className="text-sm text-muted-foreground">No players registered yet.</p>
        ) : (
          <ul className="space-y-2">
            {players.map((player) => (
              <li key={player.registrationId} className="flex items-center gap-2 text-sm">
                <span className="flex-1 truncate">{player.nickname ?? player.nameSlug}</span>

                {editable && (
                  <>
                    {/* Gender toggle */}
                    <div className="flex rounded overflow-hidden border text-xs">
                      {(['M', 'F'] as const).map((g) => (
                        <button
                          key={g}
                          onClick={() => updateSessionOverride(player.registrationId, g, player.level)}
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

                    {/* Level select */}
                    <select
                      value={player.level ?? ''}
                      onChange={(e) => updateSessionOverride(player.registrationId, player.gender, e.target.value ? +e.target.value : null)}
                      className="h-7 rounded border border-input bg-background text-foreground px-1 text-xs w-14"
                    >
                      <option value="">Lvl</option>
                      {LEVELS.map((l) => (
                        <option key={l} value={l}>{l}</option>
                      ))}
                    </select>

                    {/* Paid toggle */}
                    <div className="flex rounded overflow-hidden border text-xs">
                      {([true, false] as const).map((p) => (
                        <button
                          key={String(p)}
                          onClick={() => updatePaid(player.registrationId, p)}
                          className={`px-2 py-1 transition-colors ${
                            player.paid === p
                              ? p ? 'bg-green-600 text-white' : 'bg-destructive text-white'
                              : 'bg-background text-muted-foreground hover:bg-muted'
                          }`}
                        >
                          {p ? 'Paid' : 'Unpaid'}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {!editable && player.gender && (
                  <span className="text-xs text-muted-foreground">{player.gender}</span>
                )}
                {!editable && player.level && (
                  <span className="text-xs text-muted-foreground">L{player.level}</span>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removePlayer(player.registrationId)}
                  className="text-destructive hover:text-destructive shrink-0"
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}

        {/* Add Player section */}
        {unregisteredPlayers.length > 0 && (
          <div className="border-t pt-3">
            <button
              className="flex items-center justify-between w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setAddOpen((v) => !v)}
            >
              <span>Add player ({unregisteredPlayers.length})</span>
              <span>{addOpen ? '▲' : '▼'}</span>
            </button>
            {addOpen && (
              <ul className="space-y-1 mt-2">
                {unregisteredPlayers.map((player) => (
                  <li key={player.id} className="flex items-center justify-between text-sm">
                    <span>{player.nickname ?? player.nameSlug}</span>
                    <Button variant="ghost" size="sm" onClick={() => addPlayer(player.id)}>Add</Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </CardContent>}
    </Card>
  )
}
