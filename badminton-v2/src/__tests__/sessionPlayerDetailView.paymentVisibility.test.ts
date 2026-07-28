import { describe, expect, it, vi } from 'vitest'
import { shouldShowPaymentInfo } from '@/views/SessionPlayerDetailView'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
}))

describe('shouldShowPaymentInfo', () => {
  it('shows payment info when registered, unpaid, and fully configured', () => {
    expect(shouldShowPaymentInfo({ isRegistered: true, paid: false, hasPaymentInfo: true })).toBe(true)
  })

  it('hides payment info once the registration is marked paid', () => {
    expect(shouldShowPaymentInfo({ isRegistered: true, paid: true, hasPaymentInfo: true })).toBe(false)
  })

  it('hides payment info when unconfigured, even if registered and unpaid', () => {
    expect(shouldShowPaymentInfo({ isRegistered: true, paid: false, hasPaymentInfo: false })).toBe(false)
  })

  it('hides payment info when not registered', () => {
    expect(shouldShowPaymentInfo({ isRegistered: false, paid: null, hasPaymentInfo: true })).toBe(false)
  })

  it('treats a null paid value (legacy/unset) as unpaid', () => {
    expect(shouldShowPaymentInfo({ isRegistered: true, paid: null, hasPaymentInfo: true })).toBe(true)
  })

  it('shows payment info when only phone or only QR is configured', () => {
    expect(shouldShowPaymentInfo({ isRegistered: true, paid: false, hasPaymentInfo: true })).toBe(true)
  })
})
