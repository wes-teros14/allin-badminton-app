import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  COALESCE_MS,
  JITTER_MS,
  POLL_CONNECTED_MS,
  POLL_FALLBACK_MS,
  coalesceDelay,
  createCoalescedRunner,
  pollIntervalFor,
} from '@/lib/realtimePolicy'

describe('pollIntervalFor', () => {
  it('polls slowly while Realtime is connected and fast otherwise', () => {
    expect(pollIntervalFor('connected')).toBe(POLL_CONNECTED_MS)
    expect(pollIntervalFor('reconnecting')).toBe(POLL_FALLBACK_MS)
    expect(pollIntervalFor('disconnected')).toBe(POLL_FALLBACK_MS)
    expect(POLL_CONNECTED_MS).toBeGreaterThan(POLL_FALLBACK_MS)
  })
})

describe('coalesceDelay', () => {
  it('stays within the coalesce window plus jitter', () => {
    expect(coalesceDelay(() => 0)).toBe(COALESCE_MS)
    expect(coalesceDelay(() => 0.999999)).toBeLessThan(COALESCE_MS + JITTER_MS)
  })
})

describe('createCoalescedRunner', () => {
  afterEach(() => { vi.useRealTimers() })

  it('runs once for a burst of events', () => {
    vi.useFakeTimers()
    const run = vi.fn()
    const runner = createCoalescedRunner(run, () => 300)

    // A finished match: match row, two result rows, next match promoted.
    runner.schedule(); runner.schedule(); runner.schedule(); runner.schedule()
    vi.advanceTimersByTime(299)
    expect(run).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('starts a new window after the previous one fired', () => {
    vi.useFakeTimers()
    const run = vi.fn()
    const runner = createCoalescedRunner(run, () => 100)

    runner.schedule()
    vi.advanceTimersByTime(100)
    runner.schedule()
    vi.advanceTimersByTime(100)
    expect(run).toHaveBeenCalledTimes(2)
  })

  it('cancel drops a pending run', () => {
    vi.useFakeTimers()
    const run = vi.fn()
    const runner = createCoalescedRunner(run, () => 100)

    runner.schedule()
    runner.cancel()
    vi.advanceTimersByTime(1000)
    expect(run).not.toHaveBeenCalled()
  })
})
