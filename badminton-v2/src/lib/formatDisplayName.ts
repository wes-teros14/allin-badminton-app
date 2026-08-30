/**
 * Resolves the label to show for a player: their nickname if one is set,
 * otherwise a Title Case version of their name_slug (e.g. "s1-wei-chen" -> "S1 Wei Chen")
 * so raw slugs never reach player-facing UI.
 */
export function formatDisplayName(nickname: string | null | undefined, nameSlug: string): string {
  if (nickname && nickname.trim().length > 0) return nickname
  return nameSlug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

/**
 * `profiles.nickname` is free text with no uniqueness constraint, so two
 * different players can both be "Alexis". Rendered side by side that reads as
 * one player entered twice, and in an edit dropdown the two are indistinguishable.
 *
 * For every group of players sharing a display name, this appends a qualifier
 * drawn from their (unique) name_slug — "Alexis (Cruz)" vs "Alexis (Santos)".
 * Players whose name is already unique are returned untouched.
 *
 * @returns Map of player id -> label to show.
 */
export function disambiguateDisplayNames(
  players: ReadonlyArray<{ id: string; nameSlug: string; displayName: string }>,
): Map<string, string> {
  const buckets = new Map<string, Array<{ id: string; nameSlug: string; displayName: string }>>()

  for (const player of players) {
    const key = player.displayName.trim().toLowerCase()
    const bucket = buckets.get(key)
    if (bucket) bucket.push(player)
    else buckets.set(key, [player])
  }

  const labels = new Map<string, string>()

  for (const bucket of buckets.values()) {
    if (bucket.length === 1) {
      labels.set(bucket[0].id, bucket[0].displayName)
      continue
    }

    const used = new Set<string>()
    bucket.forEach((player, index) => {
      const qualifier = slugQualifier(player.displayName, player.nameSlug)
      let label = `${player.displayName} (${qualifier})`
      // Slugs are unique, but the qualifier is a subset of one — two players can
      // still land on the same label. Fall back to a stable numeric suffix.
      if (used.has(label.toLowerCase())) label = `${player.displayName} (${qualifier} ${index + 1})`
      used.add(label.toLowerCase())
      labels.set(player.id, label)
    })
  }

  return labels
}

/** The parts of a name_slug that the display name does not already show. */
function slugQualifier(displayName: string, nameSlug: string): string {
  const shown = new Set(displayName.toLowerCase().split(/\s+/).filter(Boolean))
  const parts = nameSlug.split('-').filter(Boolean)
  const extra = parts.filter((part) => !shown.has(part.toLowerCase()))
  const source = extra.length > 0 ? extra : parts

  return source.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
}
