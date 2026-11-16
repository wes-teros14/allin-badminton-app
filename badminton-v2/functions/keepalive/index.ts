/**
 * Neon Function `keepalive` — see handler.ts. Runs from the `supabase-keepalive` schedule
 * trigger in neon.ts (daily 19:00 UTC = 03:00 Manila).
 *
 * Env (declared in neon.ts): SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY (public, as shipped in the app).
 */
import { createKeepaliveHandler } from './handler'

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not set`)
  return value
}

const handler = createKeepaliveHandler({
  supabaseUrl: required('SUPABASE_URL'),
  publishableKey: required('SUPABASE_PUBLISHABLE_KEY'),
})

export default { fetch: handler }
