import type { Season } from '@/lib/season'
import { switcherLabel } from '@/lib/seasonCopy'

/**
 * The Leaderboard's season choice: "2027 season | 2026". `options` is current season first, then each past
 * season newest first. One pill, as in the approved POC; the buttons keep a 44px hit area while looking 28px.
 */
export function SeasonSwitcher({
  value,
  options,
  onChange,
}: {
  value: string
  options: Season[]
  onChange: (id: string) => void
}) {
  return (
    <div role="group" aria-label="Season" className="inline-flex shrink-0 rounded-full border border-border bg-secondary p-[3px]">
      {options.map((season, i) => {
        const isOn = season.id === value
        return (
          <button
            key={season.id}
            type="button"
            aria-pressed={isOn}
            onClick={() => onChange(season.id)}
            className={`relative whitespace-nowrap rounded-full px-[11px] py-[5px] text-xs font-bold transition-colors after:absolute after:inset-x-0 after:-inset-y-2 after:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              isOn
                ? 'bg-card text-foreground shadow-[inset_0_0_0_1px_var(--border)]'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {switcherLabel(season, i === 0)}
          </button>
        )
      })}
    </div>
  )
}
