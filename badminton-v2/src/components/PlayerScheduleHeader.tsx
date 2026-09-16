interface Props {
  nameSlug: string
  sessionName: string
  sessionDate: string
  sessionVenue: string | null
  sessionTime: string | null
  sessionDuration?: string | null
  gameCount: number
  sessionId?: string | null
}

/**
 * The session is the headline, the player is the eyebrow.
 *
 * The previous layout gave the 24px slot to the player's own name — the one
 * fact they already know — and pushed the session identity into the small
 * type. It also separated its two secondary lines by `opacity-80` vs
 * `opacity-70` alone, which is not enough to read as a hierarchy, and ran
 * date · time · duration · venue together until a real venue name wrapped
 * raggedly at 375px.
 *
 * When and where are now two lines told apart by size and weight, not only by
 * opacity. Nothing lighter than 75% white is used: `--primary` is #6F3E87 in
 * both themes, so one measurement covers light and dark — white at 0.75 is
 * 5.16:1, at 0.70 it is 4.66:1, and by 0.65 it fails AA at 4.29:1.
 */
export function PlayerScheduleHeader({ nameSlug, sessionName, sessionDate, sessionVenue, sessionTime, sessionDuration, gameCount }: Props) {
  const formattedDate = sessionDate
    ? new Date(sessionDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).replace(/^(\w{3})/, '$1.')
    : ''
  // Joined rather than conditionally rendered: every part is nullable, and a
  // separator only belongs between two parts that both exist.
  const whenLine = [formattedDate, sessionTime, sessionDuration ? `${sessionDuration} hrs` : null]
    .filter(Boolean)
    .join(' · ')
  const initial = nameSlug.trim().charAt(0).toUpperCase()

  return (
    <div className="bg-primary text-primary-foreground px-4 py-5">
      <div className="mb-1.5 flex items-center gap-1.5">
        <span
          className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full bg-primary-foreground/20 text-[9px] font-bold"
          aria-hidden="true"
        >
          {initial}
        </span>
        <span className="text-xs font-semibold opacity-90">{nameSlug}</span>
      </div>

      <div className="flex items-start gap-2.5">
        <p className="min-w-0 flex-1 text-[23px] font-bold leading-[1.2] tracking-[-0.02em]">{sessionName}</p>
        <span className="shrink-0 whitespace-nowrap rounded-[7px] bg-primary-foreground/15 px-2 py-1.5 font-mono text-[9.5px] font-bold uppercase tracking-[0.12em]">
          {gameCount} {gameCount === 1 ? 'game' : 'games'}
        </span>
      </div>

      {whenLine && <p className="mt-2 text-[13.5px] font-medium opacity-90">{whenLine}</p>}
      {sessionVenue && <p className="mt-0.5 text-[12.5px] opacity-75">{sessionVenue}</p>}
    </div>
  )
}
