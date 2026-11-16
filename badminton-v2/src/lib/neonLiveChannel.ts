import type { ConnectionStatus } from '@/lib/realtimePolicy'
import type { LiveListener, LiveMessage, LiveStatusListener } from '@/lib/liveChannel'

/**
 * Live updates over Neon Realtime — the same `listen(topic, onMessage, onStatus)`
 * as the Supabase Broadcast registry in liveChannel.ts, so no screen changes.
 *
 * Triggers append a row to `live_messages(id, topic, msg)` (scripts/neon/transform.sql).
 * Each topic is one live query, `SELECT id, msg FROM live_messages WHERE topic = $1`,
 * subscribed with a 60-second pass from the `seal` Function (functions/seal).
 *
 *  - Messages are the rows the subscription *adds*. The first result (up to
 *    10 minutes of old rows) is a baseline, not news; `remove` changes are the
 *    purge. Rows are delivered once, in id order, and one transaction can carry
 *    several (G2: `complete` + `playing` arrive together).
 *  - After a gap (error, or a hidden tab coming back) the new first result is
 *    compared with the baseline, so rows that landed meanwhile are still
 *    delivered — within the 10-minute purge window.
 *  - Each pass is renewed RENEW_LEAD_MS before it expires. Failures back off
 *    5/10/20/30 s: every phone in the hall runs this, so a flat short retry
 *    would be the Oct 4 2026 load pattern.
 *  - A tab hidden for HIDDEN_GRACE_MS closes its subscriptions, so the database
 *    can sleep (subscribing wakes it). Coming back reopens them and reports
 *    reconnecting → connected, which triggers the screens' catch-up refetch.
 */

export const RENEW_LEAD_MS = 15_000
export const HIDDEN_GRACE_MS = 60_000
const BACKOFF_MS = [5_000, 10_000, 20_000, 30_000] as const

/** What the seal Function returns: an opaque, 60-second subscription capability. */
export interface SealedPass {
  capability: string
  expiresAt: number
  queryFingerprint: string
}

type LiveRow = { id: string | number; msg: LiveMessage }
type RawUpdate =
  | { type: 'rows'; rows: readonly { row: LiveRow }[] }
  | { type: 'changes'; changes: readonly ({ type: string; row?: LiveRow })[] }

/** The slice of `@neon/realtime/client` this module needs (a fake in tests). */
export interface NeonSubscriptionLike {
  onUpdate(listener: (update: RawUpdate) => void): () => void
  onStateChange(listener: (state: { status: string }) => void): () => void
  renew(pass: SealedPass): Promise<void>
  unsubscribe(): void
}
export interface NeonRealtimeClientLike {
  subscribe(pass: SealedPass): NeonSubscriptionLike
  close(): void
}

export interface NeonLiveDeps {
  createClient: () => Promise<NeonRealtimeClientLike>
  /** Fetches a pass for `topic` from the seal Function; throws when refused or unreachable. */
  seal: (topic: string) => Promise<SealedPass>
  now?: () => number
  visibility?: { isVisible(): boolean; onChange(listener: () => void): () => void }
}

interface Entry {
  topic: string
  listeners: Set<LiveListener>
  statusListeners: Set<LiveStatusListener>
  status: ConnectionStatus
  sub: NeonSubscriptionLike | null
  /** Bumped on every open/close, so a late async result from an older attempt is dropped. */
  generation: number
  timer: ReturnType<typeof setTimeout> | undefined
  failures: number
  /** Highest message id handled; null until the first result sets the baseline. */
  lastId: number | null
}

export function createNeonLiveRegistry(deps: NeonLiveDeps) {
  const now = deps.now ?? Date.now
  const visibility = deps.visibility ?? browserVisibility()
  const entries = new Map<string, Entry>()
  let clientPromise: Promise<NeonRealtimeClientLike> | null = null
  let hiddenTimer: ReturnType<typeof setTimeout> | undefined
  let suspended = !visibility.isVisible()

  function client(): Promise<NeonRealtimeClientLike> {
    clientPromise ??= deps.createClient().catch((err) => {
      clientPromise = null
      throw err
    })
    return clientPromise
  }

  function closeClientIfIdle() {
    if ([...entries.values()].some((e) => e.sub) || !clientPromise) return
    const closing = clientPromise
    clientPromise = null
    void closing.then((c) => c.close(), () => {})
  }

  function setStatus(entry: Entry, status: ConnectionStatus) {
    if (entry.status === status) return
    entry.status = status
    for (const listener of [...entry.statusListeners]) listener(status)
  }

  function deliver(entry: Entry, rows: readonly LiveRow[]) {
    const fresh = rows
      .map((row) => ({ id: Number(row.id), msg: row.msg }))
      .filter((row) => Number.isFinite(row.id) && (entry.lastId === null || row.id > entry.lastId))
      .sort((a, b) => a.id - b.id)
    if (fresh.length === 0) return
    entry.lastId = fresh[fresh.length - 1].id
    for (const { msg } of fresh) {
      for (const listener of [...entry.listeners]) listener(msg)
    }
  }

  function clearTimer(entry: Entry) {
    if (entry.timer !== undefined) clearTimeout(entry.timer)
    entry.timer = undefined
  }

  /** Closes the subscription and cancels pending work; keeps listeners and the baseline. */
  function teardown(entry: Entry) {
    entry.generation++
    clearTimer(entry)
    entry.sub?.unsubscribe()
    entry.sub = null
  }

  function backoff(entry: Entry): number {
    const delay = BACKOFF_MS[Math.min(entry.failures, BACKOFF_MS.length - 1)]
    entry.failures++
    return delay
  }

  function fail(entry: Entry) {
    teardown(entry)
    setStatus(entry, 'disconnected')
    entry.timer = setTimeout(() => void open(entry), backoff(entry))
  }

  async function open(entry: Entry) {
    teardown(entry)
    if (suspended) return
    const generation = entry.generation
    setStatus(entry, 'reconnecting')
    let pass: SealedPass
    let realtime: NeonRealtimeClientLike
    try {
      pass = await deps.seal(entry.topic)
      realtime = await client()
    } catch {
      if (entry.generation === generation) fail(entry)
      return
    }
    if (entry.generation !== generation) return

    const sub = realtime.subscribe(pass)
    entry.sub = sub
    sub.onUpdate((update) => {
      if (entry.sub !== sub) return
      if (update.type === 'rows') {
        if (entry.lastId === null) {
          // The first result is the baseline: everything in it happened before we arrived.
          entry.lastId = Math.max(0, ...update.rows.map(({ row }) => Number(row.id)).filter(Number.isFinite))
        } else {
          deliver(entry, update.rows.map(({ row }) => row))
        }
        return
      }
      deliver(entry, update.changes.flatMap((change) => (change.type === 'upsert' && change.row ? [change.row] : [])))
    })
    sub.onStateChange((state) => {
      if (entry.sub !== sub) return
      if (state.status === 'live') {
        entry.failures = 0
        setStatus(entry, 'connected')
      } else if (state.status === 'error') {
        fail(entry)
      } else if (state.status === 'connecting' || state.status === 'stale') {
        setStatus(entry, 'reconnecting')
      }
    })
    scheduleRenewal(entry, pass.expiresAt)
  }

  function scheduleRenewal(entry: Entry, expiresAt: number, delay = expiresAt - RENEW_LEAD_MS - now()) {
    clearTimer(entry)
    const generation = entry.generation
    entry.timer = setTimeout(async () => {
      const sub = entry.sub
      if (!sub || entry.generation !== generation) return
      try {
        const pass = await deps.seal(entry.topic)
        if (entry.sub !== sub || entry.generation !== generation) return
        await sub.renew(pass)
        if (entry.sub !== sub || entry.generation !== generation) return
        entry.failures = 0
        scheduleRenewal(entry, pass.expiresAt)
      } catch {
        if (entry.sub !== sub || entry.generation !== generation) return
        // Keep the subscription: if the pass expires first it goes stale (reconnecting) and recovers on renewal.
        scheduleRenewal(entry, expiresAt, backoff(entry))
      }
    }, Math.max(0, delay))
  }

  visibility.onChange(() => {
    if (visibility.isVisible()) {
      if (hiddenTimer !== undefined) clearTimeout(hiddenTimer)
      hiddenTimer = undefined
      if (!suspended) return
      suspended = false
      for (const entry of entries.values()) {
        entry.failures = 0
        void open(entry)
      }
    } else if (hiddenTimer === undefined && !suspended) {
      hiddenTimer = setTimeout(() => {
        hiddenTimer = undefined
        suspended = true
        for (const entry of entries.values()) {
          teardown(entry)
          setStatus(entry, 'reconnecting')
        }
        closeClientIfIdle()
      }, HIDDEN_GRACE_MS)
    }
  })

  /**
   * Listen to a topic. The status listener is told the current state at once,
   * then every change. Returns the function that stops listening; the
   * subscription closes when its last listener leaves.
   */
  function listen(topic: string, onMessage: LiveListener, onStatus?: LiveStatusListener): () => void {
    let entry = entries.get(topic)
    if (!entry) {
      entry = {
        topic,
        listeners: new Set(),
        statusListeners: new Set(),
        status: 'reconnecting',
        sub: null,
        generation: 0,
        timer: undefined,
        failures: 0,
        lastId: null,
      }
      entries.set(topic, entry)
      void open(entry)
    }
    const current = entry
    current.listeners.add(onMessage)
    if (onStatus) {
      current.statusListeners.add(onStatus)
      onStatus(current.status)
    }
    let active = true
    return () => {
      if (!active) return
      active = false
      current.listeners.delete(onMessage)
      if (onStatus) current.statusListeners.delete(onStatus)
      if (current.listeners.size === 0 && entries.get(topic) === current) {
        entries.delete(topic)
        teardown(current)
        closeClientIfIdle()
      }
    }
  }

  return { listen, openTopics: () => [...entries.keys()] }
}

function browserVisibility(): NonNullable<NeonLiveDeps['visibility']> {
  if (typeof document === 'undefined') return { isVisible: () => true, onChange: () => () => {} }
  return {
    isVisible: () => document.visibilityState !== 'hidden',
    onChange: (listener) => {
      document.addEventListener('visibilitychange', listener)
      return () => document.removeEventListener('visibilitychange', listener)
    },
  }
}
