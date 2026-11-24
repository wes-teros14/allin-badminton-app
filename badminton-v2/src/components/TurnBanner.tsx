/**
 * The "it's your turn" / "you play early" line above a player's schedule. Shared by the session page
 * (SessionPlayerDetailView) and the old schedule page (PlayerView), which used to carry two copies.
 * Drawn icons instead of 🏸 / 🏃 (2026-11-24 pattern ban).
 */

import { Clock, MapPin } from 'lucide-react'

export function TurnBanner({ playing }: { playing: boolean }) {
  return (
    <div
      role="status"
      className={`mx-4 mt-3 mb-1 flex items-start gap-2.5 rounded-lg px-4 py-2.5 text-sm ${
        playing ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
      }`}
    >
      {playing ? (
        <>
          <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span><b className="font-semibold">It&apos;s your turn.</b> Please head to the court now.</span>
        </>
      ) : (
        <>
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-gold-ink" aria-hidden="true" />
          <span>You play one of the first games — arriving late may mean fewer games.</span>
        </>
      )}
    </div>
  )
}
