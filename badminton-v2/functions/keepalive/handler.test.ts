import { describe, expect, it, vi } from 'vitest'
import { createKeepaliveHandler } from './handler'

const URL_ = 'https://proj.supabase.co'
const KEY = 'sb_publishable_test'

function trigger(invocationId = 'inv-1', bodyId = invocationId) {
  return new Request('https://fn.test/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-neon-trigger-invocation-id': invocationId },
    body: JSON.stringify({ version: 1, invocation_id: bodyId, trigger: { type: 'schedule', id: 't', name: 'daily' }, data: { scheduled_at: '2026-11-16T19:00:00Z' } }),
  })
}

function setup(response: Response | Error = new Response('"2026-11-16T19:00:01+00:00"', { status: 200 })) {
  const fetchFn = vi.fn(async () => { if (response instanceof Error) throw response; return response.clone() })
  const log = vi.fn()
  return { handler: createKeepaliveHandler({ supabaseUrl: URL_, publishableKey: KEY, fetch: fetchFn as unknown as typeof fetch, log }), fetchFn, log }
}

describe('keepalive handler', () => {
  it('a scheduled delivery pings Supabase once with the public key', async () => {
    const { handler, fetchFn } = setup()
    const res = await handler(trigger())
    expect(res.status).toBe(200)
    expect(fetchFn).toHaveBeenCalledTimes(1)
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(`${URL_}/rest/v1/rpc/keepalive_ping`)
    expect(init.method).toBe('POST')
    expect(new Headers(init.headers).get('apikey')).toBe(KEY)
    expect(await res.json()).toMatchObject({ ok: true })
  })

  it('a request without the trigger header is refused and does not ping (401)', async () => {
    const { handler, fetchFn } = setup()
    const res = await handler(new Request('https://fn.test/', { method: 'POST', body: '{}' }))
    expect(res.status).toBe(401)
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('a header that does not match the body invocation id is refused (401)', async () => {
    const { handler, fetchFn } = setup()
    const res = await handler(trigger('inv-1', 'inv-2'))
    expect(res.status).toBe(401)
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('only POST (405)', async () => {
    const { handler } = setup()
    expect((await handler(new Request('https://fn.test/', { method: 'GET' }))).status).toBe(405)
  })

  it('a Supabase error is logged and reported as 502', async () => {
    const { handler, log } = setup(new Response('{"message":"paused"}', { status: 540 }))
    const res = await handler(trigger())
    expect(res.status).toBe(502)
    expect(log).toHaveBeenCalledTimes(1)
  })

  it('a network failure is logged and reported as 502', async () => {
    const { handler, log } = setup(new Error('ECONNRESET'))
    const res = await handler(trigger())
    expect(res.status).toBe(502)
    expect(log).toHaveBeenCalledTimes(1)
  })

  it('strips a trailing slash from the Supabase URL', async () => {
    const fetchFn = vi.fn(async () => new Response('"t"', { status: 200 }))
    const handler = createKeepaliveHandler({ supabaseUrl: URL_ + '/', publishableKey: KEY, fetch: fetchFn as unknown as typeof fetch, log: () => {} })
    await handler(trigger())
    expect((fetchFn.mock.calls[0] as unknown as [string])[0]).toBe(`${URL_}/rest/v1/rpc/keepalive_ping`)
  })
})
