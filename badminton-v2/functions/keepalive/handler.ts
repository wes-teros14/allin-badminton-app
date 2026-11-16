/**
 * The `keepalive` Function: once a day, one tiny database request to Supabase.
 *
 * After the Neon migration Supabase only serves sign-in and file storage. A free
 * project pauses after 7 days without "sufficient user database activity", and
 * Supabase's docs don't say whether Auth or Storage requests count — a paused
 * project means nobody can sign in. So a daily schedule trigger calls
 * `keepalive_ping()` (migration 091, reads no app data) through PostgREST.
 *
 * Only Neon's own trigger deliveries are served: the Functions proxy drops any
 * client-supplied `x-neon-*` header, so a present `x-neon-trigger-invocation-id`
 * that matches the body's `invocation_id` came from Neon. Anyone else gets 401
 * and no request reaches Supabase.
 *
 * A failure is logged and answered 502 (visible in the Function's logs);
 * Supabase also emails a warning about a week before it would pause.
 */
export type KeepaliveDeps = {
  supabaseUrl: string
  /** Supabase's public (publishable/anon) key — the same one the app ships. */
  publishableKey: string
  fetch?: typeof fetch
  log?: (message: string, detail?: unknown) => void
}

export function createKeepaliveHandler(deps: KeepaliveDeps): (req: Request) => Promise<Response> {
  const doFetch = deps.fetch ?? fetch
  const log = deps.log ?? ((message, detail) => console.error(message, detail))
  const pingUrl = `${deps.supabaseUrl.replace(/\/+$/, '')}/rest/v1/rpc/keepalive_ping`

  return async (req) => {
    if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

    const headerId = req.headers.get('x-neon-trigger-invocation-id')
    let bodyId: unknown
    try {
      bodyId = ((await req.json()) as { invocation_id?: unknown } | null)?.invocation_id
    } catch {
      bodyId = undefined
    }
    if (!headerId || headerId !== bodyId) return json({ error: 'not a trigger delivery' }, 401)

    try {
      const res = await doFetch(pingUrl, {
        method: 'POST',
        headers: { apikey: deps.publishableKey, 'Content-Type': 'application/json' },
        body: '{}',
      })
      const text = await res.text()
      if (!res.ok) {
        log('[keepalive] Supabase answered', { status: res.status, body: text.slice(0, 200) })
        return json({ ok: false, status: res.status }, 502)
      }
      return json({ ok: true, supabaseTime: safeParse(text) }, 200)
    } catch (error) {
      log('[keepalive] request failed', String(error))
      return json({ ok: false, error: 'request failed' }, 502)
    }
  }
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}
