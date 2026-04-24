import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useRoster } from '@/hooks/useRoster'

interface Props {
  sessionId: string
  editable?: boolean
  paymentOnly?: boolean
}

const LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

export function RosterPanel({ sessionId, editable = false, paymentOnly = false }: Props) {
  const { players, unregisteredPlayers, isLoading, addPlayer, removePlayer, updateSessionOverride, updatePaid } =
    useRoster(sessionId)
  const [open, setOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [pendingRemove, setPendingRemove] = useState<string | null>(null)
  const removeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleRemoveClick(registrationId: string) {
    if (pendingRemove !== registrationId) {
      if (removeTimerRef.current) clearTimeout(removeTimerRef.current)
      setPendingRemove(registrationId)
      removeTimerRef.current = setTimeout(() => setPendingRemove(null), 3000)
    } else {
      if (removeTimerRef.current) clearTimeout(removeTimerRef.current)
      setPendingRemove(null)
      removePlayer(registrationId)
    }
  }

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading roster…</div>

  if (paymentOnly) {
    const paidCount = players.filter((p) => p.paid).length
    const unpaidCount = players.filter((p) => !p.paid).length
    return (
      <Card>
        <CardHeader className="cursor-pointer select-none" onClick={() => setOpen((v) => !v)}>
          <CardTitle className="flex items-center justify-between text-sm font-semibold">
            <span>Payment Status — {paidCount} paid · {unpaidCount} unpaid</span>
            <span className="text-muted-foreground">{open ? '▲' : '▼'}</span>
          </CardTitle>
        </CardHeader>
        {open && (
          <CardContent>
            {players.length === 0 ? (
              <p className="text-sm text-muted-foreground">No players registered.</p>
            ) : (
              <ul className="space-y-2">
                {players.map((player) => (
                  <li key={player.registrationId} className="flex items-center gap-2 text-sm rounded-md border px-3 py-2">
                    <span className="flex-1 truncate font-medium">{player.nickname ?? player.nameSlug}</span>
                    <div className="flex rounded overflow-hidden border text-xs shrink-0">
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
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        )}
      </Card>
    )
  }

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
      {open && <CardContent className="pt-2 pb-3 px-3">
        {players.length === 0 ? (
          <p className="text-sm text-muted-foreground">No players registered yet.</p>
        ) : (
          <ul>
            {players.map((player) => (
              <li key={player.registrationId} className="flex items-center gap-2 text-xs border-b last:border-0 py-1">
                <span className="flex-1 truncate font-medium min-w-0">{player.nickname ?? player.nameSlug}</span>

                {!editable && player.gender && (
                  <span className="text-muted-foreground shrink-0">{player.gender}</span>
                )}
                {!editable && player.level && (
                  <span className="text-muted-foreground shrink-0">L{player.level}</span>
                )}

                {editable && (
                  <>
                    <div className="flex rounded overflow-hidden border shrink-0">
                      {(['M', 'F'] as const).map((g) => (
                        <button
                          key={g}
                          onClick={() => updateSessionOverride(player.registrationId, g, player.level)}
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

                    <select
                      value={player.level ?? ''}
                      onChange={(e) => updateSessionOverride(player.registrationId, player.gender, e.target.value ? +e.target.value : null)}
                      className="h-6 rounded border border-input bg-background text-foreground px-1 w-11 shrink-0"
                    >
                      <option value="">—</option>
                      {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                    </select>

                    <div className="flex rounded overflow-hidden border shrink-0">
                      {([true, false] as const).map((p) => (
                        <button
                          key={String(p)}
                          onClick={() => updatePaid(player.registrationId, p)}
                          className={`px-1.5 py-0.5 transition-colors ${
                            player.paid === p
                              ? p ? 'bg-green-600 text-white' : 'bg-destructive text-white'
                              : 'bg-background text-muted-foreground hover:bg-muted'
                          }`}
                        >
                          {p ? 'Pd' : 'Unpd'}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                <button
                  onClick={() => handleRemoveClick(player.registrationId)}
                  className={`shrink-0 px-1.5 py-0.5 rounded text-xs transition-colors ${
                    pendingRemove === player.registrationId
                      ? 'bg-destructive text-white'
                      : 'text-destructive hover:bg-destructive/10'
                  }`}
                >
                  {pendingRemove === player.registrationId ? 'Sure?' : '✕'}
                </button>
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
