import { describe, expect, it } from 'vitest'
import { buildStartingCourtAssignments } from '@/lib/courts'

describe('session court flow helpers', () => {
  it('assigns the first queued matches across the configured court count', () => {
    expect(buildStartingCourtAssignments([
      { id: 'm1' },
      { id: 'm2' },
      { id: 'm3' },
      { id: 'm4' },
    ], 3)).toEqual([
      { id: 'm1', courtNumber: 1 },
      { id: 'm2', courtNumber: 2 },
      { id: 'm3', courtNumber: 3 },
    ])
  })
})
