import { describe, expect, it, vi } from 'vitest'
import { createSealHandler, LIVE_SQL, type SealDeps } from './handler'

const SESSION = 'session:11111111-2222-4333-8444-555555555555'
const ME = '66666666-7777-4888-9999-aaaaaaaaaaaa'
const OTHER = 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff'
const PROD = 'https://badmintontayo.mrkws.com'

function setup(opts: { userId?: string | null } = {}) {
  const seal = vi.fn(async ({ query }: { query: unknown }) => ({ capability: 'cap', expiresAt: 1, queryFingerprint: 'fp', query }))
  const verify = vi.fn(async (token: string) => (token === 'good' ? (opts.userId ?? ME) : null))
  const deps: SealDeps = { seal, verify, allowedOrigins: [PROD, 'http://localhost:5173'] }
  return { handler: createSealHandler(deps), seal, verify }
}

function post(body: unknown, headers: Record<string, string> = {}) {
  return new Request('https://seal.test/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: PROD, ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('seal handler', () => {
  it('anyone, signed out, gets a session pass', async () => {
    const { handler, seal } = setup()
    const res = await handler(post({ topic: SESSION }))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ capability: 'cap' })
    expect(seal).toHaveBeenCalledTimes(1)
  })

  it('seals the fixed live_messages query with the topic as its only parameter', async () => {
    const { handler, seal } = setup()
    await handler(post({ topic: SESSION }))
    const query = seal.mock.calls[0][0].query as { sql?: string; parameters?: unknown[] }
    expect(JSON.stringify(query)).toContain(SESSION)
    expect(LIVE_SQL).toBe('SELECT id, msg FROM public.live_messages WHERE topic = $1')
  })

  it('the owner gets their own user pass', async () => {
    const { handler } = setup()
    const res = await handler(post({ topic: `user:${ME}` }, { Authorization: 'Bearer good' }))
    expect(res.status).toBe(200)
  })

  it('signed out cannot get a user pass (401)', async () => {
    const { handler, seal } = setup()
    const res = await handler(post({ topic: `user:${ME}` }))
    expect(res.status).toBe(401)
    expect(seal).not.toHaveBeenCalled()
  })

  it('an invalid or expired token cannot get a user pass (401)', async () => {
    const { handler, seal } = setup()
    const res = await handler(post({ topic: `user:${ME}` }, { Authorization: 'Bearer forged' }))
    expect(res.status).toBe(401)
    expect(seal).not.toHaveBeenCalled()
  })

  it("someone else's user pass is refused (403)", async () => {
    const { handler, seal } = setup()
    const res = await handler(post({ topic: `user:${OTHER}` }, { Authorization: 'Bearer good' }))
    expect(res.status).toBe(403)
    expect(seal).not.toHaveBeenCalled()
  })

  it('an expired token still gets a session pass (sessions are public)', async () => {
    const { handler } = setup()
    const res = await handler(post({ topic: SESSION }, { Authorization: 'Bearer expired' }))
    expect(res.status).toBe(200)
  })

  it.each([
    ['missing topic', {}],
    ['unknown prefix', { topic: `admin:${ME}` }],
    ['not a uuid', { topic: 'session:abc' }],
    ['uppercase uuid', { topic: `session:${ME.toUpperCase()}` }],
    ['trailing text', { topic: `${SESSION} OR 1=1` }],
    ['non-string', { topic: 42 }],
  ])('rejects a bad topic: %s (400)', async (_name, body) => {
    const { handler, seal } = setup()
    const res = await handler(post(body))
    expect(res.status).toBe(400)
    expect(seal).not.toHaveBeenCalled()
  })

  it('rejects a body that is not JSON (400)', async () => {
    const { handler } = setup()
    expect((await handler(post('not json'))).status).toBe(400)
  })

  it('answers the CORS preflight for an allowed origin', async () => {
    const { handler } = setup()
    const res = await handler(new Request('https://seal.test/', { method: 'OPTIONS', headers: { Origin: PROD } }))
    expect(res.status).toBe(204)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(PROD)
    expect(res.headers.get('Access-Control-Allow-Headers')).toContain('Authorization')
  })

  it('refuses a browser request from another website (403, no CORS header)', async () => {
    const { handler, seal } = setup()
    const res = await handler(post({ topic: SESSION }, { Origin: 'https://evil.example' }))
    expect(res.status).toBe(403)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull()
    expect(seal).not.toHaveBeenCalled()
  })

  it('a pass is never cached', async () => {
    const { handler } = setup()
    const res = await handler(post({ topic: SESSION }))
    expect(res.headers.get('Cache-Control')).toBe('no-store')
  })

  it('only POST seals (405)', async () => {
    const { handler } = setup()
    const res = await handler(new Request('https://seal.test/', { method: 'GET', headers: { Origin: PROD } }))
    expect(res.status).toBe(405)
  })
})
