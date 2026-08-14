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
