/**
 * Wording for "you received a cheer" toasts.
 *
 * The launch backlog after a session is about a dozen cheers. One toast each,
 * 200ms apart and 20s long, buried everything else on screen — the receipt
 * backlog was collapsed into one toast for the same reason. A single cheer still
 * reads the way it always did.
 */

export const CHEER_EMOJI: Record<string, string> = {
  offense: '⚔️',
  defense: '🛡️',
  technique: '🎯',
  movement: '💨',
  good_sport: '🤝',
  solid_effort: '💪',
}

const CHEER_LABEL: Record<string, string> = {
  offense: 'Fierce Offense',
  defense: 'Iron Defense',
  technique: 'Smooth Technique',
  movement: 'Swift Movement',
  good_sport: 'Good Sport',
  solid_effort: 'Solid Effort',
}

/** How many cheer types the summary names before folding the rest into "and N more". */
const NAMED_TYPES = 3

export function cheerEmoji(slug: string): string {
  return CHEER_EMOJI[slug] ?? '🏸'
}

export function cheerLabel(slug: string): string {
  return CHEER_LABEL[slug] ?? slug.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

/** One cheer, as the realtime toast has always said it. */
export function cheerLine(slug: string, from: string | null): string {
  return `${cheerEmoji(slug)} ${cheerLabel(slug)} from ${from}!`
}

export interface CheerSummary {
  title: string
  description?: string
}

/**
 * One toast for the whole backlog. `slug` is the notification's `title` column,
 * `from` its `body`.
 */
export function summariseCheers(cheers: Array<{ slug: string; from: string | null }>): CheerSummary | null {
  if (cheers.length === 0) return null
  if (cheers.length === 1) return { title: cheerLine(cheers[0].slug, cheers[0].from) }

  const bySlug = new Map<string, number>()
  for (const c of cheers) bySlug.set(c.slug, (bySlug.get(c.slug) ?? 0) + 1)

  // Most received first; ties keep the order they first arrived in.
  const ranked = [...bySlug.entries()].sort((a, b) => b[1] - a[1])
  const named = ranked.slice(0, NAMED_TYPES)
  const rest = ranked.slice(NAMED_TYPES).reduce((sum, [, n]) => sum + n, 0)

  const parts = named.map(([slug, n]) => `${cheerEmoji(slug)} ×${n}`)
  if (rest > 0) parts.push(`and ${rest} more`)

  return { title: `🎉 ${cheers.length} new cheers`, description: parts.join(' · ') }
}
