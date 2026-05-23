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
  splitMatchScoring: boolean
  matchIds: {
    playing?: string
    queued?: string
  }
}

type MatchFixtureInput = {
  queuePosition: number
  status: 'playing' | 'queued'
  courtNumber: 1 | 2 | null
  startedAt?: string | null
}

const TEST_USERS = {
  admin: 'admin@test.local',
  target: 's2-marcus@test.local',
  partner: 's2-dana@test.local',
  opp1: 's2-kim@test.local',
  opp2: 's2-raj@test.local',
}

const SESSION_NAMES = {
  toggle: 'Phase 14 Validate Toggle',
  liveSplit: 'Phase 14 Validate Live Split',
  adminSplit: 'Phase 14 Validate Admin Split',
  legacyLive: 'Phase 14 Validate Legacy Live',
  legacyAdmin: 'Phase 14 Validate Legacy Admin',
}

const sessionFixtures = new Map<string, SessionFixture>()
const userIds = new Map<string, string>()
const playerLabels = new Map<string, string>()
const baselinePlayerStats = new Map<string, PlayerStatsRow>()
let baselinePairStats: PlayerPairStatsRow[] = []

function teamLabel(player1: string, player2: string) {
  return `${playerLabels.get(player1)!} & ${playerLabels.get(player2)!}`
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
  await page.waitForTimeout(800)
}

async function getUserId(email: string): Promise<string> {
  const { data } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  const user = data?.users?.find((row) => row.email === email)
  if (!user) throw new Error(`Missing test user ${email}. Run: npm run seed -- --sessions 2`)
  return user.id
}

async function loadPlayerLabels() {
  const ids = [...userIds.values()]
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name_slug, nickname')
    .in('id', ids)

  if (error) throw new Error(`Failed to load profile labels: ${error.message}`)

  for (const row of (data ?? []) as Array<{ id: string; name_slug: string; nickname: string | null }>) {
    playerLabels.set(row.id, row.nickname ?? row.name_slug)
  }
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

async function cleanupExistingSessions() {
  const names = Object.values(SESSION_NAMES)
  const { data: existingSessions } = await supabase
    .from('sessions')
    .select('id')
    .in('name', names)

  const sessionIds = ((existingSessions ?? []) as Array<{ id: string }>).map((row) => row.id)
  if (sessionIds.length === 0) return

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
  await supabase.from('session_invitations').delete().in('session_id', sessionIds)
  await supabase.from('sessions').delete().in('id', sessionIds)
}

async function createSessionFixture({
  name,
  status,
  splitMatchScoring,
  matches = [],
}: {
  name: string
  status: 'registration_closed' | 'in_progress'
  splitMatchScoring: boolean
  matches?: MatchFixtureInput[]
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
      status,
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

  const matchIds: SessionFixture['matchIds'] = {}

  for (const match of matches) {
    const { data: insertedMatch, error: matchError } = await supabase
      .from('matches')
      .insert({
        session_id: sessionId,
        queue_position: match.queuePosition,
        status: match.status,
        court_number: match.courtNumber,
        started_at: match.startedAt ?? null,
        team1_player1_id: userIds.get(TEST_USERS.target)!,
        team1_player2_id: userIds.get(TEST_USERS.partner)!,
        team2_player1_id: userIds.get(TEST_USERS.opp1)!,
        team2_player2_id: userIds.get(TEST_USERS.opp2)!,
      })
      .select('id')
      .single()

    if (matchError) throw new Error(`Failed to create match for ${name}: ${matchError.message}`)

    const matchId = (insertedMatch as { id: string }).id
    if (match.status === 'playing') matchIds.playing = matchId
    if (match.status === 'queued') matchIds.queued = matchId
  }

  return {
    id: sessionId,
    name,
    splitMatchScoring,
    matchIds,
  }
}

async function getSessionSplitFlag(sessionId: string) {
  const { data, error } = await supabase
    .from('sessions')
    .select('split_match_scoring')
    .eq('id', sessionId)
    .single()

  if (error) throw new Error(`Failed to read session flag: ${error.message}`)
  return (data as { split_match_scoring: boolean | null }).split_match_scoring === true
}

async function getMatchResults(matchId: string) {
  const { data, error } = await supabase
    .from('match_results')
    .select('winning_pair_index, game_number')
    .eq('match_id', matchId)
    .order('game_number')

  if (error) throw new Error(`Failed to read match results: ${error.message}`)
  return (data ?? []) as Array<{ winning_pair_index: number; game_number: number }>
}

async function getMatchStates(sessionId: string) {
  const { data, error } = await supabase
    .from('matches')
    .select('id, status, court_number, queue_position')
    .eq('session_id', sessionId)
    .order('queue_position')

  if (error) throw new Error(`Failed to read match states: ${error.message}`)
  return (data ?? []) as Array<{ id: string; status: string; court_number: number | null; queue_position: number }>
}

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  for (const email of Object.values(TEST_USERS)) {
    userIds.set(email, await getUserId(email))
  }

  await loadPlayerLabels()
  await snapshotStats()
  await cleanupExistingSessions()

  const now = new Date().toISOString()
  sessionFixtures.set(
    'toggle',
    await createSessionFixture({
      name: SESSION_NAMES.toggle,
      status: 'registration_closed',
      splitMatchScoring: false,
    }),
  )
  sessionFixtures.set(
    'liveSplit',
    await createSessionFixture({
      name: SESSION_NAMES.liveSplit,
      status: 'in_progress',
      splitMatchScoring: true,
      matches: [
        { queuePosition: 1, status: 'playing', courtNumber: 1, startedAt: now },
        { queuePosition: 2, status: 'queued', courtNumber: null },
      ],
    }),
  )
  sessionFixtures.set(
    'adminSplit',
    await createSessionFixture({
      name: SESSION_NAMES.adminSplit,
      status: 'in_progress',
      splitMatchScoring: true,
      matches: [
        { queuePosition: 1, status: 'playing', courtNumber: 1, startedAt: now },
        { queuePosition: 2, status: 'queued', courtNumber: null },
      ],
    }),
  )
  sessionFixtures.set(
    'legacyLive',
    await createSessionFixture({
      name: SESSION_NAMES.legacyLive,
      status: 'in_progress',
      splitMatchScoring: false,
      matches: [
        { queuePosition: 1, status: 'playing', courtNumber: 1, startedAt: now },
        { queuePosition: 2, status: 'queued', courtNumber: null },
      ],
    }),
  )
  sessionFixtures.set(
    'legacyAdmin',
    await createSessionFixture({
      name: SESSION_NAMES.legacyAdmin,
      status: 'in_progress',
      splitMatchScoring: false,
      matches: [
        { queuePosition: 1, status: 'playing', courtNumber: 1, startedAt: now },
      ],
    }),
  )
})

test.afterAll(async () => {
  const sessionIds = [...sessionFixtures.values()].map((session) => session.id)
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

test('persists split scoring toggle through reload', async ({ page }) => {
  const session = sessionFixtures.get('toggle')!

  await page.goto('/')
  await ensureSignedOut(page)
  await signInAs(page, 'Admin')

  await page.goto(`/session/${session.id}`)
  const toggle = page.getByLabel('Split match scoring')
  await expect(toggle).not.toBeChecked()

  await toggle.check()
  await expect(page.getByText('Split scoring enabled')).toBeVisible({ timeout: 10000 })
  await expect.poll(async () => getSessionSplitFlag(session.id)).toBe(true)

  await page.reload()
  await expect(page.getByLabel('Split match scoring')).toBeChecked()
})

test('records live board split outcome as two rows and advances the queue', async ({ page }) => {
  const session = sessionFixtures.get('liveSplit')!
  const playingMatchId = session.matchIds.playing!
  const queuedMatchId = session.matchIds.queued!
  const team1 = teamLabel(userIds.get(TEST_USERS.target)!, userIds.get(TEST_USERS.partner)!)
  const team2 = teamLabel(userIds.get(TEST_USERS.opp1)!, userIds.get(TEST_USERS.opp2)!)

  await page.goto('/')
  await ensureSignedOut(page)
  await page.goto(`/live-board/${session.id}`)

  await page.getByRole('button', { name: 'Finish' }).first().click()
  await expect(page.getByRole('button', { name: `${team1} won 2-0`, exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '1-1 Draw', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: `${team2} won 2-0`, exact: true })).toBeVisible()

  await page.getByRole('button', { name: `${team1} won 2-0`, exact: true }).click()

  await expect.poll(async () => getMatchResults(playingMatchId)).toEqual([
    { winning_pair_index: 1, game_number: 1 },
    { winning_pair_index: 1, game_number: 2 },
  ])
  await expect.poll(async () => getMatchStates(session.id)).toEqual([
    { id: playingMatchId, status: 'complete', court_number: 1, queue_position: 1 },
    { id: queuedMatchId, status: 'playing', court_number: 1, queue_position: 2 },
  ])
  await expect(page.getByText('Game 2').first()).toBeVisible({ timeout: 10000 })
})

test('records admin split draw as two rows and advances the queue', async ({ page }) => {
  const session = sessionFixtures.get('adminSplit')!
  const playingMatchId = session.matchIds.playing!
  const queuedMatchId = session.matchIds.queued!
  const team1 = teamLabel(userIds.get(TEST_USERS.target)!, userIds.get(TEST_USERS.partner)!)
  const team2 = teamLabel(userIds.get(TEST_USERS.opp1)!, userIds.get(TEST_USERS.opp2)!)

  await page.goto('/')
  await ensureSignedOut(page)
  await signInAs(page, 'Admin')

  await page.goto(`/session/${session.id}`)
  await page.getByRole('button', { name: 'Finish' }).first().click()
  await expect(page.getByRole('button', { name: `${team1} won 2-0`, exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '1-1 Draw', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: `${team2} won 2-0`, exact: true })).toBeVisible()

  await page.getByRole('button', { name: '1-1 Draw', exact: true }).click()

  await expect.poll(async () => getMatchResults(playingMatchId)).toEqual([
    { winning_pair_index: 1, game_number: 1 },
    { winning_pair_index: 2, game_number: 2 },
  ])
  await expect.poll(async () => getMatchStates(session.id)).toEqual([
    { id: playingMatchId, status: 'complete', court_number: 1, queue_position: 1 },
    { id: queuedMatchId, status: 'playing', court_number: 1, queue_position: 2 },
  ])
  await expect(page.getByText('Game 2').first()).toBeVisible({ timeout: 10000 })
})

test('keeps the live board legacy finish flow on one-game sessions', async ({ page }) => {
  const session = sessionFixtures.get('legacyLive')!
  const playingMatchId = session.matchIds.playing!
  const queuedMatchId = session.matchIds.queued!
  const team1 = teamLabel(userIds.get(TEST_USERS.target)!, userIds.get(TEST_USERS.partner)!)
  const team2 = teamLabel(userIds.get(TEST_USERS.opp1)!, userIds.get(TEST_USERS.opp2)!)

  await page.goto('/')
  await ensureSignedOut(page)
  await page.goto(`/live-board/${session.id}`)

  await page.getByRole('button', { name: 'Finish' }).first().click()
  await expect(page.getByRole('button', { name: team1, exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: team2, exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '1-1 Draw', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /won 2-0/ })).toHaveCount(0)

  await page.getByRole('button', { name: team1, exact: true }).click()

  await expect.poll(async () => getMatchResults(playingMatchId)).toEqual([
    { winning_pair_index: 1, game_number: 1 },
  ])
  await expect.poll(async () => getMatchStates(session.id)).toEqual([
    { id: playingMatchId, status: 'complete', court_number: 1, queue_position: 1 },
    { id: queuedMatchId, status: 'playing', court_number: 1, queue_position: 2 },
  ])
})

test('keeps the admin legacy finish flow on one-game sessions', async ({ page }) => {
  const session = sessionFixtures.get('legacyAdmin')!
  const team1 = teamLabel(userIds.get(TEST_USERS.target)!, userIds.get(TEST_USERS.partner)!)
  const team2 = teamLabel(userIds.get(TEST_USERS.opp1)!, userIds.get(TEST_USERS.opp2)!)

  await page.goto('/')
  await ensureSignedOut(page)
  await signInAs(page, 'Admin')

  await page.goto(`/session/${session.id}`)
  await page.getByRole('button', { name: 'Finish' }).first().click()
  await expect(page.getByRole('button', { name: team1, exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: team2, exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Draw / No Winner', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '1-1 Draw', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /won 2-0/ })).toHaveCount(0)
})
