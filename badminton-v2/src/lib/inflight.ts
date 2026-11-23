const pending = new Map<string, Promise<unknown>>()

/**
 * Shares one pending read between callers that ask for the same `key` at the same time. The entry is
 * dropped as soon as the read settles, success or failure: nothing is cached, so a later call always
 * reads fresh rows, and a rejection is never replayed to a later caller.
 *
 * Keys are global; prefix them with the reader's name so different reads never collide.
 */
export function shareInFlight<T>(key: string, read: () => Promise<T>): Promise<T> {
  const existing = pending.get(key)
  if (existing) return existing as Promise<T>
  const started = read()
  pending.set(key, started)
  const forget = () => { if (pending.get(key) === started) pending.delete(key) }
  started.then(forget, forget)
  return started
}
