import { describe, expect, it } from 'vitest'
import {
  completedMatchUpdate,
  elapsedSecondsFromStartedAt,
  playingMatchUpdate,
  queuedMatchUpdate,
} from '@/utils/matchTiming'

describe('match timing helpers', () => {
  const nowMs = Date.parse('2026-05-18T10:05:30.000Z')

  it('computes elapsed seconds from an ISO started_at timestamp', () => {
    expect(elapsedSecondsFromStartedAt('2026-05-18T10:00:00.000Z', nowMs)).toBe(330)
  })

  it('returns null for missing or invalid timestamps', () => {
    expect(elapsedSecondsFromStartedAt(null, nowMs)).toBeNull()
    expect(elapsedSecondsFromStartedAt('not-a-date', nowMs)).toBeNull()
  })

  it('never returns a negative elapsed value for future timestamps', () => {
    expect(elapsedSecondsFromStartedAt('2026-05-18T10:06:00.000Z', nowMs)).toBe(0)
  })

  it('builds a complete update with duration only when started_at is valid', () => {
    expect(completedMatchUpdate('2026-05-18T10:00:00.000Z', nowMs)).toEqual({
      status: 'complete',
      duration_seconds: 330,
    })
    expect(completedMatchUpdate(null, nowMs)).toEqual({ status: 'complete' })
    expect(completedMatchUpdate('bad', nowMs)).toEqual({ status: 'complete' })
  })

  it('builds playing and queued transition payloads with started_at fields', () => {
    expect(playingMatchUpdate(2, '2026-05-18T10:00:00.000Z')).toEqual({
      status: 'playing',
      court_number: 2,
      started_at: '2026-05-18T10:00:00.000Z',
    })
    expect(queuedMatchUpdate(8)).toEqual({
      status: 'queued',
      court_number: null,
      started_at: null,
      queue_position: 8,
    })
  })
})
