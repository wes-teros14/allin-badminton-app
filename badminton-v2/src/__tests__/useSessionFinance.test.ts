import { describe, expect, it } from 'vitest'
import {
  calculateProfitAfterPersonalShare,
} from '@/hooks/useSessionFinance'

describe('useSessionFinance helpers', () => {
  it('does not change profit when no manual share is set', () => {
    expect(calculateProfitAfterPersonalShare(900, null)).toBe(900)
  })

  it('uses the manual override when one is set', () => {
    expect(calculateProfitAfterPersonalShare(900, 150)).toBe(750)
  })
})
