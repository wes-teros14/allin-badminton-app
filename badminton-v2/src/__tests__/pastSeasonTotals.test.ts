import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))

const fetchAttendance = vi.fn()
const fetchSeasonMatches = vi.fn()
vi.mock('@/lib/seasonData', () => ({
  fetchAttendance: (...a: unknown[]) => fetchAttendance(...a),
  fetchSeasonMatches: (...a: unknown[]) => fetchSeasonMatches(...a),
  fetchSeasonCheers: vi.fn(),
}))

import { pastSeasonTotals } from '@/hooks/useSeasonStats'
import type { Season } from '@/lib/season'

const floors = { played: 3, individual: 4, cheers: 4, earlyBird: 8 }
const season = (id: string): Season => ({ id, start: '1970-01-01', floors, floorWindowDays: null })

const attendance = [
  { sessionId: 's1', sessionDate: '2026-03-22', playerId: 'a', source: 'self', registeredAt: '' },
  { sessionId: 's2', sessionDate: '2026-03-29', playerId: 'a', source: 'self', registeredAt: '' },
]

describe('pastSeasonTotals', () => {
  it('reads an ended season once per visit and serves every later open from memory', async () => {
    fetchAttendance.mockReset().mockResolvedValue(attendance)
    fetchSeasonMatches.mockReset().mockResolvedValue([])
    const s = season('test-once')
    const first = await pastSeasonTotals(s)
    const second = await pastSeasonTotals(s)
    expect(first.sessions.get('a')).toBe(2)
    expect(second).toBe(first)
    expect(fetchAttendance).toHaveBeenCalledTimes(1)
    expect(fetchSeasonMatches).toHaveBeenCalledTimes(1)
  })

  it('does not keep a failed read, so the next open retries it', async () => {
    fetchAttendance.mockReset().mockRejectedValueOnce(new Error('down')).mockResolvedValue(attendance)
    fetchSeasonMatches.mockReset().mockResolvedValue([])
    const s = season('test-retry')
    await expect(pastSeasonTotals(s)).rejects.toThrow('down')
    const retried = await pastSeasonTotals(s)
    expect(retried.sessions.get('a')).toBe(2)
    expect(fetchAttendance).toHaveBeenCalledTimes(2)
  })
})
