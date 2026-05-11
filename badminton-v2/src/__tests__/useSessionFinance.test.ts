import { describe, expect, it, vi } from 'vitest'
import {
  allocateCheapestFirst,
  calculateProfitAfterPersonalShare,
  compareAllocationOrder,
  compareBatchIdentity,
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

  it('uses the lower tube number first when same-price tubes tie', () => {
    expect(
      allocateCheapestFirst(12, [
        { id: 'b', brand: 'XP2', shuttlesRemaining: 12, costPerTube: 936, tubeStart: 1007 },
        { id: 'a', brand: 'XP2', shuttlesRemaining: 12, costPerTube: 936, tubeStart: 1006 },
      ])
    ).toEqual([
      { batchId: 'a', tubeId: 1006, brand: 'XP2', shuttlesUsed: 12, costPerTube: 936 },
    ])
  })

  it('breaks identical timestamps by batch id for stable numbering', () => {
    expect(compareBatchIdentity(
      { id: 'batch-a', created_at: '2026-05-11T10:00:00Z' },
      { id: 'batch-b', created_at: '2026-05-11T10:00:00Z' }
    )).toBeLessThan(0)
  })

  it('breaks same-price allocation ties by tube number before batch id', () => {
    expect(compareAllocationOrder(
      { id: 'batch-b', brand: 'XP2', shuttlesRemaining: 12, costPerTube: 936, tubeStart: 1006 },
      { id: 'batch-a', brand: 'XP2', shuttlesRemaining: 12, costPerTube: 936, tubeStart: 1007 }
    )).toBeLessThan(0)
  })
})
