import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useRoster } from '@/hooks/useRoster'

interface Props {
  sessionId: string
}

export function RosterPanel({ sessionId }: Props) {
  const { players, unregisteredPlayers, isLoading, addPlayer, removePlayer } =
    useRoster(sessionId)

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading roster…</div>

  return (
    <Card>
      <CardHeader>
        <CardTitle>Roster ({players.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Registered players */}
        {players.length === 0 ? (
          <p className="text-sm text-muted-foreground">No players registered yet.</p>
        ) : (
          <ul className="space-y-2">
            {players.map((player) => (
              <li key={player.registrationId} className="flex items-center justify-between text-sm">
                <span>{player.nameSlug}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removePlayer(player.registrationId)}
                  className="text-destructive hover:text-destructive"
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
            <p className="text-xs text-muted-foreground mb-2">Add player:</p>
            <ul className="space-y-1">
              {unregisteredPlayers.map((player) => (
                <li key={player.id} className="flex items-center justify-between text-sm">
                  <span>{player.nameSlug}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => addPlayer(player.id)}
                  >
                    Add
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
