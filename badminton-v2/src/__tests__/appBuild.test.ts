import { describe, expect, it } from 'vitest'
import { APP_BUILD_STAMP, APP_COMMIT, formatBuildStamp } from '@/lib/appBuild'

describe('formatBuildStamp', () => {
  it('reads as commit then date and time', () => {
    // Asserted loosely on purpose: the timestamp renders in the runner's own
    // timezone, so the exact day and hour depend on where the test runs. The
    // shape and the commit are what matter.
    const stamp = formatBuildStamp('dfdbc68', '2026-09-18T06:32:00.000Z')
    expect(stamp).toMatch(/^dfdbc68 · [A-Z][a-z]{2} \d{1,2}, 2026 \d{1,2}:\d{2} (AM|PM)$/)
  })

  it('falls back to the bare commit when there is no build time', () => {
    expect(formatBuildStamp('dfdbc68', '')).toBe('dfdbc68')
  })

  it('falls back to the bare commit when the build time is unparseable', () => {
    expect(formatBuildStamp('dfdbc68', 'not-a-date')).toBe('dfdbc68')
  })
})

describe('build globals', () => {
  it("resolves to 'dev' under vitest, which has no define block", () => {
    // Guards the `typeof` check in appBuild.ts: without it this import would
    // throw a ReferenceError rather than return a value.
    expect(APP_COMMIT).toBe('dev')
    expect(APP_BUILD_STAMP).toBe('dev')
  })
})
