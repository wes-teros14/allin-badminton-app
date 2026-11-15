// Loads DEV credentials from .env.development at runtime (never hard-code keys)
// and refuses to run against anything but the DEV project.
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

export const DEV_REF = 'tsvetqzkullivprbjtli'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const env = {}
for (const line of readFileSync(resolve(root, '.env.development'), 'utf-8').split(/\r?\n/)) {
  const t = line.trim()
  if (!t || t.startsWith('#')) continue
  const i = t.indexOf('=')
  if (i > 0) env[t.slice(0, i).trim()] = t.slice(i + 1).trim()
}

export const SUPABASE_URL = env.VITE_SUPABASE_URL
export const ANON_KEY = env.VITE_SUPABASE_ANON_KEY
export const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY

const ref = new URL(SUPABASE_URL).hostname.split('.')[0]
console.log(`[env] project ref: ${ref}`)
if (ref !== DEV_REF) {
  console.error(`Refusing to run: expected DEV (${DEV_REF}), got ${ref}`)
  process.exit(1)
}
