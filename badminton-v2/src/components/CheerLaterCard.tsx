/**
 * The Settings list of players who cheer later (migration 084). Their cheers
 * wait in a bar at the bottom of the screen instead of the full-page gate —
 * see PlayerLayout. Takes effect the next time the player opens the app.
 */

import { PlayerListCard } from '@/components/PlayerListCard'

export function CheerLaterCard() {
  return (
    <PlayerListCard
      table="cheer_later_players"
      title="Cheer later"
      description="Their cheers wait in a bar at the bottom of the screen instead of covering the page. They still have to give every one. Saved as soon as you change it."
      emptyText="Nobody yet. Everyone gets the full cheer screen."
      addLabel="Add a player who cheers later"
      addedMessage={(name) => `${name} can cheer later`}
      removedMessage={(name) => `${name} gets the full cheer screen again`}
    />
  )
}

export default CheerLaterCard
