/**
 * The Settings list of players who are never asked to give cheers (migration 094): no cheer screen and
 * no reminder bar — see PlayerLayout. For a one-off substitute's login. Takes effect the next time the
 * player opens the app.
 */

import { PlayerListCard } from '@/components/PlayerListCard'

export function NoCheersCard() {
  return (
    <PlayerListCard
      table="no_cheer_players"
      title="No cheers"
      description="Never asked to give cheers, for a one-off substitute's login. Cheers they already gave stay, and other players still cheer them. Saved as soon as you change it."
      emptyText="Nobody. Everyone who plays gives cheers."
      addLabel="Add a player who doesn't give cheers"
      addedMessage={(name) => `${name} won't be asked to give cheers`}
      removedMessage={(name) => `${name} gives cheers again`}
    />
  )
}

export default NoCheersCard
