/**
 * The Match Generator's settings and how they become engine options.
 *
 * Shared by the admin panel (`MatchGeneratorPanel.tsx`) and the command-line
 * scheduler (`scripts/schedule/schedule.ts`), so a schedule made from either
 * place is produced by the same defaults and the same settings → options
 * mapping. The stored shape is what `sessions.generator_settings` holds after
 * a lock, so it must stay backward compatible: add fields, never rename.
 */
import {
  DEFAULT_WEIGHTS,
  type OptimizeOptions,
  type PinnedMatch,
  type PlayerInput,
  type ScoreWeights,
} from './matchGenerator'
import type { MatchSlots } from './matchSlots'

export interface GeneratorSettings {
  // Match Rules
  numMatches: number
  maxConsecutiveGames: number
  maxSpreadLimit: number
  disableGenderRules: boolean
  // Fixed opening games: index i = game i+1; null = engine picks. Always a
  // prefix — game 2 cannot be pinned unless game 1 is.
  pinnedGames: Array<MatchSlots | null>
  // Optimizer
  numTrials: number
  numStarts: number
  wishlistStr: string
  idealRestGames: number
  earlyRestWindow: number
  // Scoring Weights
  streakWeight: number
  imbalancePenalty: number
  wishlistReward: number
  repeatPartnerPenalty: number
  fairnessWeight: number
  spreadPenalty: number
  mixedDoublesPenalty: number
  genderSplitPenalty: number
  unevenGenderPenalty: number
  restSpacingPenalty: number
  earlyRestReward: number
  openingRepeatPenalty: number
  disabledWeights: string[]
}

export const DEFAULT_GENERATOR_SETTINGS: GeneratorSettings = {
  numMatches: 20,
  maxConsecutiveGames: 1,
  maxSpreadLimit: 2,
  disableGenderRules: false,
  pinnedGames: [],
  idealRestGames: 2,
  earlyRestWindow: 20,
  numTrials: 2000,
  numStarts: 50,
  wishlistStr: '',
  streakWeight: DEFAULT_WEIGHTS.streakWeight,
  imbalancePenalty: DEFAULT_WEIGHTS.imbalancePenalty,
  wishlistReward: DEFAULT_WEIGHTS.wishlistReward,
  repeatPartnerPenalty: DEFAULT_WEIGHTS.repeatPartnerPenalty,
  fairnessWeight: DEFAULT_WEIGHTS.fairnessWeight,
  spreadPenalty: DEFAULT_WEIGHTS.spreadPenalty,
  mixedDoublesPenalty: DEFAULT_WEIGHTS.mixedDoublesPenalty,
  genderSplitPenalty: DEFAULT_WEIGHTS.genderSplitPenalty,
  unevenGenderPenalty: DEFAULT_WEIGHTS.unevenGenderPenalty,
  restSpacingPenalty: DEFAULT_WEIGHTS.restSpacingPenalty,
  earlyRestReward: DEFAULT_WEIGHTS.earlyRestReward,
  openingRepeatPenalty: DEFAULT_WEIGHTS.openingRepeatPenalty,
  disabledWeights: [],
}

export const WEIGHT_KEYS: readonly (keyof ScoreWeights)[] = [
  'streakWeight', 'imbalancePenalty', 'wishlistReward', 'repeatPartnerPenalty',
  'fairnessWeight', 'spreadPenalty', 'mixedDoublesPenalty', 'genderSplitPenalty',
  'unevenGenderPenalty', 'restSpacingPenalty', 'earlyRestReward', 'openingRepeatPenalty',
]

// Everything in Settings except this session's specific players: pinned
// games name particular registrants, and the wishlist is particular pairs
// (e.g. "wes-yelli"). A preset is a scoring philosophy, not this week's
// roster, so saving/loading one never touches either field.
export type PresetSettings = Omit<GeneratorSettings, 'pinnedGames' | 'wishlistStr'>

export function toPresetSettings(settings: GeneratorSettings): PresetSettings {
  const rest: Partial<GeneratorSettings> = { ...settings }
  delete rest.pinnedGames
  delete rest.wishlistStr
  return rest as PresetSettings
}

export function countPinnedPrefix(rows: Array<MatchSlots | null> | undefined): number {
  let n = 0
  for (const row of rows ?? []) {
    if (!row) break
    n++
  }
  return n
}

/** Changes whenever a registration is added/removed or its gender/level changes. */
export function buildRosterVersion(players: Array<{ id: string; gender: 'M' | 'F' | null; level: number | null }>): string {
  return players
    .map((player) => `${player.id}:${player.gender ?? ''}:${player.level ?? ''}`)
    .sort()
    .join('|')
}

/** 0 (or less) means "derive from the roster": every player gets 2 games' worth of 4 seats. */
export function effectiveNumMatches(settings: Pick<GeneratorSettings, 'numMatches'>, playerCount: number): number {
  return settings.numMatches > 0 ? settings.numMatches : Math.ceil((playerCount * 8) / 4)
}

/** A weight listed in `disabledWeights` is sent to the engine as 0. */
export function effectiveWeights(settings: GeneratorSettings): ScoreWeights {
  const weights = {} as ScoreWeights
  for (const key of WEIGHT_KEYS) {
    weights[key] = settings.disabledWeights.includes(key) ? 0 : settings[key]
  }
  return weights
}

/**
 * Resolves "slug1-slug2, slug3-slug4" to id pairs, matching nickname (or
 * name slug when there is none), case-insensitively. Unknown names are
 * dropped, as the panel always has; `unresolved` lists them for callers that
 * want to say so.
 */
export function resolveWishlist(
  wishlistStr: string,
  players: PlayerInput[],
): { pairs: [string, string][]; unresolved: string[] } {
  const nameToId = new Map(players.map((p) => [(p.nickname ?? p.nameSlug).toLowerCase(), p.id]))
  const pairs: [string, string][] = []
  const unresolved: string[] = []
  if (!wishlistStr.trim()) return { pairs, unresolved }
  for (const pair of wishlistStr.split(',')) {
    const parts = pair.trim().split('-').map((s) => s.trim().toLowerCase())
    if (parts.length !== 2) {
      if (pair.trim()) unresolved.push(pair.trim())
      continue
    }
    const id1 = nameToId.get(parts[0])
    const id2 = nameToId.get(parts[1])
    if (id1 && id2) pairs.push([id1, id2])
    else unresolved.push(pair.trim())
  }
  return { pairs, unresolved }
}

/** The exact options the panel's Generate button passes to `generateScheduleOptimized`. */
export function buildGenerateOptions(
  settings: GeneratorSettings,
  players: PlayerInput[],
  courtCount: number,
  pinnedMatches: PinnedMatch[],
): OptimizeOptions {
  return {
    numMatches: effectiveNumMatches(settings, players.length),
    courtCount,
    maxConsecutiveGames: settings.maxConsecutiveGames,
    maxSpreadLimit: settings.maxSpreadLimit,
    disableGenderRules: settings.disableGenderRules,
    wishlistPairs: resolveWishlist(settings.wishlistStr, players).pairs,
    weights: effectiveWeights(settings),
    numTrials: settings.numTrials,
    numStarts: settings.numStarts,
    idealRestGames: settings.idealRestGames,
    earlyRestWindow: settings.earlyRestWindow,
    pinnedMatches,
  }
}
