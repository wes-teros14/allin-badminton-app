import { describe, expect, it } from 'vitest'
import {
  DEFAULT_GENERATOR_SETTINGS,
  buildGenerateOptions,
  effectiveNumMatches,
  effectiveWeights,
  resolveWishlist,
  toPresetSettings,
} from '@/lib/generatorSettings'
import type { PlayerInput } from '@/lib/matchGenerator'

const players: PlayerInput[] = [
  { id: 'a', nameSlug: 'ana-cruz', nickname: 'Ana', gender: 'F', level: 5 },
  { id: 'b', nameSlug: 'ben-lim', nickname: null, gender: 'M', level: 6 },
  { id: 'c', nameSlug: 'carl-tan', nickname: 'Carl', gender: 'M', level: 4 },
  { id: 'd', nameSlug: 'dee-uy', nickname: 'Dee', gender: 'F', level: 5 },
]

describe('generatorSettings', () => {
  it('sends a disabled weight to the engine as 0 and leaves the rest', () => {
    const w = effectiveWeights({ ...DEFAULT_GENERATOR_SETTINGS, disabledWeights: ['mixedDoublesPenalty'] })
    expect(w.mixedDoublesPenalty).toBe(0)
    expect(w.fairnessWeight).toBe(DEFAULT_GENERATOR_SETTINGS.fairnessWeight)
  })

  it('derives the game count from the roster when numMatches is 0', () => {
    expect(effectiveNumMatches({ numMatches: 0 }, 14)).toBe(28)
    expect(effectiveNumMatches({ numMatches: 14 }, 14)).toBe(14)
  })

  it('resolves wishlist pairs by nickname or slug and reports the rest', () => {
    const { pairs, unresolved } = resolveWishlist('ana-ben-lim, Carl-Dee, ana-zed', players)
    // "ana-ben-lim" splits into three parts, so it cannot be a pair — same as the panel always did.
    expect(pairs).toEqual([['c', 'd']])
    expect(unresolved).toEqual(['ana-ben-lim', 'ana-zed'])
  })

  it('keeps pins and wishlist out of a preset', () => {
    const preset = toPresetSettings({ ...DEFAULT_GENERATOR_SETTINGS, wishlistStr: 'x-y', pinnedGames: [null] })
    expect(preset).not.toHaveProperty('wishlistStr')
    expect(preset).not.toHaveProperty('pinnedGames')
    expect(preset).toHaveProperty('maxSpreadLimit', DEFAULT_GENERATOR_SETTINGS.maxSpreadLimit)
  })

  it('builds the options the panel used to build inline', () => {
    const opts = buildGenerateOptions({ ...DEFAULT_GENERATOR_SETTINGS, wishlistStr: 'ana-carl' }, players, 2, [])
    expect(opts).toMatchObject({
      numMatches: 20,
      courtCount: 2,
      maxConsecutiveGames: 1,
      maxSpreadLimit: 2,
      disableGenderRules: false,
      wishlistPairs: [['a', 'c']],
      numTrials: 2000,
      numStarts: 50,
      idealRestGames: 2,
      earlyRestWindow: 20,
      pinnedMatches: [],
    })
  })
})
