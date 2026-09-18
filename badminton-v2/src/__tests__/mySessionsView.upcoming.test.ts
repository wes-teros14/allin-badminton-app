import { describe, expect, it, vi } from 'vitest'
import { isUpcomingForPlayer } from '@/views/MySessionsView'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))

describe('isUpcomingForPlayer', () => {
  it('keeps every pre-complete status in Upcoming', () => {
    for (const status of ['registration_open', 'registration_closed', 'schedule_locked', 'in_progress']) {
      expect(isUpcomingForPlayer({ status, closed_at: null })).toBe(true)
    }
  })

  it('keeps a finished session in Upcoming until the admin closes it', () => {
    expect(isUpcomingForPlayer({ status: 'complete', closed_at: null })).toBe(true)
  })

  it('moves a closed session to Past', () => {
    expect(isUpcomingForPlayer({ status: 'complete', closed_at: '2026-09-19T01:30:00Z' })).toBe(false)
  })

  it('never shows a setup session as upcoming', () => {
    expect(isUpcomingForPlayer({ status: 'setup', closed_at: null })).toBe(false)
  })
})
