/**
 * Splits the one `supabase` client the app imports between two backends
 * (Neon migration, option A chosen 2026-11-16):
 *
 *   data   — from(), rpc(), schema()      → Neon Data API
 *   rest   — auth, storage, channel, …    → Supabase (sign-in and files stay there)
 *
 * No call site changes: the ~230 `supabase.from(...)` calls keep working and
 * follow whichever backend this routes them to. Assigning one of the data
 * methods (as the page-only test scripts do) overrides the route.
 */
const DATA_METHODS = new Set<PropertyKey>(['from', 'rpc', 'schema'])

export function routeDataCalls<A extends object, D extends object>(authClient: A, dataClient: D): A {
  const overrides = new Map<PropertyKey, unknown>()
  return new Proxy(authClient, {
    get(target, prop, receiver) {
      if (overrides.has(prop)) return overrides.get(prop)
      if (DATA_METHODS.has(prop)) {
        const method = (dataClient as Record<PropertyKey, unknown>)[prop]
        return typeof method === 'function' ? method.bind(dataClient) : method
      }
      return Reflect.get(target, prop, receiver)
    },
    set(target, prop, value, receiver) {
      if (DATA_METHODS.has(prop)) {
        overrides.set(prop, value)
        return true
      }
      return Reflect.set(target, prop, value, receiver)
    },
  })
}

/** supabase-js appends /rest/v1 itself; accept the Data API URL with or without it. */
export function neonDataBaseUrl(url: string): string {
  return url.replace(/\/+$/, '').replace(/\/rest\/v1$/, '')
}
