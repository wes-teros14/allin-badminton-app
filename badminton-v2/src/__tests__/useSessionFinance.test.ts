import { describe, expect, it, vi } from 'vitest'
import {
  allocateCheapestFirst,
  calculateProfitAfterPersonalShare,
} from '@/hooks/useSessionFinance'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
}))

describe('useSessionFinance helpers', () => {
  it('does not change profit when no manual share is set', () => {
    expect(calculateProfitAfterPersonalShare(900, null)).toBe(900)
  })

  it('uses the manual override when one is set', () => {
    expect(calculateProfitAfterPersonalShare(900, 150)).toBe(750)
  })

  it('allocates across partial tubes based on remaining shuttles', () => {
    expect(
      allocateCheapestFirst(8, [
        { id: 'a', brand: 'A', shuttlesRemaining: 6, costPerTube: 80, tubeStart: 1001 },
        { id: 'b', brand: 'B', shuttlesRemaining: 12, costPerTube: 90, tubeStart: 1002 },
      ])
    ).toEqual([
      { batchId: 'a', tubeId: 1001, brand: 'A', shuttlesUsed: 6, costPerTube: 80 },
      { batchId: 'b', tubeId: 1002, brand: 'B', shuttlesUsed: 2, costPerTube: 90 },
    ])
  })
})
