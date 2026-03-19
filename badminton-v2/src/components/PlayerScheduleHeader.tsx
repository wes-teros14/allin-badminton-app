import { Link } from 'react-router'

interface Props {
  nameSlug: string
  sessionName: string
  gameCount: number
}

export function PlayerScheduleHeader({ nameSlug, sessionName, gameCount }: Props) {
  return (
    <div className="bg-primary text-primary-foreground px-4 py-5">
      <Link to="/player" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors text-sm font-medium mb-3">
        ← All players
      </Link>
      <p className="text-2xl font-bold">{nameSlug}</p>
      <p className="text-sm opacity-80 mt-0.5">
        {sessionName} &middot; {gameCount} {gameCount === 1 ? 'game' : 'games'}
      </p>
    </div>
  )
}
