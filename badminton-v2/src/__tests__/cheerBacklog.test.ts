import { describe, expect, it } from 'vitest'
import { cheerLine, summariseCheers } from '@/lib/cheerBacklog'

const cheer = (slug: string, from = 'alex') => ({ slug, from })

describe('summariseCheers', () => {
  it('says nothing for an empty backlog', () => {
    expect(summariseCheers([])).toBeNull()
  })

  it('keeps a single cheer in its original wording', () => {
    expect(summariseCheers([cheer('defense', 's1-alex-tan')])).toEqual({
      title: '🛡️ Iron Defense from s1-alex-tan!',
    })
  })

  it('collapses several cheers into one line, most received first', () => {
    const s = summariseCheers([cheer('offense'), cheer('defense'), cheer('defense')])
    expect(s).toEqual({ title: '🎉 3 new cheers', description: '🛡️ ×2 · ⚔️ ×1' })
  })

  it('names three types and folds the rest into a count of cheers, not types', () => {
    const s = summariseCheers([
      cheer('offense'), cheer('offense'), cheer('offense'),
      cheer('defense'), cheer('defense'),
      cheer('technique'), cheer('technique'),
      cheer('movement'), cheer('good_sport'), cheer('good_sport'),
      cheer('solid_effort'), cheer('solid_effort'),
    ])
    expect(s?.title).toBe('🎉 12 new cheers')
    // 3 + 2 + 2 named; good_sport 2 + solid_effort 2 + movement 1 = 5 folded
    expect(s?.description).toBe('⚔️ ×3 · 🛡️ ×2 · 🎯 ×2 · and 5 more')
  })

  it('falls back for an unknown cheer type rather than dropping it', () => {
    expect(cheerLine('great_serve', 'sam')).toBe('🏸 Great Serve from sam!')
  })
})
