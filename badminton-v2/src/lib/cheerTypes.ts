/**
 * The six cheer types, in one place.
 *
 * The leaderboard's category switcher and the profile's distribution bar both
 * read this list, so a seventh cheer type is added once rather than in two
 * views that would drift.
 */

import type { CheerTypeSlug } from '@/types/app'

/** The subset of `player_cheer_stats` these helpers need. */
export interface CheerCounts {
  offense_received: number
  defense_received: number
  technique_received: number
  movement_received: number
  good_sport_received: number
  solid_effort_received: number
}

export interface CheerCategory {
  slug: CheerTypeSlug
  emoji: string
  /** Full name, used as a section heading and on the profile badge. */
  name: string
  /** Fits a sixth of a 384px phone at 9px — the switcher has no room for more. */
  short: string
  /**
   * Bar segment colour. Fixed hex rather than a token: the app is dark-only,
   * six new theme tokens would be twelve values to maintain, and these are
   * tuned against `--card` (#1A1025). Revisit if a light theme ever lands.
   */
  color: string
  of: (counts: CheerCounts) => number
}

export const CHEER_CATEGORIES: readonly CheerCategory[] = [
  { slug: 'offense',      emoji: '⚔️', name: 'Fierce Offense',   short: 'Off',    color: '#E0574B', of: (c) => c.offense_received },
  { slug: 'defense',      emoji: '🛡️', name: 'Iron Defense',     short: 'Def',    color: '#4C8DD6', of: (c) => c.defense_received },
  { slug: 'technique',    emoji: '🎯', name: 'Smooth Technique', short: 'Tech',   color: '#C77DD8', of: (c) => c.technique_received },
  { slug: 'movement',     emoji: '💨', name: 'Swift Movement',   short: 'Move',   color: '#48B39B', of: (c) => c.movement_received },
  { slug: 'good_sport',   emoji: '🤝', name: 'Good Sport',       short: 'Sport',  color: '#E8B33C', of: (c) => c.good_sport_received },
  { slug: 'solid_effort', emoji: '💪', name: 'Solid Effort',     short: 'Effort', color: '#8A8FE0', of: (c) => c.solid_effort_received },
] as const

/**
 * The category a player is most cheered for, or null when they have no cheers.
 *
 * Ties resolve to the first category in list order rather than to nothing: a
 * profile badge reading "Fierce Offense 20%" is more use than a blank space,
 * and unlike the Awards tab nothing is being awarded here.
 */
export function signatureCheer(counts: CheerCounts): CheerCategory | null {
  let best: CheerCategory | null = null
  for (const category of CHEER_CATEGORIES) {
    if (category.of(counts) <= 0) continue
    if (!best || category.of(counts) > best.of(counts)) best = category
  }
  return best
}
