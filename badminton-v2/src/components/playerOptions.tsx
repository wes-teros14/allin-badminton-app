import { OTHER_GROUP_LABEL, SWAP_GROUP_LABEL, SWAP_PREFIX, partitionBySwap } from '@/lib/matchSlots'

/**
 * The <option> list shared by every match-edit player dropdown (the generator
 * panel's four-slot picker and the court/queue edit form). Players already in
 * the match are hoisted into their own group, prefixed with ⇄ and painted
 * --swap-ink on a --primary-subtle band, so the rows whose pick trades two
 * slots are found by position rather than by reading to the end of a name. See
 * `partitionBySwap` for why all three markers are needed rather than just the
 * colour. The band is not decoration: it is what makes the text legible without
 * knowing what the native popup paints behind it (6.1:1 light, 8.6:1 dark).
 *
 * Caller owns the leading placeholder <option>. With no swap candidates the
 * list stays flat — an "Everyone else" header on its own says nothing.
 */
export function renderPlayerOptions<T extends { id: string }>(
  players: readonly T[],
  taken: ReadonlySet<string> | readonly string[],
  currentId: string,
  label: (player: T) => string,
) {
  const { swaps, others } = partitionBySwap(players, taken, currentId)
  const plain = others.map((p) => (
    <option key={p.id} value={p.id}>
      {label(p)}
    </option>
  ))
  if (swaps.length === 0) return plain
  return (
    <>
      <optgroup label={SWAP_GROUP_LABEL}>
        {swaps.map((p) => (
          <option key={p.id} value={p.id} className="bg-primary-subtle text-swap-ink font-semibold">
            {SWAP_PREFIX}
            {label(p)}
          </option>
        ))}
      </optgroup>
      <optgroup label={OTHER_GROUP_LABEL}>{plain}</optgroup>
    </>
  )
}
