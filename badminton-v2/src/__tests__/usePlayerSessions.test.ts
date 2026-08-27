import { describe, expect, it, vi } from 'vitest'
import { buildActiveReceiptCountMap, buildRegistrationPaymentMap } from '@/hooks/usePlayerSessions'
import { derivePaymentState } from '@/lib/paymentState'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
}))

describe('usePlayerSessions helpers', () => {
  it('maps registration payment status by session id', () => {
    const paidBySessionId = buildRegistrationPaymentMap([
      { session_id: 'paid-session', paid: true },
      { session_id: 'unpaid-session', paid: false },
      { session_id: 'legacy-session', paid: null },
    ])

    expect(paidBySessionId.get('paid-session')).toBe(true)
    expect(paidBySessionId.get('unpaid-session')).toBe(false)
    expect(paidBySessionId.get('legacy-session')).toBe(false)
  })
})

describe('buildActiveReceiptCountMap', () => {
  it('counts receipts per session', () => {
    const counts = buildActiveReceiptCountMap([
      { session_id: 'a', dismissed_at: null },
      { session_id: 'a', dismissed_at: null },
      { session_id: 'b', dismissed_at: null },
    ])

    expect(counts.get('a')).toBe(2)
    expect(counts.get('b')).toBe(1)
  })

  /**
   * Regression guard. If this filter is dropped here but kept in useRoster and
   * useSessionReceipts, a dismissed receipt shows the player "Awaiting
   * confirmation" on the sessions list while both other surfaces show
   * "Unpaid" — a direct FR-020 / SC-007 violation, and one that looks
   * internally consistent on every screen taken alone.
   */
  it('excludes dismissed receipts', () => {
    const counts = buildActiveReceiptCountMap([
      { session_id: 'a', dismissed_at: '2026-08-27T10:00:00Z' },
      { session_id: 'a', dismissed_at: null },
    ])

    expect(counts.get('a')).toBe(1)
  })

  it('omits a session whose every receipt is dismissed, so it derives back to unpaid', () => {
    const counts = buildActiveReceiptCountMap([
      { session_id: 'a', dismissed_at: '2026-08-27T10:00:00Z' },
    ])

    expect(counts.get('a')).toBeUndefined()
    expect(derivePaymentState({ paid: false, activeReceiptCount: counts.get('a') ?? 0 })).toBe('unpaid')
  })

  it('returns an empty map when the player has submitted nothing', () => {
    expect(buildActiveReceiptCountMap([]).size).toBe(0)
  })
})
