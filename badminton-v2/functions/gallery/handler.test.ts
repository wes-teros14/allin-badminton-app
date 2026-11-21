import { describe, expect, it, vi } from 'vitest'
import { createGalleryHandler, keyFor, windowStart, WINDOW_MS, type GalleryDeps, type PhotoRow } from './handler'

const S = '11111111-1111-4111-8111-111111111111'
const P = '22222222-2222-4222-8222-222222222222'
const ORIGIN = 'http://localhost:5173'
const row = (over: Partial<PhotoRow> = {}): PhotoRow => ({ id: P, session_id: S, version: 2, ready: true, ...over })

function setup(over: Partial<GalleryDeps> = {}) {
  const deps: GalleryDeps = {
    verify: vi.fn(async (t: string) => (t === 'good' ? 'user-1' : null)),
    rows: {
      select: vi.fn(async () => [row()]),
      touch: vi.fn(async () => row()),
      remove: vi.fn(async () => row()),
    },
    files: {
      signGet: vi.fn(async (k: string, d: Date) => `get:${k}@${d.toISOString()}`),
      signPut: vi.fn(async (k: string, t: string) => `put:${k}:${t}`),
      list: vi.fn(async () => [keyFor(row(), 1), keyFor(row(), 1, true), keyFor(row(), 2), keyFor(row(), 2, true)]),
      remove: vi.fn(async () => {}),
    },
    allowedOrigins: [ORIGIN],
    now: () => new Date('2026-11-21T10:00:00Z'),
    ...over,
  }
  const call = (body: unknown, token = 'good', origin: string | null = ORIGIN) =>
    createGalleryHandler(deps)(new Request('https://fn/', {
      method: 'POST',
      headers: { ...(origin ? { Origin: origin } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    }))
  return { deps, call }
}

describe('gallery handler', () => {
  it('refuses other origins and missing or bad sign-in', async () => {
    const { call } = setup()
    expect((await call({ action: 'urls', ids: [P] }, 'good', 'https://evil.example')).status).toBe(403)
    expect((await call({ action: 'urls', ids: [P] }, '')).status).toBe(401)
    expect((await call({ action: 'urls', ids: [P] }, 'bad')).status).toBe(401)
  })

  it('urls: signs only ready rows, both sizes, with a window-start signing time', async () => {
    const { call, deps } = setup({ rows: { select: vi.fn(async () => [row(), row({ id: S, ready: false })]), touch: vi.fn(), remove: vi.fn() } })
    const res = await call({ action: 'urls', ids: [P, S] })
    const body = (await res.json()) as { urls: Array<{ id: string; url: string; thumbUrl: string }> }
    expect(body.urls).toHaveLength(1)
    const start = windowStart(new Date('2026-11-21T10:00:00Z'))
    expect(body.urls[0].url).toBe(`get:${S}/${P}/v2@${start.toISOString()}`)
    expect(body.urls[0].thumbUrl).toBe(`get:${S}/${P}/v2-thumb@${start.toISOString()}`)
    expect(deps.files.signGet).toHaveBeenCalledTimes(2)
  })

  it('urls: the same window gives the same signing time; links always keep >= 4 days', () => {
    const a = windowStart(new Date('2026-11-21T00:00:01Z'))
    const b = windowStart(new Date(a.getTime() + WINDOW_MS - 1))
    expect(a.getTime()).toBe(b.getTime())
    expect(7 * 24 * 3600 * 1000 - WINDOW_MS).toBeGreaterThanOrEqual(4 * 24 * 3600 * 1000)
  })

  it('urls: rejects non-uuid ids and too many ids', async () => {
    const { call } = setup()
    expect((await call({ action: 'urls', ids: ['x'] })).status).toBe(400)
    expect((await call({ action: 'urls', ids: Array(61).fill(P) })).status).toBe(400)
  })

  it('sign: next version, both files, only when RLS lets the caller change the row', async () => {
    const { call } = setup()
    const ok = (await (await call({ action: 'sign', id: P, type: 'image/webp' })).json()) as Record<string, unknown>
    expect(ok).toEqual({ version: 3, put: `put:${S}/${P}/v3:image/webp`, putThumb: `put:${S}/${P}/v3-thumb:image/webp` })

    const denied = setup({ rows: { select: vi.fn(), touch: vi.fn(async () => null), remove: vi.fn() } })
    expect((await denied.call({ action: 'sign', id: P, type: 'image/webp' })).status).toBe(403)
    expect((await denied.call({ action: 'sign', id: P, type: 'image/png' })).status).toBe(400)
  })

  it('cleanup: deletes only older versions of a visible row', async () => {
    const { call, deps } = setup()
    const body = (await (await call({ action: 'cleanup', id: P })).json()) as { removed: number }
    expect(body.removed).toBe(2)
    expect(deps.files.remove).toHaveBeenCalledWith([keyFor(row(), 1), keyFor(row(), 1, true)])
  })

  it('cleanup: does nothing for a row the caller cannot see', async () => {
    const { call, deps } = setup({ rows: { select: vi.fn(async () => []), touch: vi.fn(), remove: vi.fn() } })
    expect(await (await call({ action: 'cleanup', id: P })).json()).toEqual({ removed: 0 })
    expect(deps.files.list).not.toHaveBeenCalled()
  })

  it('delete: files go only if the database deleted the row', async () => {
    const { call, deps } = setup()
    expect((await call({ action: 'delete', id: P })).status).toBe(200)
    expect(deps.files.remove).toHaveBeenCalledTimes(1)

    const denied = setup({ rows: { select: vi.fn(), touch: vi.fn(), remove: vi.fn(async () => null) } })
    expect((await denied.call({ action: 'delete', id: P })).status).toBe(403)
    expect(denied.deps.files.remove).not.toHaveBeenCalled()
  })

  it('answers preflight with CORS headers for allowed origins', async () => {
    const { deps } = setup()
    const res = await createGalleryHandler(deps)(new Request('https://fn/', { method: 'OPTIONS', headers: { Origin: ORIGIN } }))
    expect(res.status).toBe(204)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN)
  })
})
