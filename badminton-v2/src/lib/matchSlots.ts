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

/**
 * Player-dropdown grouping. A row whose pick would trade two slots is marked
 * three ways at once, because no single way survives every platform: it sits
 * under its own <optgroup>, it carries the ⇄ prefix, and it is painted
 * --swap-ink. The iOS and Android pickers drop <option> styling entirely, so
 * the colour is the one signal that does not reach a phone — the group header
 * and the prefix are plain text and reach everywhere.
 */
export const SWAP_GROUP_LABEL = 'In this match — picking swaps'
export const OTHER_GROUP_LABEL = 'Everyone else'
export const SWAP_PREFIX = '⇄  '

/**
 * Splits a player list into the swap candidates and everyone else. `currentId`
 * is the id already held by *this* dropdown: picking it again is a no-op, not a
 * swap, so it stays out of the swap group.
 */
export function partitionBySwap<T extends { id: string }>(
  players: readonly T[],
  taken: ReadonlySet<string> | readonly string[],
  currentId: string,
): { swaps: T[]; others: T[] } {
  const inMatch = taken instanceof Set ? taken : new Set(taken)
  const swaps: T[] = []
  const others: T[] = []
  for (const p of players) {
    if (p.id !== currentId && inMatch.has(p.id)) swaps.push(p)
    else others.push(p)
  }
  return { swaps, others }
}
