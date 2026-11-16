import { describe, expect, it, vi } from 'vitest'
import { createOpenDueRegistrations, OPEN_DUE_MIN_INTERVAL_MS } from '@/lib/openDueRegistrations'

function setup(opts: { enabled?: boolean; error?: unknown } = {}) {
  let now = 1_000_000
  const call = vi.fn(async () => ({ error: opts.error ?? null }))
  const log = vi.fn()
  const openDue = createOpenDueRegistrations({ call, enabled: opts.enabled ?? true, now: () => now, log })
  return { openDue, call, log, advance: (ms: number) => { now += ms } }
}

describe('openDueRegistrations', () => {
  it('does nothing when data is not on Neon (Supabase pg_cron still opens sessions)', async () => {
    const { openDue, call } = setup({ enabled: false })
    await openDue()
    expect(call).not.toHaveBeenCalled()
  })

  it('asks the database once, then not again within a minute', async () => {
    const { openDue, call, advance } = setup()
    await openDue()
    advance(OPEN_DUE_MIN_INTERVAL_MS - 1)
    await openDue()
    expect(call).toHaveBeenCalledTimes(1)
    advance(1)
    await openDue()
    expect(call).toHaveBeenCalledTimes(2)
  })

  it('callers arriving together share one request', async () => {
    const { openDue, call } = setup()
    await Promise.all([openDue(), openDue(), openDue()])
    expect(call).toHaveBeenCalledTimes(1)
  })

  it('a failure is logged and never thrown, so the sessions still load', async () => {
    const { openDue, log } = setup({ error: { code: 'PGRST202', message: 'not found' } })
    await expect(openDue()).resolves.toBeUndefined()
    expect(log).toHaveBeenCalledTimes(1)
  })

  it('a rejected call is also swallowed', async () => {
    let now = 0
    const log = vi.fn()
    const openDue = createOpenDueRegistrations({ call: async () => { throw new Error('offline') }, enabled: true, now: () => now++, log })
    await expect(openDue()).resolves.toBeUndefined()
    expect(log).toHaveBeenCalledTimes(1)
  })

  it('after a failure it waits the same minute before trying again', async () => {
    const { openDue, call, advance } = setup({ error: { message: 'boom' } })
    await openDue()
    await openDue()
    expect(call).toHaveBeenCalledTimes(1)
    advance(OPEN_DUE_MIN_INTERVAL_MS)
    await openDue()
    expect(call).toHaveBeenCalledTimes(2)
  })
})
