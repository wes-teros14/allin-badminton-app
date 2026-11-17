import { describe, expect, it, vi } from 'vitest'
import { mergeJwks, refreshJwks, type Jwk } from './jwks'

const SUPA_A: Jwk = { kid: 'supa-a', kty: 'EC', crv: 'P-256', x: 'xa', y: 'ya', alg: 'ES256', use: 'sig', key_ops: ['verify'] }
const SUPA_B: Jwk = { kid: 'supa-b', kty: 'EC', crv: 'P-256', x: 'xb', y: 'yb', alg: 'ES256' }
const ANON: Jwk = { kid: 'anon-1', kty: 'EC', crv: 'P-256', x: 'xn', y: 'yn', alg: 'ES256', use: 'sig' }

describe('mergeJwks', () => {
  it('combines Supabase keys and the anonymous key, sorted by kid', () => {
    const merged = mergeJwks([SUPA_B, SUPA_A], [ANON])
    expect(merged.keys.map((k) => k.kid)).toEqual(['anon-1', 'supa-a', 'supa-b'])
  })

  it('keeps only public fields (a private "d" never reaches the public file)', () => {
    const leaky = { ...SUPA_A, d: 'PRIVATE' } as Jwk
    expect(JSON.stringify(mergeJwks([leaky], [ANON]))).not.toContain('PRIVATE')
  })

  it('an anonymous key wins over a Supabase key with the same kid', () => {
    const clash = { ...SUPA_A, kid: 'anon-1', x: 'other' }
    const merged = mergeJwks([clash], [ANON])
    expect(merged.keys).toHaveLength(1)
    expect(merged.keys[0].x).toBe('xn')
  })
})

function deps(over: Partial<Parameters<typeof refreshJwks>[0]> = {}) {
  return {
    fetchSupabaseKeys: vi.fn(async () => [SUPA_A]),
    readCurrent: vi.fn(async () => null as string | null),
    write: vi.fn(async () => {}),
    anonKeys: [ANON],
    ...over,
  }
}

describe('refreshJwks', () => {
  it('writes the merged list when the bucket has none yet', async () => {
    const write = vi.fn(async (_body: string) => {})
    const d = deps({ write })
    expect(await refreshJwks(d)).toBe('updated')
    expect(write).toHaveBeenCalledTimes(1)
    expect(JSON.parse(write.mock.calls[0][0]).keys.map((k: Jwk) => k.kid)).toEqual(['anon-1', 'supa-a'])
  })

  it('does not write when nothing changed (same keys, any order or spacing)', async () => {
    const current = JSON.stringify({ keys: [ANON, { ...SUPA_A }] }, null, 2)
    const d = deps({ readCurrent: vi.fn(async () => current) })
    expect(await refreshJwks(d)).toBe('unchanged')
    expect(d.write).not.toHaveBeenCalled()
  })

  it('writes when Supabase publishes a new (standby) key', async () => {
    const current = JSON.stringify(mergeJwks([SUPA_A], [ANON]))
    const d = deps({ fetchSupabaseKeys: vi.fn(async () => [SUPA_A, SUPA_B]), readCurrent: vi.fn(async () => current) })
    expect(await refreshJwks(d)).toBe('updated')
  })

  it('never writes a list without Supabase keys: an empty answer leaves the file alone', async () => {
    const d = deps({ fetchSupabaseKeys: vi.fn(async () => []) })
    await expect(refreshJwks(d)).rejects.toThrow(/no keys/i)
    expect(d.write).not.toHaveBeenCalled()
  })

  it('a failed Supabase fetch leaves the file alone', async () => {
    const d = deps({ fetchSupabaseKeys: vi.fn(async () => { throw new Error('503') }) })
    await expect(refreshJwks(d)).rejects.toThrow('503')
    expect(d.write).not.toHaveBeenCalled()
  })

  it('refuses to run without an anonymous key (it would lock out logged-out visitors)', async () => {
    const d = deps({ anonKeys: [] })
    await expect(refreshJwks(d)).rejects.toThrow(/anonymous/i)
    expect(d.write).not.toHaveBeenCalled()
  })

  it('an unreadable current file is treated as different and rewritten', async () => {
    const d = deps({ readCurrent: vi.fn(async () => '<html>not json') })
    expect(await refreshJwks(d)).toBe('updated')
  })
})
