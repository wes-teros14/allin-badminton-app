/**
 * Neon Function `seal` — see handler.ts for what it does and why.
 *
 * Env (declared in neon.ts, per branch):
 *   REALTIME_SECRET  the branch's Realtime secret. Server-only: anyone with it can seal any query.
 *   SUPABASE_URL     the Supabase project whose sign-ins we trust (DEV for test branches, prod for production).
 *   ALLOWED_ORIGINS  comma-separated exact browser origins.
 */
import { createRealtime, rawSql } from '@neon/realtime/server'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { createSealHandler, LIVE_SQL } from './handler'

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not set`)
  return value
}

const issuer = `${required('SUPABASE_URL').replace(/\/+$/, '')}/auth/v1`
// jose caches the key set and refetches it when a token names an unknown key, so a Supabase key rotation needs no redeploy.
const jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`))
const realtime = createRealtime({ secret: required('REALTIME_SECRET'), db: 'neondb' })

const handler = createSealHandler({
  seal: (input) => realtime.seal(input as { query: ReturnType<typeof rawSql> }),
  query: (topic) => rawSql(LIVE_SQL, [topic]),
  verify: async (token) => {
    try {
      const { payload } = await jwtVerify(token, jwks, { issuer, audience: 'authenticated' })
      return typeof payload.sub === 'string' ? payload.sub : null
    } catch {
      return null
    }
  },
  allowedOrigins: required('ALLOWED_ORIGINS')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
})

export default { fetch: handler }
