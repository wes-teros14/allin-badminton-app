/**
 * Restores PostgREST's `.single()` contract on Neon's Data API.
 *
 * PostgREST (Supabase) answers `Accept: application/vnd.pgrst.object+json` with
 * the row when exactly one matches, and 406 PGRST116 otherwise. Neon's Data API
 * (G3, 2026-11-16) answers 200 with the first row, or `null` for none — so a
 * `.single()` that should fail silently "succeeds", and a session that does not
 * exist reads as `null` data with no error.
 *
 * This wraps `fetch`: an object request is sent as an array request, and the
 * array is turned back into the object, or into the PGRST116 error PostgREST
 * would have sent. postgrest-js's `.maybeSingle()` keys off the "0 rows" detail,
 * so it keeps working unchanged.
 *
 * Limit: PostgREST also rolls back a write whose `.single()` matched 2+ rows.
 * Neon ignores `Prefer: handling=strict, max-affected=1` (checked on branch
 * `parity`), so here such a write is reported as PGRST116 but stays committed.
 * Every `.single()` write in the app filters by primary key, so it cannot match
 * two rows.
 */
const OBJECT_MEDIA_TYPE = 'application/vnd.pgrst.object+json'

export function singleObjectFetch(baseFetch: typeof fetch = fetch): typeof fetch {
  return async (input, init) => {
    const headers = new Headers(init?.headers)
    if (!headers.get('Accept')?.startsWith(OBJECT_MEDIA_TYPE)) return baseFetch(input, init)

    headers.set('Accept', 'application/json')
    const res = await baseFetch(input, { ...init, headers })
    if (!res.ok || res.status === 204) return res

    const text = await res.text()
    if (text === '') return new Response(null, { status: res.status, statusText: res.statusText })

    const rows: unknown = JSON.parse(text)
    if (!Array.isArray(rows)) return jsonResponse(text, res.status, res.statusText, res.headers)
    if (rows.length === 1) return jsonResponse(JSON.stringify(rows[0]), res.status, res.statusText, res.headers)

    return jsonResponse(
      JSON.stringify({
        code: 'PGRST116',
        message: 'Cannot coerce the result to a single JSON object',
        details: `The result contains ${rows.length} rows`,
        hint: null,
      }),
      406,
      'Not Acceptable',
      res.headers,
    )
  }
}

/** A JSON response keeping the original headers (Content-Range feeds `count`), minus the stale length and encoding. */
function jsonResponse(body: string, status: number, statusText: string, original: Headers): Response {
  const headers = new Headers(original)
  headers.delete('content-length')
  headers.delete('content-encoding')
  headers.set('Content-Type', 'application/json')
  return new Response(body, { status, statusText, headers })
}
