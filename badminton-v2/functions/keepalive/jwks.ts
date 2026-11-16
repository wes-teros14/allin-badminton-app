/**
 * Keeps the Data API's key list (JWKS) in step with Supabase (owner decision 2026-11-16).
 *
 * Neon's Data API checks every request's token against one JWKS file in a public bucket:
 * the Supabase project's public keys (players' sign-in tokens) plus our anonymous key
 * (the long-lived logged-out token). If Supabase rotates its signing key, players' new
 * tokens carry a kid that is not in the file and their data calls fail. So the daily
 * keepalive run also fetches Supabase's current keys, merges the anonymous key, and
 * rewrites the file only when it differs.
 *
 * Safe by construction: an empty or failed Supabase answer never overwrites the file, and
 * a run without an anonymous key refuses, since either would lock people out.
 */
export type Jwk = { kid: string; kty: string } & Record<string, unknown>

const PUBLIC_FIELDS = ['kty', 'kid', 'alg', 'use', 'key_ops', 'crv', 'x', 'y', 'n', 'e'] as const

function publicOnly(key: Jwk): Jwk {
  const out: Record<string, unknown> = {}
  for (const field of PUBLIC_FIELDS) if (key[field] !== undefined) out[field] = key[field]
  return out as Jwk
}

/** Supabase keys + anonymous keys, public fields only, one per kid (anonymous wins), sorted by kid. */
export function mergeJwks(supabaseKeys: readonly Jwk[], anonKeys: readonly Jwk[]): { keys: Jwk[] } {
  const byKid = new Map<string, Jwk>()
  for (const key of supabaseKeys) byKid.set(key.kid, publicOnly(key))
  for (const key of anonKeys) byKid.set(key.kid, publicOnly(key))
  return { keys: [...byKid.values()].sort((a, b) => a.kid.localeCompare(b.kid)) }
}

/** Comparable form of a JWKS document: keys sorted by kid, fields sorted, public fields only. */
function canonical(doc: { keys?: unknown }): string {
  const keys = Array.isArray(doc.keys) ? (doc.keys as Jwk[]) : []
  return JSON.stringify(
    keys
      .map(publicOnly)
      .sort((a, b) => String(a.kid).localeCompare(String(b.kid)))
      .map((k) => Object.fromEntries(Object.entries(k).sort(([a], [b]) => a.localeCompare(b)))),
  )
}

export interface RefreshDeps {
  fetchSupabaseKeys: () => Promise<readonly Jwk[]>
  /** The file's current text, or null if it does not exist yet. */
  readCurrent: () => Promise<string | null>
  write: (body: string) => Promise<void>
  anonKeys: readonly Jwk[]
}

export async function refreshJwks(deps: RefreshDeps): Promise<'updated' | 'unchanged'> {
  if (deps.anonKeys.length === 0) throw new Error('refusing to publish a key list without the anonymous key')
  const supabaseKeys = await deps.fetchSupabaseKeys()
  if (supabaseKeys.length === 0) throw new Error('Supabase returned no keys; leaving the key list alone')

  const merged = mergeJwks(supabaseKeys, deps.anonKeys)
  const current = await deps.readCurrent()
  if (current !== null) {
    try {
      if (canonical(JSON.parse(current)) === canonical(merged)) return 'unchanged'
    } catch {
      // Unreadable: rewrite it.
    }
  }
  await deps.write(JSON.stringify(merged))
  return 'updated'
}
