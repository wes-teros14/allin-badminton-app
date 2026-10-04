/**
 * Base `name_slug` for a new profile — the same rules as the database's
 * `handle_new_user()` trigger (migration 011): strip anything but letters,
 * digits, spaces and hyphens, turn whitespace into hyphens, lower-case, trim
 * hyphens, fall back to "user". Uniqueness is handled by the caller.
 */
export function baseProfileSlug(displayName: string | null | undefined): string {
  const slug = (displayName ?? '')
    .replace(/[^a-zA-Z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase()
    .replace(/^-+|-+$/g, '')
  return slug || 'user'
}

/** The name a Google sign-in carries, in the order the trigger and the old client fallback looked. */
export function profileDisplayName(
  metadata: Record<string, unknown> | undefined,
  email: string | undefined,
): string | null {
  const name = metadata?.name ?? metadata?.full_name
  if (typeof name === 'string' && name.trim()) return name
  return email?.split('@')[0] ?? null
}
