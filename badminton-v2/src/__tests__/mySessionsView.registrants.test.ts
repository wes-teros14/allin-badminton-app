import { describe, expect, it, vi } from 'vitest'
import { registrantsCountLabel } from '@/views/MySessionsView'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
}))

describe('registrantsCountLabel', () => {
  it('shows the count against the limit', () => {
    expect(registrantsCountLabel(9, 14)).toBe('9 of 14 going')
  })

  it('says the session is full once every slot is taken', () => {
    expect(registrantsCountLabel(14, 14)).toBe('All 14 slots taken')
    expect(registrantsCountLabel(15, 14)).toBe('All 14 slots taken')
  })

  it('drops the limit when the session has none', () => {
    expect(registrantsCountLabel(11, null)).toBe('11 going')
    expect(registrantsCountLabel(11, undefined)).toBe('11 going')
  })
})
