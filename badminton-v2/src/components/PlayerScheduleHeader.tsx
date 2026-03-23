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

export function PlayerScheduleHeader({ nameSlug, sessionName, sessionDate, sessionVenue, sessionTime, sessionDuration, gameCount }: Props) {
  const formattedDate = sessionDate
    ? new Date(sessionDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).replace(/^(\w{3})/, '$1.')
    : ''
  return (
    <div className="bg-primary text-primary-foreground px-4 py-5">

      <p className="text-2xl font-bold">{nameSlug}</p>
      <p className="text-sm opacity-80 mt-0.5">
        {sessionName} &middot; {gameCount} {gameCount === 1 ? 'game' : 'games'}
      </p>
      <p className="text-sm opacity-70 mt-0.5">
        {formattedDate}
        {sessionTime && <span> · {sessionTime}</span>}
        {sessionDuration && <span> · {sessionDuration}</span>}
        {sessionVenue && <span> · {sessionVenue}</span>}
      </p>
    </div>
  )
}
