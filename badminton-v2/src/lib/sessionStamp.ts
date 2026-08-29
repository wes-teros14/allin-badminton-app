/**
 * "Which session was this?" -- rendered as one line for notification toasts.
 *
 * A player can hold registrations for two open sessions at the same time and
 * pay the later one first, so a receipt toast that names only the player is
 * ambiguous: the admin looks at the session in front of them, finds nothing,
 * and the payment reads as lost. Naming the session AND its date removes the
 * guess.
 */

/**
 * Format a `sessions.date` DATE value the way the rest of the app does
 * (AdminView, SessionView, PlayerView): "Sep. 6, 2026".
 *
 * The 'T00:00:00' suffix is load-bearing. A bare 'YYYY-MM-DD' is parsed as UTC
 * midnight, which renders as the PREVIOUS day in any timezone west of
 * Greenwich; appending a time forces local-midnight parsing instead.
 *
 * Returns null -- never the string "Invalid Date" -- for anything unparseable,
 * so a bad value drops the date rather than showing noise to the admin.
 */
export function formatSessionDate(date: string | null | undefined): string | null {
  if (!date) return null
  const d = new Date(`${date}T00:00:00`)
  if (Number.isNaN(d.getTime())) return null
  return d
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    .replace(/^(\w{3})/, '$1.')
}

/**
 * "Ber months na 🎁 · Sep. 6, 2026", degrading to whichever half is available
 * and to null when neither is -- callers pass the result straight to a toast
 * `description`, and null omits the line rather than printing a bare separator.
 */
export function formatSessionStamp(
  name: string | null | undefined,
  date: string | null | undefined,
): string | null {
  const trimmedName = name?.trim() || null
  const formattedDate = formatSessionDate(date)
  if (trimmedName && formattedDate) return `${trimmedName} · ${formattedDate}`
  return trimmedName ?? formattedDate
}
