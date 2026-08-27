import { describe, expect, it } from 'vitest'
import { derivePaymentState, type PaymentState } from '@/lib/paymentState'

/**
 * derivePaymentState is the single point where the orange
 * "awaiting confirmation" state comes into existence. Nothing stores it,
 * so this table-driven test is the cheapest available proof of
 * FR-016 through FR-019.
 *
 * The contract that matters most: `paid` DOMINATES. A confirmed player is
 * green no matter how many receipts exist, which is what makes the
 * paid -> unpaid reversal safe (receipts are retained and the row simply
 * re-derives).
 */
describe('derivePaymentState', () => {
  const cases: Array<{
    paid: boolean | null
    activeReceiptCount: number
    expected: PaymentState
    why: string
  }> = [
    { paid: true, activeReceiptCount: 0, expected: 'paid', why: 'confirmed with no receipt (cash at the court)' },
    { paid: true, activeReceiptCount: 2, expected: 'paid', why: 'confirmed wins over any receipt count' },
    { paid: false, activeReceiptCount: 1, expected: 'submitted', why: 'unconfirmed with proof attached' },
    { paid: null, activeReceiptCount: 1, expected: 'submitted', why: 'legacy/unset paid treated as unpaid' },
    { paid: false, activeReceiptCount: 0, expected: 'unpaid', why: 'nothing submitted' },
    { paid: null, activeReceiptCount: 0, expected: 'unpaid', why: 'legacy/unset with nothing submitted' },
  ]

  for (const { paid, activeReceiptCount, expected, why } of cases) {
    it(`paid=${String(paid)} + ${activeReceiptCount} active receipt(s) -> ${expected} (${why})`, () => {
      expect(derivePaymentState({ paid, activeReceiptCount })).toBe(expected)
    })
  }

  it('never returns submitted once payment is confirmed, at any receipt count', () => {
    for (let count = 0; count <= 5; count++) {
      expect(derivePaymentState({ paid: true, activeReceiptCount: count })).toBe('paid')
    }
  })

  it('treats a negative count defensively as no receipts', () => {
    expect(derivePaymentState({ paid: false, activeReceiptCount: -1 })).toBe('unpaid')
  })
})
