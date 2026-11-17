import { describe, expect, it, vi } from 'vitest'
import { PostgrestClient } from '@supabase/postgrest-js'
import { singleObjectFetch } from '@/lib/singleObjectFetch'

/**
 * A stand-in for Neon's Data API, which (G3, 2026-11-16) ignores PostgREST's
 * single-object contract: with `Accept: application/vnd.pgrst.object+json` it
 * answers 200 with the first row, or `null` for no rows, instead of 406 PGRST116.
 * With `Accept: application/json` it answers the array, like PostgREST.
 */
function neonLike(rows: unknown[], status = 200) {
  return vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    const accept = new Headers(init?.headers).get('Accept') ?? ''
    const body = accept.startsWith('application/vnd.pgrst.object+json')
      ? JSON.stringify(rows[0] ?? null)
      : JSON.stringify(rows)
    return new Response(body, { status, headers: { 'Content-Type': 'application/json' } })
  })
}

function client(base: typeof fetch) {
  return new PostgrestClient('https://example.test/rest/v1', { fetch: singleObjectFetch(base) })
}

const A = { id: 'a' }
const B = { id: 'b' }

describe('singleObjectFetch — restores PostgREST .single() on Neon', () => {
  it('single() with one row returns the object', async () => {
    const res = await client(neonLike([A])).from('t').select('id').eq('id', 'a').single()
    expect(res.error).toBeNull()
    expect(res.data).toEqual(A)
  })

  it('single() with no rows returns PGRST116, not 200 null', async () => {
    const res = await client(neonLike([])).from('t').select('id').eq('id', 'x').single()
    expect(res.data).toBeNull()
    expect(res.status).toBe(406)
    expect(res.error?.code).toBe('PGRST116')
    expect(res.error?.details).toContain('0 rows')
  })

  it('single() with two rows returns PGRST116, not the first row', async () => {
    const res = await client(neonLike([A, B])).from('t').select('id').single()
    expect(res.data).toBeNull()
    expect(res.error?.code).toBe('PGRST116')
    expect(res.error?.details).toContain('2 rows')
  })

  it('update().select().single() hitting two rows reports PGRST116', async () => {
    const res = await client(neonLike([A, B])).from('t').update({ x: 1 }).eq('s', 1).select().single()
    expect(res.error?.code).toBe('PGRST116')
  })

  it('insert().select().maybeSingle() with no row returned gives null, no error', async () => {
    const res = await client(neonLike([])).from('t').insert({ x: 1 }).select().maybeSingle()
    expect(res.error).toBeNull()
    expect(res.data).toBeNull()
  })

  it('insert().select().maybeSingle() with one row gives the object', async () => {
    const res = await client(neonLike([A])).from('t').insert({ x: 1 }).select().maybeSingle()
    expect(res.error).toBeNull()
    expect(res.data).toEqual(A)
  })

  it('GET maybeSingle() is untouched (postgrest-js already asks for an array)', async () => {
    const base = neonLike([A])
    const res = await client(base).from('t').select('id').maybeSingle()
    expect(res.data).toEqual(A)
    expect(new Headers(base.mock.calls[0][1]?.headers).get('Accept')).toBe('application/json')
  })

  it('plain array queries pass through unchanged', async () => {
    const base = neonLike([A, B])
    const res = await client(base).from('t').select('id')
    expect(res.data).toEqual([A, B])
    expect(base).toHaveBeenCalledTimes(1)
  })

  it('asks the server for an array instead of the object type', async () => {
    const base = neonLike([A])
    await client(base).from('t').select('id').single()
    expect(new Headers(base.mock.calls[0][1]?.headers).get('Accept')).toBe('application/json')
  })

  it('server errors pass through untouched', async () => {
    const base = vi.fn(async () =>
      new Response(JSON.stringify({ code: '42501', message: 'permission denied', details: null, hint: null }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const res = await client(base).from('t').update({ x: 1 }).eq('id', 'a').select().single()
    expect(res.error?.code).toBe('42501')
    expect(res.status).toBe(403)
  })

  it('an empty 204 (no representation asked for) passes through', async () => {
    const base = vi.fn(async () => new Response(null, { status: 204 }))
    const res = await client(base).from('t').update({ x: 1 }).eq('id', 'a').single()
    expect(res.error).toBeNull()
    expect(res.status).toBe(204)
  })
})
