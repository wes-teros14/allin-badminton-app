/**
 * Quick script: add 8 extra test profiles to dev Supabase.
 * Usage: npx tsx scripts/seed-extra-users.ts
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envRoot = resolve(__dirname, '..')

for (const envFile of ['.env.development', '.env']) {
  try {
    const raw = readFileSync(resolve(envRoot, envFile), 'utf-8')
    for (const line of raw.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const idx = trimmed.indexOf('=')
      if (idx === -1) continue
      const key = trimmed.slice(0, idx).trim()
      const val = trimmed.slice(idx + 1).trim()
      if (!process.env[key]) process.env[key] = val
    }
  } catch { /* file not found */ }
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const PASSWORD = 'Test1234!'

const USERS = [
  { email: 'extra-kevin@test.local',  name: 'Kevin Reyes',    gender: 'M', level: 4 },
  { email: 'extra-anna@test.local',   name: 'Anna Santos',    gender: 'F', level: 6 },
  { email: 'extra-marco@test.local',  name: 'Marco Cruz',     gender: 'M', level: 8 },
  { email: 'extra-lily@test.local',   name: 'Lily Tan',       gender: 'F', level: 3 },
  { email: 'extra-derek@test.local',  name: 'Derek Ong',      gender: 'M', level: 7 },
  { email: 'extra-nina@test.local',   name: 'Nina Lim',       gender: 'F', level: 5 },
  { email: 'extra-ryan@test.local',   name: 'Ryan Go',        gender: 'M', level: 9 },
  { email: 'extra-mae@test.local',    name: 'Mae Villanueva', gender: 'F', level: 7 },
]

async function main() {
  console.log('\n🌱  Seeding 8 extra test users...\n')

  const { data: list } = await sb.auth.admin.listUsers({ perPage: 1000 })
  const existing = list?.users ?? []

  for (const u of USERS) {
    const found = existing.find((e) => e.email === u.email)
    let id: string

    if (found) {
      id = found.id
      console.log(`  ↩  Exists: ${u.email} (${id})`)
    } else {
      const { data, error } = await sb.auth.admin.createUser({
        email: u.email,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { name: u.name },
      })
      if (error) { console.error(`  ❌  ${u.email}: ${error.message}`); continue }
      id = data.user.id
      console.log(`  ✓  Created: ${u.email} (${id})`)
    }

    // Wait for DB trigger to create profile row
    await new Promise((r) => setTimeout(r, 500))

    const { error: pErr } = await sb
      .from('profiles')
      .update({ gender: u.gender, level: u.level })
      .eq('id', id)
    if (pErr) console.error(`  ❌  Profile ${u.email}: ${pErr.message}`)
    else console.log(`       → ${u.name} (${u.gender}, L${u.level})`)
  }

  console.log(`\n✅  Done! Password for all: ${PASSWORD}\n`)
}

main().catch((e) => { console.error(e); process.exit(1) })
