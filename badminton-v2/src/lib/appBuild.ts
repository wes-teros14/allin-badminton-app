/**
 * Identifies the exact bundle a browser is running, so "it's still broken on my
 * phone" can be tied to a commit instead of guessed at.
 *
 * Deliberately a build stamp and not a hand-maintained version number: this
 * project has no release cadence, so a semver would be bumped by hand and would
 * eventually report a version that never shipped. A commit cannot drift from the
 * code it names.
 *
 * The globals come from the `define` block in vite.config.ts. They are read
 * through `typeof` because vitest.config.ts has no `define` block of its own —
 * a bare reference throws under test.
 */
export const APP_COMMIT: string = typeof __APP_COMMIT__ === 'string' ? __APP_COMMIT__ : 'dev'
export const APP_BUILT_AT: string = typeof __APP_BUILT_AT__ === 'string' ? __APP_BUILT_AT__ : ''

/**
 * `dfdbc68 · Sep 18, 2026 2:32 PM`, rendered in the reader's own timezone so a
 * player in Manila sees Manila time. Falls back to the bare commit when there is
 * no usable timestamp — the commit is the half that can actually be looked up.
 */
export function formatBuildStamp(commit: string, builtAt: string): string {
  if (!builtAt) return commit

  const built = new Date(builtAt)
  if (Number.isNaN(built.getTime())) return commit

  const date = built.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const time = built.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  return `${commit} · ${date} ${time}`
}

export const APP_BUILD_STAMP: string = formatBuildStamp(APP_COMMIT, APP_BUILT_AT)
