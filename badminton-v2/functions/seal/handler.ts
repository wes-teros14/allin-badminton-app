/**
 * The `seal` endpoint: hands out short-lived Neon Realtime passes for one
 * live-update channel.
 *
 * Neon Realtime has no publish/subscribe and no per-connection auth. A phone
 * subscribes to a *sealed query*: a signed, encrypted, 60-second capability
 * for one exact SQL query. This endpoint decides who may have which:
 *
 *   session:<uuid>  anyone, signed in or not (the logged-out live board too).
 *                   Messages only say "this changed", plus a match's status.
 *   user:<uuid>     only the signed-in owner (notifications, own stats).
 *
 * Same rules as the Supabase Broadcast policies in migration 089.
 *
 * Every pass is for the same query with the topic as its only parameter, so a
 * renewal (Neon requires the identical query and values) is just another call
 * with the same topic. Rows older than 10 minutes are purged by `live_send`,
 * so the initial snapshot stays small; the client ignores it and acts on
 * changes only.
 */
export const LIVE_SQL = 'SELECT id, msg FROM public.live_messages WHERE topic = $1'

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const TOPIC = new RegExp(`^(session|user):(${UUID})$`)

export type SealDeps = {
  /** Seals `LIVE_SQL` for one topic. `@neon/realtime/server`'s `seal` + `rawSql` in production. */
  seal: (input: { query: unknown }) => Promise<unknown>
  /** The verified Supabase user id for a bearer token, or null if it is missing, forged or expired. */
  verify: (token: string) => Promise<string | null>
  /** Exact browser origins that may call this endpoint. */
  allowedOrigins: readonly string[]
  /** Builds the query object to seal. Defaults to a plain descriptor (tests). */
  query?: (topic: string) => unknown
}

export function createSealHandler(deps: SealDeps): (req: Request) => Promise<Response> {
  const allowed = new Set(deps.allowedOrigins)
  const buildQuery = deps.query ?? ((topic: string) => ({ sql: LIVE_SQL, parameters: [topic] }))

  return async (req) => {
    const origin = req.headers.get('Origin')
    // No Origin = not a browser (curl, tests). A browser on another site is refused outright.
    if (origin !== null && !allowed.has(origin)) return json({ error: 'origin not allowed' }, 403, {})
    const cors = origin === null ? {} : corsHeaders(origin)

    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
    if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405, cors)

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return json({ error: 'body must be JSON' }, 400, cors)
    }

    const topic = (body as { topic?: unknown } | null)?.topic
    const match = typeof topic === 'string' ? TOPIC.exec(topic) : null
    if (!match) return json({ error: 'topic must be session:<uuid> or user:<uuid>' }, 400, cors)

    if (match[1] === 'user') {
      const userId = await bearerUser(req.headers.get('Authorization'), deps.verify)
      if (userId === null) return json({ error: 'sign in required' }, 401, cors)
      if (userId !== match[2]) return json({ error: 'not your channel' }, 403, cors)
    }

    const sealed = await deps.seal({ query: buildQuery(match[0]) })
    return json(sealed, 200, cors)
  }
}

async function bearerUser(header: string | null, verify: SealDeps['verify']): Promise<string | null> {
  const token = header?.match(/^Bearer (.+)$/)?.[1]
  return token ? verify(token) : null
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
