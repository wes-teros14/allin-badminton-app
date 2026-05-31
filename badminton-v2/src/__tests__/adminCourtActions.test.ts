import { describe, expect, it } from 'vitest'
import { findFirstOpenCourtNumber } from '@/lib/courts'

describe('admin court action helpers', () => {
  it('finds the first available court for queue promotion', () => {
    expect(findFirstOpenCourtNumber(4, [1, 2])).toBe(3)
    expect(findFirstOpenCourtNumber(3, [1, 2, 3])).toBeNull()
  })
})
