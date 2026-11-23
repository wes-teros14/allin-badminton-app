import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))

import { assertComplete, mergeCheerRows, type CheerRow } from '@/lib/seasonData'

const cheer = (id: string, weight = 1): CheerRow => ({
  id,
  giverId: 'g',
  receiverId: 'r',
  slug: 'offense',
  weight,
})

describe('mergeCheerRows', () => {
  it('returns a cheer reachable by both paths once', () => {
    const merged = mergeCheerRows([cheer('a'), cheer('b')], [cheer('b'), cheer('c')])
    expect(merged.map((c) => c.id).sort()).toEqual(['a', 'b', 'c'])
  })

  it('keeps every cheer when the paths do not overlap', () => {
    expect(mergeCheerRows([cheer('a')], [cheer('b')])).toHaveLength(2)
  })
})

describe('assertComplete', () => {
  it('throws naming what was read and both numbers when the read is short', () => {
    expect(() => assertComplete(999, 1000, 'cheers')).toThrow(/cheers.*999.*1000/s)
  })

  it('passes when the fetched count matches the exact count', () => {
    expect(() => assertComplete(1000, 1000, 'cheers')).not.toThrow()
  })

  it('does not throw when no count is available', () => {
    expect(() => assertComplete(5, null, 'x')).not.toThrow()
  })
})
