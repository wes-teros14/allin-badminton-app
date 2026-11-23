import { describe, expect, it, vi } from 'vitest'

// Every query resolves empty with a zero count; `from` is counted so the test can see how many reads ran.
const from = vi.fn()
vi.mock('@/lib/supabase', () => ({ supabase: { from: (table: string) => from(table) } }))

import { fetchSeasonMatches } from '@/lib/seasonData'

function emptyQuery() {
  const q: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'gte', 'lt', 'order', 'range']) q[m] = () => q
  q.then = (resolve: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null, count: 0 }).then(resolve)
  return q
}

describe('fetchSeasonMatches', () => {
  it('shares one read between concurrent callers asking for the same window and rule', async () => {
    from.mockReset().mockImplementation(emptyQuery)
    const w = { start: '2026-11-16', end: null }
    await Promise.all([fetchSeasonMatches(w), fetchSeasonMatches(w), fetchSeasonMatches(w)])
    // One page read and one exact count.
    expect(from).toHaveBeenCalledTimes(2)
  })

  it('reads again once the shared read has settled (nothing is cached)', async () => {
    from.mockReset().mockImplementation(emptyQuery)
    const w = { start: '2026-11-16', end: null }
    await fetchSeasonMatches(w)
    await fetchSeasonMatches(w)
    expect(from).toHaveBeenCalledTimes(4)
  })

  it('does not share between the two rules', async () => {
    from.mockReset().mockImplementation(emptyQuery)
    const w = { start: null, end: '2026-11-16' }
    await Promise.all([fetchSeasonMatches(w), fetchSeasonMatches(w, { finishedSessionsOnly: true })])
    expect(from).toHaveBeenCalledTimes(4)
  })
})
