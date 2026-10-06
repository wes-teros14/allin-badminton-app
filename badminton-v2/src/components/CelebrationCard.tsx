/**
 * The card that tells a player their standing improved.
 *
 * It appears over whatever screen they are on, dims it, and waits: "See the
 * board" or "Close" (option B, temporary_files/celebration-card-close-options.html,
 * 2026-10-06). It used to leave by itself after 4.5s and hand over to an 8s
 * "View" toast — both easy to miss by looking away, so the owner asked for a card
 * that stays until it is answered. The card now carries the trip to the board
 * itself, and the toast is gone.
 *
 * A podium and a non-podium card are the same card. Same size, same animation,
 * same confetti, same time on screen — the only differences are the icon and the
 * border. That is a product decision, made deliberately: the celebration is for
 * the achievement the player actually had, not a ranking of whose achievement
 * counted for more.
 *
 * By the same decision a *drop* is drawn identically, confetti included. The app
 * reports movement and does not editorialise about its direction. The single
 * concession is punctuation — "Down 2 places" carries no exclamation mark.
 */

import { useEffect, useRef, useState } from 'react'
import { ConfettiBurst } from '@/components/ConfettiBurst'
import { PODIUM_PLACES, type NewPlacing } from '@/lib/podiumCelebration'
import { cardHeadline } from '@/lib/celebrationLabels'

const MEDALS = ['🥇', '🥈', '🥉'] as const
const ORDINALS = ['1st', '2nd', '3rd'] as const

/**
 * Medal edges, matching PODIUM_TINT on the leaderboard so the card and the row
 * cannot drift. Bronze is amber-700, a brown rather than an orange, because an
 * orange edge on a dark card reads as the destructive red.
 */
const PODIUM_BORDER = ['border-gold', 'border-zinc-400', 'border-amber-700'] as const

/** Matches the length of the animate-celebration-out keyframes. */
const LEAVE_MS = 400

/** What the player answered the card with. */
export type CelebrationChoice = 'board' | 'close'

/**
 * Whether this card wears a medal — decided by where the player now stands, not by
 * what kind of news it is.
 *
 * The distinction only bites for a drop. A climb or a first appearance can never
 * land inside the top 3, because the podium branch of the rule claims those
 * first. But a player who slips from 2nd to 3rd still holds bronze, and showing
 * them a bunny and a plain border would be telling them they had lost a medal
 * they still have.
 */
const showsMedal = (p: NewPlacing) => p.rank <= PODIUM_PLACES

/**
 * The bunny stands in for a medal on every non-podium card.
 *
 * Both are sized explicitly to the same box. An emoji takes its size from the
 * font and an image from its height, so leaving either to inherit puts a 30px
 * medal beside an 18px bunny in the same row.
 */
function Icon({ placing, px }: { placing: NewPlacing; px: number }) {
  if (showsMedal(placing)) {
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
  onDone: (choice: CelebrationChoice) => void
}) {
  const [leaving, setLeaving] = useState(false)
  const reduced = prefersReducedMotion()
  const primaryRef = useRef<HTMLButtonElement>(null)
  const leaveTimer = useRef<number | undefined>(undefined)

  const best = achievements[0]
  const several = achievements.length > 1

  function answer(choice: CelebrationChoice) {
    if (leaving) return
    setLeaving(true)
    leaveTimer.current = window.setTimeout(() => onDone(choice), reduced ? 0 : LEAVE_MS)
  }
  // Held in a ref so the Escape listener below never calls a stale answer().
  const answerRef = useRef(answer)
  answerRef.current = answer

  useEffect(() => {
    // Focus the main action so a keyboard or screen-reader user lands on it.
    primaryRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') answerRef.current('close') }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); window.clearTimeout(leaveTimer.current) }
  }, [])

  if (!best) return null

  const borderClass = showsMedal(best) ? `border-[3px] ${PODIUM_BORDER[best.rank - 1]}` : 'border border-border'

  return (
    <>
      {/* Dims and blocks the page: the card waits for an answer, and a tap meant
          for the screen behind must not land there instead. Not a close target —
          the buttons are the only way out, so nobody dismisses it by accident. */}
      <div
        aria-hidden="true"
        className={`fixed inset-0 z-[59] bg-black/50 transition-opacity duration-300 ${leaving ? 'opacity-0' : 'opacity-100'}`}
      />
      {!reduced && <ConfettiBurst />}

      <div className="pointer-events-none fixed inset-0 z-[61] grid place-items-center p-6">
        <div
          role="dialog"
          aria-modal="true"
          aria-label={several ? `${achievements.length} to celebrate` : cardHeadline(best)}
          className={`pointer-events-auto w-[250px] rounded-[20px] bg-card px-6 py-5 text-center shadow-[0_18px_46px_-14px_rgba(0,0,0,0.55)] ${borderClass} ${
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
                <Icon placing={best} px={showsMedal(best) ? 46 : 66} />
              </div>
              <p className="mt-1.5 text-[17px] font-extrabold">{cardHeadline(best)}</p>
              <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">
                {boardLabel(best).detail}
              </p>
            </>
          )}

          <div className="mt-4 grid gap-1.5">
            <button
              ref={primaryRef}
              type="button"
              onClick={() => answer('board')}
              className="min-h-10 rounded-[10px] bg-primary px-3 text-sm font-semibold text-white transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              See the board
            </button>
            <button
              type="button"
              onClick={() => answer('close')}
              className="min-h-10 rounded-[10px] border border-border px-3 text-sm font-semibold transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

export default CelebrationCard
