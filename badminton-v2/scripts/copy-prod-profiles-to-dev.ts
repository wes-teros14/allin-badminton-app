/**
 * Copy all profiles from prod Supabase to dev Supabase.
 * - Creates auth users in dev with default password
 * - Updates profile rows with prod data (gender, level, nickname, role)
 * - Skips users that already exist in dev (by email)
 *
 * Usage: npx tsx scripts/copy-prod-profiles-to-dev.ts
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envRoot = resolve(__dirname, '..')

// Load env files manually
function loadEnv(filename: string): Record<string, string> {
  const vars: Record<string, string> = {}
  try {
    const raw = readFileSync(resolve(envRoot, filename), 'utf-8')
    for (const line of raw.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const idx = trimmed.indexOf('=')
      if (idx === -1) continue
      vars[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim()
    }
  } catch { /* file not found */ }
  return vars
}

const prod = loadEnv('.env.production')
const dev = loadEnv('.env.development')

const PROD_URL = prod.VITE_SUPABASE_URL
const PROD_KEY = prod.SUPABASE_SERVICE_ROLE_KEY
const DEV_URL = dev.VITE_SUPABASE_URL
const DEV_KEY = dev.SUPABASE_SERVICE_ROLE_KEY

if (!PROD_URL || !PROD_KEY) { console.error('Missing prod Supabase credentials'); process.exit(1) }
if (!DEV_URL || !DEV_KEY) { console.error('Missing dev Supabase credentials'); process.exit(1) }

const sbProd = createClient(PROD_URL, PROD_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
const sbDev = createClient(DEV_URL, DEV_KEY, { auth: { autoRefreshToken: false, persistSession: false } })

const PASSWORD = 'Test1234!'

async function main() {
  // 1. Fetch all profiles from prod
  const { data: prodProfiles, error: fetchErr } = await sbProd
    .from('profiles')
    .select('id, email, name_slug, nickname, gender, level, role')

  if (fetchErr || !prodProfiles) {
    console.error('Failed to fetch prod profiles:', fetchErr?.message)
    process.exit(1)
  }

  console.log(`\nFound ${prodProfiles.length} profiles in prod.\n`)

  // 2. Get existing dev users (by email) to skip duplicates
  const { data: devList } = await sbDev.auth.admin.listUsers({ perPage: 1000 })
  const devEmails = new Set((devList?.users ?? []).map((u) => u.email))

  let created = 0
  let skipped = 0
  let updated = 0

  for (const profile of prodProfiles) {
    const email = profile.email
    if (!email) {
      console.log(`  -  Skipping ${profile.name_slug} (no email)`)
      skipped++
      continue
    }

    if (devEmails.has(email)) {
      console.log(`  ~  Exists: ${email} (${profile.name_slug})`)
      // Still update profile data in case it's stale
      const { data: devUsers } = await sbDev.auth.admin.listUsers({ perPage: 1000 })
      const devUser = devUsers?.users?.find((u) => u.email === email)
      if (devUser) {
        const { error: pErr } = await sbDev
          .from('profiles')
          .update({
            gender: profile.gender,
            level: profile.level,
            nickname: profile.nickname,
            role: profile.role,
          })
          .eq('id', devUser.id)
        if (pErr) console.log(`     Update failed: ${pErr.message}`)
        else updated++
      }
      skipped++
      continue
    }

    // 3. Create auth user in dev
    const { data: authData, error: authErr } = await sbDev.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { name: profile.name_slug },
    })

    if (authErr) {
      console.error(`  x  Auth create failed for ${email}: ${authErr.message}`)
      continue
    }

    const devId = authData.user.id
    console.log(`  +  Created: ${email} (${devId})`)
    created++

    // Wait for DB trigger to create profile row
    await new Promise((r) => setTimeout(r, 500))

    // 4. Update profile with prod data
    const { error: pErr } = await sbDev
      .from('profiles')
      .update({
        gender: profile.gender,
        level: profile.level,
        nickname: profile.nickname,
        role: profile.role,
      })
      .eq('id', devId)

    if (pErr) console.error(`     Profile update failed: ${pErr.message}`)
    else {
      console.log(`     -> ${profile.name_slug} (${profile.gender ?? '?'}, L${profile.level ?? '?'})`)
      updated++
    }
  }

  console.log(`\nDone! Created: ${created}, Skipped: ${skipped}, Profiles updated: ${updated}`)
  console.log(`Password for new users: ${PASSWORD}\n`)
}

main().catch((e) => { console.error(e); process.exit(1) })
