import { describe, expect, it, vi } from 'vitest'
import { buildActiveReceiptCountMap, buildRegistrantsBySession, buildRegistrationPaymentMap } from '@/hooks/usePlayerSessions'
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

describe('buildRegistrantsBySession', () => {
  const profiles = [
    { id: 'p1', name_slug: 'alexis-cruz', nickname: 'Alexis', avatar_url: null },
    { id: 'p2', name_slug: 'alexis-santos', nickname: 'Alexis', avatar_url: 'https://x/a.png' },
    { id: 'p3', name_slug: 'gab-reyes', nickname: null, avatar_url: null },
  ]

  it('groups by session in sign-up order', () => {
    const map = buildRegistrantsBySession([
      { session_id: 's1', player_id: 'p3', registered_at: '2026-09-02T00:00:00Z' },
      { session_id: 's1', player_id: 'p1', registered_at: '2026-09-01T00:00:00Z' },
      { session_id: 's2', player_id: 'p2', registered_at: '2026-09-01T00:00:00Z' },
    ], profiles)

    expect(map.get('s1')?.map((r) => r.id)).toEqual(['p1', 'p3'])
    expect(map.get('s1')?.[1].name).toBe('Gab Reyes')
    expect(map.get('s2')?.[0].avatarUrl).toBe('https://x/a.png')
  })

  it('disambiguates duplicate names only within the same session', () => {
    const map = buildRegistrantsBySession([
      { session_id: 's1', player_id: 'p1', registered_at: '2026-09-01T00:00:00Z' },
      { session_id: 's1', player_id: 'p2', registered_at: '2026-09-02T00:00:00Z' },
      { session_id: 's2', player_id: 'p1', registered_at: '2026-09-01T00:00:00Z' },
    ], profiles)

    expect(map.get('s1')?.map((r) => r.name)).toEqual(['Alexis (Cruz)', 'Alexis (Santos)'])
    expect(map.get('s2')?.[0].name).toBe('Alexis')
  })
})
