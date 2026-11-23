import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))

import { longestAttendanceRun } from '@/lib/awardsLeaderboard'

describe('longestAttendanceRun', () => {
  it('counts the longest unbroken run of attended sessions', () => {
    expect(longestAttendanceRun(['s1', 's2', 's3', 's4'], new Set(['s1', 's2', 's4']))).toBe(2)
  })

  it('is 0 when nothing was attended and ignores sessions outside the order', () => {
    expect(longestAttendanceRun(['s1', 's2'], new Set())).toBe(0)
    expect(longestAttendanceRun(['s1', 's2'], new Set(['x', 'y', 'z']))).toBe(0)
  })

  it('restarts after a miss and keeps the best run', () => {
    expect(longestAttendanceRun(['a', 'b', 'c', 'd', 'e', 'f'], new Set(['a', 'c', 'd', 'e']))).toBe(3)
  })
})
