import { describe, expect, it, vi } from 'vitest'
import { buildRegistrationPaymentMap } from '@/hooks/usePlayerSessions'

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
