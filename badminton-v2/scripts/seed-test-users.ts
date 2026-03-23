/**
 * Seed script: creates 8 test users, profiles, and one or more test sessions with 30 matches each.
 * Safe to re-run (idempotent). Existing session matches are deleted and recreated.
 *
 * Usage:
 *   npx tsx scripts/seed-test-users.ts [--date YYYY-MM-DD] [--sessions N]
 *
 * Options:
 *   --date      Session date (default: today)
 *   --sessions  Number of sessions to create on that date (default: 1)
 *
 * Examples:
 *   npm run seed
 *   npm run seed -- --sessions 2
 *   npm run seed -- --date 2026-03-25 --sessions 3
 *
 * Requires in .env:
 *   VITE_SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// ---------------------------------------------------------------------------
// Load .env manually (no dotenv dependency needed)
// ---------------------------------------------------------------------------
const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '../.env')
try {
  const raw = readFileSync(envPath, 'utf-8')
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    const key = trimmed.slice(0, idx).trim()
    const val = trimmed.slice(idx + 1).trim()
    if (!process.env[key]) process.env[key] = val
  }
} catch {
  // .env not found — rely on actual environment variables
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌  Missing env vars. Add to .env:')
  console.error('   VITE_SUPABASE_URL=...')
  console.error('   SUPABASE_SERVICE_ROLE_KEY=...')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ---------------------------------------------------------------------------
// Test user definitions
//
// Structure per session (8 players total):
//   - 4 CORE players: admin + 3 "multiple-*" players shared across ALL sessions
//   - 4 SESSION-SPECIFIC players: unique to each session
//
// This lets you test the multi-session Today tab — multiple-john/jane/joe will
// see a session picker with all sessions they're registered in.
// ---------------------------------------------------------------------------
const TEST_PASSWORD = 'Test1234!'

type UserDef = { email: string; name: string; role: 'admin' | 'player'; gender: 'M' | 'F'; level: number }

// Always registered in every session
const CORE_USERS: UserDef[] = [
  { email: 'admin@test.local',          name: 'Test Admin',     role: 'admin',  gender: 'M', level: 8 },
  { email: 'multiple-john@test.local',  name: 'Multiple John',  role: 'player', gender: 'M', level: 7 },
  { email: 'multiple-jane@test.local',  name: 'Multiple Jane',  role: 'player', gender: 'F', level: 6 },
  { email: 'multiple-joe@test.local',   name: 'Multiple Joe',   role: 'player', gender: 'M', level: 5 },
]

// 4 unique players per session slot (supports up to 4 sessions)
const SESSION_PLAYER_POOLS: UserDef[][] = [
  [
    { email: 's1-alex@test.local',   name: 'S1 Alex Tan',   role: 'player', gender: 'M', level: 6 },
    { email: 's1-jamie@test.local',  name: 'S1 Jamie Lee',  role: 'player', gender: 'F', level: 5 },
    { email: 's1-sam@test.local',    name: 'S1 Sam Wong',   role: 'player', gender: 'M', level: 7 },
    { email: 's1-wei@test.local',    name: 'S1 Wei Chen',   role: 'player', gender: 'M', level: 7 },
  ],
  [
    { email: 's2-marcus@test.local', name: 'S2 Marcus Lim', role: 'player', gender: 'M', level: 8 },
    { email: 's2-dana@test.local',   name: 'S2 Dana Park',  role: 'player', gender: 'F', level: 5 },
    { email: 's2-kim@test.local',    name: 'S2 Kim Soo',    role: 'player', gender: 'F', level: 6 },
    { email: 's2-raj@test.local',    name: 'S2 Raj Patel',  role: 'player', gender: 'M', level: 7 },
  ],
  [
    { email: 's3-priya@test.local',  name: 'S3 Priya Nair', role: 'player', gender: 'F', level: 6 },
    { email: 's3-mei@test.local',    name: 'S3 Mei Lin',    role: 'player', gender: 'F', level: 7 },
    { email: 's3-chris@test.local',  name: 'S3 Chris Ho',   role: 'player', gender: 'M', level: 5 },
    { email: 's3-amy@test.local',    name: 'S3 Amy Yong',   role: 'player', gender: 'F', level: 8 },
  ],
  [
    { email: 's4-ben@test.local',    name: 'S4 Ben Tan',    role: 'player', gender: 'M', level: 6 },
    { email: 's4-lisa@test.local',   name: 'S4 Lisa Ng',    role: 'player', gender: 'F', level: 7 },
    { email: 's4-ivan@test.local',   name: 'S4 Ivan Koh',   role: 'player', gender: 'M', level: 5 },
    { email: 's4-sara@test.local',   name: 'S4 Sara Lim',   role: 'player', gender: 'F', level: 6 },
  ],
]

// ---------------------------------------------------------------------------
// Match schedule: 30 matches for 8 players
// Each entry: [team1p1, team1p2, team2p1, team2p2] as player index (0–7)
// Each player plays exactly 15 matches — balanced distribution.
// ---------------------------------------------------------------------------
const MATCH_SCHEDULE = [
  [0,1, 2,3], [4,5, 6,7], [0,2, 4,6], [1,3, 5,7], [0,3, 5,6],
  [1,2, 4,7], [0,4, 3,7], [1,5, 2,6], [0,5, 2,7], [1,4, 3,6],
  [0,6, 1,7], [2,4, 3,5], [0,7, 1,6], [2,5, 3,4], [0,1, 4,5],
  [2,3, 6,7], [0,2, 3,6], [1,4, 5,7], [0,3, 4,7], [1,6, 2,5],
  [0,4, 1,5], [2,6, 3,7], [0,5, 3,7], [1,2, 4,6], [0,6, 2,7],
  [1,3, 4,5], [0,7, 2,4], [1,5, 3,6], [0,1, 3,5], [2,6, 4,7],
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function log(msg: string) { console.log(msg) }
function err(msg: string) { console.error('❌ ', msg) }

async function getOrCreateUser(email: string, name: string, allUsers: Array<{ id: string; email?: string }>) {
  const existing = allUsers.find((u) => u.email === email)
  if (existing) {
    log(`  ↩  User exists: ${email} (${existing.id})`)
    return existing.id
  }
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { name },
  })
  if (error) { err(`createUser ${email}: ${error.message}`); process.exit(1) }
  log(`  ✓  Created user: ${email} (${data.user.id})`)
  return data.user.id
}

// ---------------------------------------------------------------------------
// Parse CLI args
// ---------------------------------------------------------------------------
function parseArgs() {
  const args = process.argv.slice(2)
  const today = new Date().toISOString().slice(0, 10)
  let date = today
  let sessions = 1

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--date' && args[i + 1]) {
      date = args[++i]
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        console.error('❌  --date must be in YYYY-MM-DD format')
        process.exit(1)
      }
    } else if (args[i] === '--sessions' && args[i + 1]) {
      sessions = parseInt(args[++i], 10)
      if (isNaN(sessions) || sessions < 1) {
        console.error('❌  --sessions must be a positive integer')
        process.exit(1)
      }
    }
  }

  return { date, sessions }
}

// ---------------------------------------------------------------------------
// Seed a single session
// ---------------------------------------------------------------------------
async function seedSession(
  sessionName: string,
  date: string,
  adminId: string,
  userIds: string[],
  sessionIndex: number,
) {
  log(`\n📅  Setting up "${sessionName}"...`)

  let sessionId: string
  const { data: existingSession } = await supabase
    .from('sessions')
    .select('id')
    .eq('name', sessionName)
    .maybeSingle()

  if (existingSession) {
    sessionId = (existingSession as { id: string }).id
    log(`  ↩  Session exists (${sessionId})`)
  } else {
    const VENUES = ['Sports Hall A', 'Sports Hall B', 'Sports Hall C']
    const TIMES  = ['10:00', '14:00', '18:00', '20:00']
    const { data: sess, error } = await supabase
      .from('sessions')
      .insert({
        name: sessionName,
        date,
        venue: VENUES[sessionIndex % VENUES.length],
        time: TIMES[sessionIndex % TIMES.length],
        status: 'in_progress',
        created_by: adminId,
      })
      .select('id')
      .single()
    if (error) { err(`create session "${sessionName}": ${error.message}`); process.exit(1) }
    sessionId = (sess as { id: string }).id
    log(`  ✓  Created session (${sessionId})`)
  }

  // Register all players
  log('  📋  Registering players...')
  for (const playerId of userIds) {
    const { error } = await supabase
      .from('session_registrations')
      .upsert({ session_id: sessionId, player_id: playerId }, { onConflict: 'session_id,player_id' })
    if (error) { err(`register player ${playerId}: ${error.message}`); process.exit(1) }
  }
  log(`  ✓  Registered ${userIds.length} players`)

  // Create matches — delete existing first
  const { data: existingMatches } = await supabase
    .from('matches').select('id').eq('session_id', sessionId)

  if (existingMatches && existingMatches.length > 0) {
    const { error } = await supabase.from('matches').delete().eq('session_id', sessionId)
    if (error) { err(`delete existing matches: ${error.message}`); process.exit(1) }
    log(`  🗑  Deleted ${existingMatches.length} existing matches`)
  }

  const matches = MATCH_SCHEDULE.map(([t1p1, t1p2, t2p1, t2p2], i) => ({
    session_id:        sessionId,
    queue_position:    i + 1,
    status:            i === 0 ? 'playing' : i === 1 ? 'playing' : 'queued',
    court_number:      i === 0 ? 1 : i === 1 ? 2 : null,
    team1_player1_id:  userIds[t1p1],
    team1_player2_id:  userIds[t1p2],
    team2_player1_id:  userIds[t2p1],
    team2_player2_id:  userIds[t2p2],
  }))

  const { error: matchError } = await supabase.from('matches').insert(matches)
  if (matchError) { err(`create matches: ${matchError.message}`); process.exit(1) }
  log(`  ✓  Created 30 matches (2 playing on courts 1 & 2, 28 queued)`)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const { date, sessions: sessionCount } = parseArgs()

  if (sessionCount > SESSION_PLAYER_POOLS.length) {
    err(`Max ${SESSION_PLAYER_POOLS.length} sessions supported. Add more pools in SESSION_PLAYER_POOLS to increase.`)
    process.exit(1)
  }

  log(`\n🌱  Seeding test data (${date}, ${sessionCount} session${sessionCount > 1 ? 's' : ''})...\n`)

  // Collect all users needed for the requested number of sessions
  const allNeededUsers: UserDef[] = [
    ...CORE_USERS,
    ...SESSION_PLAYER_POOLS.slice(0, sessionCount).flat(),
  ]

  // 1. Fetch existing auth users once
  const { data: userList } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  const existingUsers = userList?.users ?? []

  // 2. Create users
  log('👤  Creating test users...')
  const userIdMap = new Map<string, string>() // email → id
  for (const u of allNeededUsers) {
    const id = await getOrCreateUser(u.email, u.name, existingUsers)
    userIdMap.set(u.email, id)
  }

  // Small delay to allow the DB trigger to create profiles
  await new Promise((r) => setTimeout(r, 1500))

  // 3. Set roles, genders, levels on profiles
  log('\n🔧  Updating profiles...')
  for (const u of allNeededUsers) {
    const id = userIdMap.get(u.email)!
    const { error } = await supabase
      .from('profiles')
      .update({ role: u.role, gender: u.gender, level: u.level })
      .eq('id', id)
    if (error) { err(`profile update ${u.email}: ${error.message}`); process.exit(1) }
    log(`  ✓  ${u.name} (${u.role}, ${u.gender}, L${u.level})`)
  }

  // 4. Create sessions
  const adminId = userIdMap.get('admin@test.local')!

  for (let i = 0; i < sessionCount; i++) {
    const name = sessionCount === 1 ? 'Test Session' : `Test Session ${i + 1}`

    // Session roster: 4 core + 4 session-specific = 8 players
    const sessionUsers = [...CORE_USERS, ...SESSION_PLAYER_POOLS[i]]
    const sessionUserIds = sessionUsers.map((u) => userIdMap.get(u.email)!)

    await seedSession(name, date, adminId, sessionUserIds, i)
  }

  log('\n✅  Seed complete!\n')
  log('Test accounts (password: Test1234!):')
  log('  [Core — in every session]')
  for (const u of CORE_USERS) {
    log(`  ${u.role === 'admin' ? 'Admin ' : 'Player'}: ${u.email.padEnd(32)} ${u.name}`)
  }
  for (let i = 0; i < sessionCount; i++) {
    const label = sessionCount === 1 ? 'Test Session' : `Test Session ${i + 1}`
    log(`\n  [${label} only]`)
    for (const u of SESSION_PLAYER_POOLS[i]) {
      log(`  Player: ${u.email.padEnd(32)} ${u.name}`)
    }
  }
  log(`\n  Password for all: ${TEST_PASSWORD}\n`)
}

main().catch((e) => { console.error(e); process.exit(1) })
