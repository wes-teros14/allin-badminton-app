export interface MatchSlots {
  t1p1: string
  t1p2: string
  t2p1: string
  t2p2: string
}

export type SlotKey = keyof MatchSlots

export const EMPTY_SLOTS: MatchSlots = { t1p1: '', t1p2: '', t2p1: '', t2p2: '' }

export const SLOT_KEYS: readonly SlotKey[] = ['t1p1', 't1p2', 't2p1', 't2p2']

/**
 * Puts `id` into `key`. If that player already holds another slot the two
 * trade places, so a swap is one pick instead of a detour through a stranger.
 * Returns the slot the displaced player moved to, when a swap happened.
 */
export function assignSlot(
  slots: MatchSlots,
  key: SlotKey,
  id: string,
): { next: MatchSlots; swappedWith: SlotKey | null } {
  const from = id ? SLOT_KEYS.find((k) => k !== key && slots[k] === id) : undefined
  if (!from) return { next: { ...slots, [key]: id }, swappedWith: null }
  return { next: { ...slots, [key]: id, [from]: slots[key] }, swappedWith: from }
}
