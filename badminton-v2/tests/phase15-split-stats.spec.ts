import { test, expect, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

for (const envFile of ['.env.development', '.env']) {
  try {
    const raw = readFileSync(resolve(process.cwd(), envFile), 'utf-8')
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
    // try next env file
  }
}

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

type PlayerStatsRow = {
  player_id: string
  sessions_attended: number
  games_played: number
  wins: number
}

type PlayerPairStatsRow = {
  player_id: string
  other_player_id: string
  wins_together: number
  losses_against: number
}

type SessionFixture = {
  id: string
  name: string
}

const TEST_USERS = {
  admin: 'admin@test.local',
  target: 's2-marcus@test.local',
  partner: 's2-dana@test.local',
  opp1: 's2-kim@test.local',
  opp2: 's2-raj@test.local',
}

const SESSION_NAMES = {
  splitTwoZero: 'Phase 15 Verify Split 2-0',
  splitDraw: 'Phase 15 Verify Split 1-1',
  legacy: 'Phase 15 Verify Legacy',
}

const sessionFixtures: SessionFixture[] = []
const userIds = new Map<string, string>()
const baselinePlayerStats = new Map<string, PlayerStatsRow>()
let baselinePairStats: PlayerPairStatsRow[] = []
let profileExpectation = {
  sessionsAttended: 0,
  gamesPlayed: 0,
  wins: 0,
  losses: 0,
}

async function openDevPanel(page: Page) {
  const devBtn = page.getByRole('button', { name: 'DEV' })
  await devBtn.waitFor({ state: 'visible', timeout: 5000 })
  await devBtn.click()
}

async function ensureSignedOut(page: Page) {
  await openDevPanel(page)
  const signOutBtn = page.getByRole('button', { name: 'Sign out' })

  if (await signOutBtn.isVisible({ timeout: 2000 })) {
    await signOutBtn.click()
    await expect(signOutBtn).toBeHidden({ timeout: 10000 })
  } else {
    await page.getByRole('button', { name: 'DEV' }).click()
  }
}

async function signInAs(page: Page, label: string) {
  await openDevPanel(page)
  await page.getByRole('button', { name: label, exact: true }).click()
  await page.waitForFunction(
    () => !document.querySelector('.fixed.bottom-4 [class*="space-y-3"] button:not([class*="rounded-full"])'),
    { timeout: 10000 },
  )
  await expect(page.getByRole('heading', { name: 'Welcome back!' })).toBeVisible({ timeout: 15000 })
}

async function clearCheersGate(page: Page) {
  const skipButton = page.getByRole('button', { name: /Skip/ })
  for (let i = 0; i < 25; i++) {
    if (!(await skipButton.isVisible({ timeout: 1000 }).catch(() => false))) break
    await skipButton.click()
    await page.waitForTimeout(150)
  }
}

async function getUserId(email: string): Promise<string> {
  const { data } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  const user = data?.users?.find((row) => row.email === email)
  if (!user) throw new Error(`Missing test user ${email}. Run: npm run seed -- --sessions 2`)
  return user.id
}

async function snapshotStats() {
  const ids = [...userIds.values()]

  const { data: playerStatsRows } = await supabase
    .from('player_stats')
    .select('player_id, sessions_attended, games_played, wins')
    .in('player_id', ids)

  baselinePlayerStats.clear()
  for (const row of (playerStatsRows ?? []) as PlayerStatsRow[]) {
    baselinePlayerStats.set(row.player_id, row)
  }

  const { data: pairRows } = await supabase
    .from('player_pair_stats')
    .select('player_id, other_player_id, wins_together, losses_against')
    .in('player_id', ids)
    .in('other_player_id', ids)

  baselinePairStats = (pairRows ?? []) as PlayerPairStatsRow[]

  const targetId = userIds.get(TEST_USERS.target)!
  const targetStats = baselinePlayerStats.get(targetId)
  const baseSessions = targetStats?.sessions_attended ?? 0
  const baseGames = targetStats?.games_played ?? 0
  const baseWins = targetStats?.wins ?? 0
  const baseLosses = baseGames - baseWins

  profileExpectation = {
    sessionsAttended: baseSessions + 3,
    gamesPlayed: baseGames + 5,
    wins: baseWins + 4,
    losses: baseLosses + 1,
  }
}

async function cleanupExistingSessions() {
  const { data: existingSessions } = await supabase
    .from('sessions')
    .select('id')
    .in('name', Object.values(SESSION_NAMES))

  const ids = ((existingSessions ?? []) as Array<{ id: string }>).map((row) => row.id)
  if (ids.length === 0) return

  const { data: matches } = await supabase
    .from('matches')
    .select('id, session_id')
    .in('session_id', ids)

  const matchIds = ((matches ?? []) as Array<{ id: string }>).map((row) => row.id)
  if (matchIds.length > 0) {
    await supabase.from('match_results').delete().in('match_id', matchIds)
    await supabase.from('matches').delete().in('id', matchIds)
  }

  await supabase.from('session_registrations').delete().in('session_id', ids)
  await supabase.from('session_invitations').delete().in('session_id', ids)
  await supabase.from('sessions').delete().in('id', ids)
}

async function createSessionFixture({
  name,
  splitMatchScoring,
  resultRows,
}: {
  name: string
  splitMatchScoring: boolean
  resultRows: Array<{ winning_pair_index: 1 | 2; game_number: number }>
}): Promise<SessionFixture> {
  const adminId = userIds.get(TEST_USERS.admin)!
  const today = new Date().toISOString().slice(0, 10)
  const roster = [
    userIds.get(TEST_USERS.target)!,
    userIds.get(TEST_USERS.partner)!,
    userIds.get(TEST_USERS.opp1)!,
    userIds.get(TEST_USERS.opp2)!,
  ]

  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .insert({
      name,
      date: today,
      status: 'schedule_locked',
      created_by: adminId,
      split_match_scoring: splitMatchScoring,
    })
    .select('id, name')
    .single()

  if (sessionError) throw new Error(`Failed to create session ${name}: ${sessionError.message}`)

  const sessionId = (session as { id: string; name: string }).id
  await supabase.from('session_registrations').insert(
    roster.map((playerId) => ({
      session_id: sessionId,
      player_id: playerId,
      source: 'self',
    })),
  )

  const { data: match, error: matchError } = await supabase
    .from('matches')
    .insert({
      session_id: sessionId,
      queue_position: 1,
      status: 'complete',
      team1_player1_id: userIds.get(TEST_USERS.target)!,
      team1_player2_id: userIds.get(TEST_USERS.partner)!,
      team2_player1_id: userIds.get(TEST_USERS.opp1)!,
      team2_player2_id: userIds.get(TEST_USERS.opp2)!,
    })
    .select('id')
    .single()

  if (matchError) throw new Error(`Failed to create match for ${name}: ${matchError.message}`)

  const matchId = (match as { id: string }).id
  const { error: resultError } = await supabase
    .from('match_results')
    .insert(resultRows.map((row) => ({ match_id: matchId, ...row })))

  if (resultError) throw new Error(`Failed to create match_results for ${name}: ${resultError.message}`)

  return { id: sessionId, name }
}

async function restoreStats() {
  const ids = [...userIds.values()]

  await supabase
    .from('player_pair_stats')
    .delete()
    .in('player_id', ids)
    .in('other_player_id', ids)

  if (baselinePairStats.length > 0) {
    await supabase.from('player_pair_stats').insert(baselinePairStats)
  }

  await supabase.from('player_stats').delete().in('player_id', ids)
  if (baselinePlayerStats.size > 0) {
    await supabase.from('player_stats').insert([...baselinePlayerStats.values()])
  }
}

function entryRow(page: Page, name: string, record: string) {
  return page.locator('div').filter({ hasText: name }).filter({ hasText: record }).first()
}

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  for (const email of Object.values(TEST_USERS)) {
    userIds.set(email, await getUserId(email))
  }

  await snapshotStats()
  await cleanupExistingSessions()

  sessionFixtures.push(
    await createSessionFixture({
      name: SESSION_NAMES.splitTwoZero,
      splitMatchScoring: true,
      resultRows: [
        { winning_pair_index: 1, game_number: 1 },
        { winning_pair_index: 1, game_number: 2 },
      ],
    }),
  )

  sessionFixtures.push(
    await createSessionFixture({
      name: SESSION_NAMES.splitDraw,
      splitMatchScoring: true,
      resultRows: [
        { winning_pair_index: 1, game_number: 1 },
        { winning_pair_index: 2, game_number: 2 },
      ],
    }),
  )

  sessionFixtures.push(
    await createSessionFixture({
      name: SESSION_NAMES.legacy,
      splitMatchScoring: false,
      resultRows: [
        { winning_pair_index: 1, game_number: 1 },
      ],
    }),
  )
})

test.afterAll(async () => {
  const sessionIds = sessionFixtures.map((session) => session.id)
  if (sessionIds.length > 0) {
    const { data: matches } = await supabase
      .from('matches')
      .select('id')
      .in('session_id', sessionIds)

    const matchIds = ((matches ?? []) as Array<{ id: string }>).map((row) => row.id)
    if (matchIds.length > 0) {
      await supabase.from('match_results').delete().in('match_id', matchIds)
      await supabase.from('matches').delete().in('id', matchIds)
    }

    await supabase.from('session_registrations').delete().in('session_id', sessionIds)
    await supabase.from('sessions').delete().in('id', sessionIds)
  }

  await restoreStats()
})

test.afterEach(async ({ page }) => {
  try {
    await ensureSignedOut(page)
  } catch {
    // best effort
  }
})

test('verifies split and legacy stats surfaces for phase 15', async ({ page }) => {
  const splitTwoZeroSession = sessionFixtures.find((session) => session.name === SESSION_NAMES.splitTwoZero)!
  const splitDrawSession = sessionFixtures.find((session) => session.name === SESSION_NAMES.splitDraw)!
  const legacySession = sessionFixtures.find((session) => session.name === SESSION_NAMES.legacy)!
  const targetName = 's2-marcus-lim'

  await page.goto('/')
  await ensureSignedOut(page)
  await signInAs(page, 'S2 Marcus Lim')
  await clearCheersGate(page)

  await page.goto('/today')
  await clearCheersGate(page)
  await page.getByRole('button', { name: splitTwoZeroSession.name }).click()
  await expect(entryRow(page, targetName, '2W 0L')).toBeVisible()
  await expect(entryRow(page, targetName, '100%')).toBeVisible()

  await page.goto(`/sessions/${splitTwoZeroSession.id}`)
  await clearCheersGate(page)
  await page.getByRole('button', { name: 'Leaderboard' }).click()
  await expect(entryRow(page, targetName, '2W 0L')).toBeVisible()
  await expect(entryRow(page, targetName, '100%')).toBeVisible()

  await page.goto(`/sessions/${splitDrawSession.id}`)
  await clearCheersGate(page)
  await expect(page.getByText('1-1', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Leaderboard' }).click()
  await expect(entryRow(page, targetName, '1W 1L')).toBeVisible()
  await expect(entryRow(page, targetName, '50%')).toBeVisible()

  await page.goto(`/sessions/${legacySession.id}`)
  await clearCheersGate(page)
  await page.getByRole('button', { name: 'Leaderboard' }).click()
  await expect(entryRow(page, targetName, '1W 0L')).toBeVisible()
  await expect(entryRow(page, targetName, '100%')).toBeVisible()

  await page.goto('/profile')
  await clearCheersGate(page)
  await expect(page.getByText(String(profileExpectation.gamesPlayed)).first()).toBeVisible()
  await expect(page.getByText(`${profileExpectation.wins}W ${profileExpectation.losses}L`)).toBeVisible()
})
