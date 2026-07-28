import { describe, expect, it, vi } from 'vitest'
import { compareSessionsByScheduledDate } from '@/views/MySessionsView'
import type { SessionPickerItem } from '@/hooks/usePlayerSessions'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
}))

function session(overrides: Partial<SessionPickerItem> & { id: string; date: string }): SessionPickerItem {
  return {
    name: 'Session',
    time: null,
    duration: null,
    venue: null,
    status: 'registration_open',
    completed_at: null,
    price: null,
    session_notes: null,
    registration_opens_at: null,
    isRegistered: false,
    paid: null,
    ...overrides,
  }
}

describe('compareSessionsByScheduledDate', () => {
  it('sorts three sessions on different dates ascending', () => {
    const jul30 = session({ id: 'jul30', date: '2026-07-30' })
    const aug2 = session({ id: 'aug2', date: '2026-08-02' })
    const aug5 = session({ id: 'aug5', date: '2026-08-05' })

    const sorted = [aug5, jul30, aug2].sort(compareSessionsByScheduledDate)

    expect(sorted.map((s) => s.id)).toEqual(['jul30', 'aug2', 'aug5'])
  })

  it('breaks same-date ties by ascending time', () => {
    const later = session({ id: 'later', date: '2026-08-02', time: '18:00:00' })
    const earlier = session({ id: 'earlier', date: '2026-08-02', time: '09:00:00' })

    const sorted = [later, earlier].sort(compareSessionsByScheduledDate)

    expect(sorted.map((s) => s.id)).toEqual(['earlier', 'later'])
  })

  it('is a no-op for a single session', () => {
    const only = session({ id: 'only', date: '2026-08-02' })

    const sorted = [only].sort(compareSessionsByScheduledDate)

    expect(sorted.map((s) => s.id)).toEqual(['only'])
  })

  it('sorts a session with a null time after one with a set time on the same date', () => {
    const withTime = session({ id: 'withTime', date: '2026-08-02', time: '09:00:00' })
    const noTime = session({ id: 'noTime', date: '2026-08-02', time: null })

    const sorted = [noTime, withTime].sort(compareSessionsByScheduledDate)

    expect(sorted.map((s) => s.id)).toEqual(['withTime', 'noTime'])
  })
})
