/**
 * A place on a board as a numbered disc: gold, silver and bronze for 1st–3rd, a muted disc below that.
 * Replaces the medal emoji everywhere (leaderboards, Today, profile, celebration card), so a place looks
 * the same on every surface.
 *
 * Dark ink on all three medal fills, in both themes: the lightest fill is ~9:1 and the darkest
 * (light-theme gold #B87A00) ~5:1 against #1B1220.
 */

const FILL = ['bg-gold', 'bg-[#B8B2C0]', 'bg-[#C98A55]'] as const

const SIZE = {
  sm: 'h-6 w-6 text-xs',
  md: 'h-[34px] w-[34px] text-[15px]',
  lg: 'h-[52px] w-[52px] text-2xl',
} as const

export function RankDisc({ rank, size = 'sm', className = '' }: { rank: number; size?: keyof typeof SIZE; className?: string }) {
  const medal = rank >= 1 && rank <= 3
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full font-extrabold tabular-nums ${SIZE[size]} ${
        medal ? `${FILL[rank - 1]} text-[#1B1220]` : 'bg-secondary text-foreground'
      } ${className}`}
      aria-label={`Rank ${rank}`}
    >
      {rank}
    </span>
  )
}
