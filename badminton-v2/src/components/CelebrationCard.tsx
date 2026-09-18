/**
 * The card that tells a player their standing improved.
 *
 * It appears over whatever screen they are on and leaves on its own. Nothing here
 * asks to be dismissed: a celebration you have to close has become a dialog.
 *
 * A podium and a non-podium card are the same card. Same size, same animation,
 * same confetti, same time on screen — the only differences are the icon and the
 * border. That is a product decision, made deliberately: the celebration is for
 * the achievement the player actually had, not a ranking of whose achievement
 * counted for more.
 */

import { useEffect, useState } from 'react'
import { ConfettiBurst } from '@/components/ConfettiBurst'
import { type NewPlacing } from '@/lib/podiumCelebration'
import { cardHeadline } from '@/lib/celebrationLabels'

const MEDALS = ['🥇', '🥈', '🥉'] as const
const ORDINALS = ['1st', '2nd', '3rd'] as const

/**
 * Medal edges, matching PODIUM_TINT on the leaderboard so the card and the row
 * cannot drift. Bronze is amber-700, a brown rather than an orange, because an
 * orange edge on a dark card reads as the destructive red.
 */
const PODIUM_BORDER = ['border-gold', 'border-zinc-400', 'border-amber-700'] as const

const BASE_DWELL_MS = 2100
const PER_EXTRA_MS = 600
const MAX_DWELL_MS = 5000

/** A card that says more has to stay longer, but it always leaves by itself. */
export function dwellFor(count: number): number {
  return Math.min(MAX_DWELL_MS, BASE_DWELL_MS + Math.max(0, count - 1) * PER_EXTRA_MS)
}

/**
 * Read from the achievement's kind, never inferred from its rank. A player can be
 * 2nd on a board and be celebrated for a personal best rather than a podium, and
 * the border and icon must follow the news rather than the number.
 */
const isPodium = (p: NewPlacing) => p.kind === 'podium'

/**
 * The bunny stands in for a medal on every non-podium card.
 *
 * Both are sized explicitly to the same box. An emoji takes its size from the
 * font and an image from its height, so leaving either to inherit puts a 30px
 * medal beside an 18px bunny in the same row.
 */
function Icon({ placing, px }: { placing: NewPlacing; px: number }) {
  if (isPodium(placing)) {
    return (
      <span
        aria-hidden="true"
        className="inline-flex items-center justify-center leading-none"
        style={{ fontSize: px, width: px, height: px }}
      >
        {MEDALS[placing.rank - 1]}
      </span>
    )
  }
  return (
    <img
      src="/bunny-thumbsup.png"
      alt=""
      className="w-auto object-contain"
      style={{ height: px }}
    />
  )
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

export function CelebrationCard({
  achievements,
  boardLabel,
  onDone,
}: {
  achievements: NewPlacing[]
  /** Human name for a board key, e.g. "Individual" or "Good Sport". */
  boardLabel: (placing: NewPlacing) => { title: string; detail: string }
  onDone: () => void
}) {
  const [leaving, setLeaving] = useState(false)
  const reduced = prefersReducedMotion()

  const best = achievements[0]
  const several = achievements.length > 1

  useEffect(() => {
    const dwell = dwellFor(achievements.length)
    const fade = window.setTimeout(() => setLeaving(true), dwell)
    const done = window.setTimeout(onDone, dwell + 400)
    return () => { window.clearTimeout(fade); window.clearTimeout(done) }
  }, [achievements.length, onDone])

  if (!best) return null

  const borderClass = isPodium(best) ? `border-[3px] ${PODIUM_BORDER[best.rank - 1]}` : 'border border-border'

  return (
    <>
      {!reduced && <ConfettiBurst />}

      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-0 z-[61] grid place-items-center p-6"
      >
        <div
          className={`w-[250px] rounded-[20px] bg-card px-6 py-5 text-center shadow-[0_18px_46px_-14px_rgba(0,0,0,0.55)] ${borderClass} ${
            reduced ? '' : leaving ? 'animate-celebration-out' : 'animate-celebration-in'
          }`}
        >
          {several ? (
            <>
              <div className="flex items-center justify-center gap-1">
                {achievements.map((a, i) => <Icon key={i} placing={a} px={30} />)}
              </div>
              <p className="mt-1.5 text-[17px] font-extrabold">
                {achievements.length} to celebrate!
              </p>
              <div className="mt-3 flex flex-col gap-1.5 text-left">
                {achievements.map((a, i) => {
                  const label = boardLabel(a)
                  return (
                    <div key={i} className="flex items-center gap-2 rounded-[9px] bg-muted px-2.5 py-1.5">
                      <span className="flex w-[18px] shrink-0 justify-center">
                        <Icon placing={a} px={16} />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[11.5px] font-semibold">{label.title}</span>
                      <span className="text-[10.5px] font-bold text-muted-foreground">
                        {a.rank <= 3 ? ORDINALS[a.rank - 1] : `${a.rank}th`}
                      </span>
                    </div>
                  )
                })}
              </div>
            </>
          ) : (
            <>
              <div className="grid min-h-[66px] place-items-center">
                <Icon placing={best} px={isPodium(best) ? 46 : 66} />
              </div>
              <p className="mt-1.5 text-[17px] font-extrabold">{cardHeadline(best)}</p>
              <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">
                {boardLabel(best).detail}
              </p>
            </>
          )}
        </div>
      </div>
    </>
  )
}

export default CelebrationCard
