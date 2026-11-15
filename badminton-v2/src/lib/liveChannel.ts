import type { ConnectionStatus } from '@/lib/realtimePolicy'

/**
 * Live updates over Realtime Broadcast (migration 089).
 *
 * Database triggers send a small "changed" message to a topic whenever a row
 * changes; phones refetch what they show. This replaced Postgres Changes, whose
 * continuous poll was half of all database time on the Free instance (Nov 15
 * 2026, docs/qa-log.html).
 *
 *   session:<id>  matches, match_results, sessions, session_registrations, session_receipts
 *   user:<id>     notifications (with the row), player_stats, session_registrations (own)
 *
 * One channel per topic per phone, shared by every component that listens to
 * it: supabase.channel() returns the existing channel for a topic, so
 * components cannot each own one without tearing down each other's.
 */

export interface LiveMessage {
  table: string
  op: 'INSERT' | 'UPDATE' | 'DELETE' | string
  /** matches: the row's new status (null on DELETE). */
  status?: string | null
  /** user:<id> session_registrations: which session. */
  session_id?: string
  /** notifications: the inserted row. */
  record?: Record<string, unknown>
}

export type LiveListener = (message: LiveMessage) => void
export type LiveStatusListener = (status: ConnectionStatus) => void

export const sessionTopic = (sessionId: string) => `session:${sessionId}`
export const userTopic = (userId: string) => `user:${userId}`

/** Realtime channel states → the app's three connection states. */
export function toConnectionStatus(channelStatus: string): ConnectionStatus {
  if (channelStatus === 'SUBSCRIBED') return 'connected'
  if (channelStatus === 'CHANNEL_ERROR' || channelStatus === 'TIMED_OUT' || channelStatus === 'CLOSED') {
    return 'disconnected'
  }
  return 'reconnecting'
}

/** True when the message is about one of the tables the listener shows. */
export function isAbout(message: LiveMessage | null | undefined, tables: readonly string[]): boolean {
  return !!message && typeof message.table === 'string' && tables.includes(message.table)
}

// ---------------------------------------------------------------------------
// Shared, ref-counted channels
// ---------------------------------------------------------------------------

/** The slice of the Supabase client this module needs (a fake in tests). */
export interface LiveChannelLike {
  on(type: 'broadcast', filter: { event: string }, callback: (msg: { payload: unknown }) => void): LiveChannelLike
  subscribe(callback: (status: string) => void): LiveChannelLike
}
export interface LiveClientLike {
  channel(topic: string, opts: { config: { private: boolean } }): LiveChannelLike
  removeChannel(channel: LiveChannelLike): unknown
}

interface Entry {
  channel: LiveChannelLike
  listeners: Set<LiveListener>
  statusListeners: Set<LiveStatusListener>
  status: ConnectionStatus
}

export function createLiveRegistry(client: LiveClientLike) {
  const entries = new Map<string, Entry>()

  function open(topic: string): Entry {
    const entry: Entry = {
      channel: undefined as unknown as LiveChannelLike,
      listeners: new Set(),
      statusListeners: new Set(),
      status: 'reconnecting',
    }
    entry.channel = client
      .channel(topic, { config: { private: true } })
      .on('broadcast', { event: 'changed' }, ({ payload }) => {
        const message = payload as LiveMessage
        for (const listener of [...entry.listeners]) listener(message)
      })
      .subscribe((channelStatus) => {
        entry.status = toConnectionStatus(channelStatus)
        for (const listener of [...entry.statusListeners]) listener(entry.status)
      })
    entries.set(topic, entry)
    return entry
  }

  /**
   * Listen to a topic. The status listener is told the current state at once,
   * then every change. Returns the function that stops listening; the channel
   * closes when its last listener leaves.
   */
  function listen(topic: string, onMessage: LiveListener, onStatus?: LiveStatusListener): () => void {
    const entry = entries.get(topic) ?? open(topic)
    entry.listeners.add(onMessage)
    if (onStatus) {
      entry.statusListeners.add(onStatus)
      onStatus(entry.status)
    }
    let active = true
    return () => {
      if (!active) return
      active = false
      entry.listeners.delete(onMessage)
      if (onStatus) entry.statusListeners.delete(onStatus)
      if (entry.listeners.size === 0 && entries.get(topic) === entry) {
        entries.delete(topic)
        client.removeChannel(entry.channel)
      }
    }
  }

  return { listen, openTopics: () => [...entries.keys()] }
}
