/**
 * True when `pathname` is `base` or sits beneath it, comparing whole segments.
 *
 * A plain `startsWith` cannot be used for this: `/session` is a literal prefix
 * of `/sessions`, so the Admin tab lit up alongside Sessions on the player's own
 * session list. The two are different features — `/session/:id` is the admin
 * session manager, `/sessions` the player list — and the app has several such
 * near-twins, so the comparison has to stop at a segment boundary.
 */
export function isUnder(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`)
}
