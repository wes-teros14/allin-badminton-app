import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createNeonLiveRegistry,
  HIDDEN_GRACE_MS,
  RENEW_LEAD_MS,
  type NeonRealtimeClientLike,
  type NeonSubscriptionLike,
  type SealedPass,
} from '@/lib/neonLiveChannel'
import type { ConnectionStatus } from '@/lib/realtimePolicy'
import type { LiveMessage } from '@/lib/liveChannel'

type Row = { id: string; msg: LiveMessage }
type Update =
  | { type: 'rows'; rows: { rowId: string; row: Row }[] }
  | { type: 'changes'; changes: ({ type: 'upsert'; rowId: string; row: Row } | { type: 'remove'; rowId: string })[]; batch: { txids: string[] } }

/** A fake Realtime subscription the test drives by hand. */
class FakeSub implements NeonSubscriptionLike {
  updateListeners = new Set<(u: Update) => void>()
  stateListeners = new Set<(s: { status: string; error?: { retryable: boolean } }) => void>()
  renewals: SealedPass[] = []
  closed = false
  renewImpl: (q: SealedPass) => Promise<void> = async () => {}
  constructor(public pass: SealedPass) {}
  onUpdate(l: (u: Update) => void) { this.updateListeners.add(l); return () => this.updateListeners.delete(l) }
  onStateChange(l: (s: { status: string }) => void) { this.stateListeners.add(l); return () => this.stateListeners.delete(l) }
  async renew(q: SealedPass) { this.renewals.push(q); await this.renewImpl(q) }
  unsubscribe() { this.closed = true }
  // test helpers
  state(status: string, error?: { retryable: boolean }) { for (const l of [...this.stateListeners]) l({ status, error }) }
  rows(...ids: number[]) { this.emit({ type: 'rows', rows: ids.map((id) => ({ rowId: `r${id}`, row: row(id) })) }) }
  changes(...ids: number[]) {
    this.emit({ type: 'changes', changes: ids.map((id) => ({ type: 'upsert' as const, rowId: `r${id}`, row: row(id) })), batch: { txids: ['1'] } })
  }
  removes(...ids: number[]) {
    this.emit({ type: 'changes', changes: ids.map((id) => ({ type: 'remove' as const, rowId: `r${id}` })), batch: { txids: ['2'] } })
  }
  emit(u: Update) { for (const l of [...this.updateListeners]) l(u) }
}

const row = (id: number): Row => ({ id: String(id), msg: { table: 'matches', op: 'UPDATE', status: `s${id}` } })

let now = 0
let subs: FakeSub[]
let clients: { subs: FakeSub[]; closed: boolean }[]
let sealCalls: string[]
let sealImpl: (topic: string) => Promise<SealedPass>
let visible: boolean
let visibilityListeners: Set<() => void>

function makeRegistry() {
  return createNeonLiveRegistry({
    createClient: async () => {
      const c = { subs: [] as FakeSub[], closed: false }
      clients.push(c)
      const client: NeonRealtimeClientLike = {
        subscribe: (pass) => { const s = new FakeSub(pass); subs.push(s); c.subs.push(s); return s },
        close: () => { c.closed = true },
      }
      return client
    },
    seal: (topic) => { sealCalls.push(topic); return sealImpl(topic) },
    now: () => now,
    visibility: {
      isVisible: () => visible,
      onChange: (cb) => { visibilityListeners.add(cb); return () => visibilityListeners.delete(cb) },
    },
  })
}

function setVisible(v: boolean) { visible = v; for (const l of [...visibilityListeners]) l() }
const flush = () => vi.advanceTimersByTimeAsync(0)
const T = 'session:abc'

beforeEach(() => {
  vi.useFakeTimers()
  now = 1_000_000
  subs = []
  clients = []
  sealCalls = []
  visible = true
  visibilityListeners = new Set()
  sealImpl = async (topic) => ({ capability: `cap-${topic}-${sealCalls.length}`, expiresAt: now + 60_000, queryFingerprint: `fp-${topic}` })
})
afterEach(() => vi.useRealTimers())

describe('neon live registry — delivery', () => {
  it('ignores the initial snapshot and delivers each new row, in id order', async () => {
    const reg = makeRegistry()
    const got: LiveMessage[] = []
    reg.listen(T, (m) => got.push(m))
    await flush()
    subs[0].rows(1, 2, 3)
    subs[0].changes(5, 4)
    expect(got.map((m) => m.status)).toEqual(['s4', 's5'])
  })

  it('one event carrying two rows gives two messages (complete + playing in one transaction)', async () => {
    const reg = makeRegistry()
    const got: LiveMessage[] = []
    reg.listen(T, (m) => got.push(m))
    await flush()
    subs[0].rows()
    subs[0].changes(10, 11)
    expect(got).toHaveLength(2)
  })

  it('ignores remove changes (the 10-minute purge)', async () => {
    const reg = makeRegistry()
    const got: LiveMessage[] = []
    reg.listen(T, (m) => got.push(m))
    await flush()
    subs[0].rows(1, 2)
    subs[0].removes(1, 2)
    expect(got).toEqual([])
  })

  it('never delivers the same row twice', async () => {
    const reg = makeRegistry()
    const got: LiveMessage[] = []
    reg.listen(T, (m) => got.push(m))
    await flush()
    subs[0].rows(1)
    subs[0].changes(2)
    subs[0].changes(2)
    expect(got).toHaveLength(1)
  })

  it('shares one subscription per topic; every listener hears each message', async () => {
    const reg = makeRegistry()
    const a: LiveMessage[] = []
    const b: LiveMessage[] = []
    reg.listen(T, (m) => a.push(m))
    reg.listen(T, (m) => b.push(m))
    await flush()
    expect(subs).toHaveLength(1)
    expect(sealCalls).toEqual([T])
    subs[0].rows()
    subs[0].changes(1)
    expect([a.length, b.length]).toEqual([1, 1])
  })
})

describe('neon live registry — status', () => {
  it('reports reconnecting at once, connected when live', async () => {
    const reg = makeRegistry()
    const statuses: ConnectionStatus[] = []
    reg.listen(T, () => {}, (s) => statuses.push(s))
    await flush()
    subs[0].state('live')
    expect(statuses).toEqual(['reconnecting', 'connected'])
  })

  it('a stale (expired) pass reports reconnecting', async () => {
    const reg = makeRegistry()
    const statuses: ConnectionStatus[] = []
    reg.listen(T, () => {}, (s) => statuses.push(s))
    await flush()
    subs[0].state('live')
    subs[0].state('stale')
    expect(statuses.at(-1)).toBe('reconnecting')
  })
})

describe('neon live registry — renewal', () => {
  it(`renews ${RENEW_LEAD_MS / 1000} s before the pass expires, with a fresh pass for the same topic`, async () => {
    const reg = makeRegistry()
    reg.listen(T, () => {})
    await flush()
    expect(subs[0].renewals).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(60_000 - RENEW_LEAD_MS - 1)
    expect(subs[0].renewals).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(1)
    expect(sealCalls).toEqual([T, T])
    expect(subs[0].renewals).toHaveLength(1)
  })

  it('keeps renewing, once per pass', async () => {
    const reg = makeRegistry()
    reg.listen(T, () => {})
    await flush()
    now += 45_000
    await vi.advanceTimersByTimeAsync(45_000)
    now += 45_000
    await vi.advanceTimersByTimeAsync(45_000)
    expect(subs[0].renewals).toHaveLength(2)
  })

  it('a failed renewal is retried with backoff, not dropped', async () => {
    const reg = makeRegistry()
    reg.listen(T, () => {})
    await flush()
    sealImpl = async () => { throw new Error('seal 503') }
    await vi.advanceTimersByTimeAsync(45_000)
    expect(subs[0].renewals).toHaveLength(0)
    sealImpl = async (topic) => ({ capability: `cap-${topic}`, expiresAt: now + 60_000, queryFingerprint: `fp-${topic}` })
    await vi.advanceTimersByTimeAsync(5_000)
    expect(subs[0].renewals).toHaveLength(1)
  })
})

describe('neon live registry — failures', () => {
  it('a failed seal reports disconnected and retries after 5 s, then 10 s', async () => {
    sealImpl = async () => { throw new Error('seal 503') }
    const reg = makeRegistry()
    const statuses: ConnectionStatus[] = []
    reg.listen(T, () => {}, (s) => statuses.push(s))
    await flush()
    expect(statuses.at(-1)).toBe('disconnected')
    expect(sealCalls).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(4_999)
    expect(sealCalls).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(sealCalls).toHaveLength(2)
    await vi.advanceTimersByTimeAsync(9_999)
    expect(sealCalls).toHaveLength(2)
    await vi.advanceTimersByTimeAsync(1)
    expect(sealCalls).toHaveLength(3)
  })

  it('an error state tears the subscription down and resubscribes with a new pass after backoff', async () => {
    const reg = makeRegistry()
    const statuses: ConnectionStatus[] = []
    reg.listen(T, () => {}, (s) => statuses.push(s))
    await flush()
    subs[0].state('live')
    subs[0].state('error', { retryable: true })
    expect(statuses.at(-1)).toBe('disconnected')
    expect(subs[0].closed).toBe(true)
    await vi.advanceTimersByTimeAsync(5_000)
    expect(subs).toHaveLength(2)
  })

  it('after an error, rows missed during the gap are delivered once from the new snapshot', async () => {
    const reg = makeRegistry()
    const got: LiveMessage[] = []
    reg.listen(T, (m) => got.push(m))
    await flush()
    subs[0].rows(1)
    subs[0].changes(2)
    subs[0].state('error', { retryable: true })
    await vi.advanceTimersByTimeAsync(5_000)
    subs[1].rows(1, 2, 3, 4)
    expect(got.map((m) => m.status)).toEqual(['s2', 's3', 's4'])
  })

  it('a success resets the backoff', async () => {
    const reg = makeRegistry()
    reg.listen(T, () => {})
    await flush()
    subs[0].state('error', { retryable: true })
    await vi.advanceTimersByTimeAsync(5_000)
    subs[1].state('live')
    subs[1].state('error', { retryable: true })
    await vi.advanceTimersByTimeAsync(5_000)
    expect(subs).toHaveLength(3)
  })
})

describe('neon live registry — lifecycle', () => {
  it('closes the subscription and the client when the last listener leaves', async () => {
    const reg = makeRegistry()
    const stopA = reg.listen(T, () => {})
    const stopB = reg.listen(T, () => {})
    await flush()
    stopA()
    expect(subs[0].closed).toBe(false)
    stopB()
    expect(subs[0].closed).toBe(true)
    await flush() // the client is created asynchronously, so it closes a tick later
    expect(clients[0].closed).toBe(true)
    expect(reg.openTopics()).toEqual([])
  })

  it('stops renewing after the last listener leaves', async () => {
    const reg = makeRegistry()
    const stop = reg.listen(T, () => {})
    await flush()
    stop()
    await vi.advanceTimersByTimeAsync(120_000)
    expect(sealCalls).toEqual([T])
  })

  it('a pass that arrives after the listener left is not used', async () => {
    let release!: (p: SealedPass) => void
    sealImpl = () => new Promise((r) => { release = r })
    const reg = makeRegistry()
    const stop = reg.listen(T, () => {})
    await flush()
    stop()
    release({ capability: 'late', expiresAt: now + 60_000, queryFingerprint: 'fp' })
    await flush()
    expect(subs).toHaveLength(0)
  })

  it(`a tab hidden for over ${HIDDEN_GRACE_MS / 1000} s closes its subscriptions; visible again reopens and delivers what it missed`, async () => {
    const reg = makeRegistry()
    const got: LiveMessage[] = []
    const statuses: ConnectionStatus[] = []
    reg.listen(T, (m) => got.push(m), (s) => statuses.push(s))
    await flush()
    subs[0].rows(1)
    subs[0].state('live')
    setVisible(false)
    await vi.advanceTimersByTimeAsync(HIDDEN_GRACE_MS - 1)
    expect(subs[0].closed).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(subs[0].closed).toBe(true)
    expect(clients[0].closed).toBe(true)
    expect(statuses.at(-1)).toBe('reconnecting')
    // No renewals while hidden.
    const sealsWhileHidden = sealCalls.length
    await vi.advanceTimersByTimeAsync(300_000)
    expect(sealCalls).toHaveLength(sealsWhileHidden)

    setVisible(true)
    await flush()
    expect(subs).toHaveLength(2)
    subs[1].rows(1, 2, 3)
    subs[1].state('live')
    expect(got.map((m) => m.status)).toEqual(['s2', 's3'])
    expect(statuses.at(-1)).toBe('connected')
  })

  it('a short trip away (under the grace period) keeps the subscription', async () => {
    const reg = makeRegistry()
    reg.listen(T, () => {})
    await flush()
    setVisible(false)
    await vi.advanceTimersByTimeAsync(10_000)
    setVisible(true)
    await vi.advanceTimersByTimeAsync(HIDDEN_GRACE_MS)
    expect(subs).toHaveLength(1)
    expect(subs[0].closed).toBe(false)
  })

  it('a listener added while hidden waits until the tab is visible', async () => {
    visible = false
    const reg = makeRegistry()
    reg.listen(T, () => {})
    await flush()
    expect(sealCalls).toHaveLength(0)
    setVisible(true)
    await flush()
    expect(subs).toHaveLength(1)
  })
})
