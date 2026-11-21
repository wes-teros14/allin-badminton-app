/**
 * The `gallery` endpoint: everything about Gallery photo FILES. Rows (who may see, upload,
 * change or delete what) are decided by the database rules in migration 092 — this Function
 * never holds a database password. Every row read or write goes through the Data API with the
 * caller's own sign-in token, so RLS answers for that person and nobody else.
 *
 * File keys come from the row, never from the client:
 *   <session_id>/<photo_id>/v<version>        photo (1280 px long edge)
 *   <session_id>/<photo_id>/v<version>-thumb  thumbnail
 *
 * Actions (POST JSON):
 *   urls    {ids}          signed GET links for the photos the caller may see
 *   sign    {id, type}     signed PUT links for the next version, if the caller may change the row
 *   cleanup {id}           delete files of older versions of a row the caller can see
 *   delete  {id}           delete the row (RLS decides); only if it went, delete its files
 */

export type PhotoRow = { id: string; session_id: string; version: number; ready: boolean }

export type GalleryDeps = {
  /** The verified Supabase user id for a bearer token, or null if missing, forged or expired. */
  verify: (token: string) => Promise<string | null>
  /** Data API calls made with the caller's token. */
  rows: {
    select: (token: string, ids: string[]) => Promise<PhotoRow[]>
    /** A no-op update (sets version to itself). Returns the row only if RLS lets the caller change it. */
    touch: (token: string, id: string) => Promise<PhotoRow | null>
    remove: (token: string, id: string) => Promise<PhotoRow | null>
  }
  files: {
    signGet: (key: string, signingDate: Date) => Promise<string>
    signPut: (key: string, contentType: string) => Promise<string>
    list: (prefix: string) => Promise<string[]>
    remove: (keys: string[]) => Promise<void>
  }
  allowedOrigins: readonly string[]
  now?: () => Date
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const TYPES = new Set(['image/webp', 'image/jpeg'])
export const MAX_IDS = 60
/** GET links are signed at the start of a 3-day window and live 7 days (Neon's max), so every call
 *  in a window returns the same URL — the browser cache keeps working — and a link handed out at
 *  the end of a window still has 4 days left. */
export const WINDOW_MS = 3 * 24 * 3600 * 1000

export const keyFor = (row: Pick<PhotoRow, 'id' | 'session_id'>, version: number, thumb = false) =>
  `${row.session_id}/${row.id}/v${version}${thumb ? '-thumb' : ''}`
export const prefixFor = (row: Pick<PhotoRow, 'id' | 'session_id'>) => `${row.session_id}/${row.id}/`

export function windowStart(now: Date): Date {
  return new Date(Math.floor(now.getTime() / WINDOW_MS) * WINDOW_MS)
}

export function createGalleryHandler(deps: GalleryDeps): (req: Request) => Promise<Response> {
  const allowed = new Set(deps.allowedOrigins)
  const now = deps.now ?? (() => new Date())

  return async (req) => {
    const origin = req.headers.get('Origin')
    if (origin !== null && !allowed.has(origin)) return json({ error: 'origin not allowed' }, 403, {})
    const cors = origin === null ? {} : corsHeaders(origin)
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
    if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405, cors)

    const token = req.headers.get('Authorization')?.match(/^Bearer (.+)$/)?.[1] ?? null
    if (!token || (await deps.verify(token)) === null) return json({ error: 'sign in required' }, 401, cors)

    let body: Record<string, unknown>
    try {
      body = (await req.json()) as Record<string, unknown>
    } catch {
      return json({ error: 'body must be JSON' }, 400, cors)
    }

    try {
      switch (body?.action) {
        case 'urls': {
          const ids = body.ids
          if (!Array.isArray(ids) || ids.length === 0 || ids.length > MAX_IDS || !ids.every((x) => typeof x === 'string' && UUID.test(x))) {
            return json({ error: `ids must be 1-${MAX_IDS} uuids` }, 400, cors)
          }
          const signedAt = windowStart(now())
          const rows = (await deps.rows.select(token, ids as string[])).filter((r) => r.ready && r.version > 0)
          const urls = await Promise.all(rows.map(async (r) => ({
            id: r.id,
            version: r.version,
            url: await deps.files.signGet(keyFor(r, r.version), signedAt),
            thumbUrl: await deps.files.signGet(keyFor(r, r.version, true), signedAt),
          })))
          return json({ urls }, 200, cors)
        }
        case 'sign': {
          const id = body.id
          const type = body.type
          if (typeof id !== 'string' || !UUID.test(id)) return json({ error: 'id must be a uuid' }, 400, cors)
          if (typeof type !== 'string' || !TYPES.has(type)) return json({ error: 'type must be image/webp or image/jpeg' }, 400, cors)
          const row = await deps.rows.touch(token, id)
          if (!row) return json({ error: 'not allowed to change this photo' }, 403, cors)
          const version = row.version + 1
          return json({
            version,
            put: await deps.files.signPut(keyFor(row, version), type),
            putThumb: await deps.files.signPut(keyFor(row, version, true), type),
          }, 200, cors)
        }
        case 'cleanup': {
          const id = body.id
          if (typeof id !== 'string' || !UUID.test(id)) return json({ error: 'id must be a uuid' }, 400, cors)
          const [row] = await deps.rows.select(token, [id])
          if (!row) return json({ removed: 0 }, 200, cors)
          const keep = new Set([keyFor(row, row.version), keyFor(row, row.version, true)])
          const stale = (await deps.files.list(prefixFor(row))).filter((k) => !keep.has(k))
          if (stale.length) await deps.files.remove(stale)
          return json({ removed: stale.length }, 200, cors)
        }
        case 'delete': {
          const id = body.id
          if (typeof id !== 'string' || !UUID.test(id)) return json({ error: 'id must be a uuid' }, 400, cors)
          const row = await deps.rows.remove(token, id)
          if (!row) return json({ error: 'not allowed to delete this photo' }, 403, cors)
          const keys = await deps.files.list(prefixFor(row))
          if (keys.length) await deps.files.remove(keys)
          return json({ deleted: true, removed: keys.length }, 200, cors)
        }
        default:
          return json({ error: 'unknown action' }, 400, cors)
      }
    } catch (error) {
      console.error('gallery', body?.action, error)
      return json({ error: 'gallery failed' }, 502, cors)
    }
  }
}

function corsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

function json(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}
