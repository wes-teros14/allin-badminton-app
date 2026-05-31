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
    // Fall back to the current shell environment when a local env file is absent.
  }
}

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function getUserId(email: string): Promise<string> {
  const { data } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  const user = data?.users?.find((entry) => entry.email === email)
  if (!user) throw new Error(`Test user not found: ${email}`)
  return user.id
}

async function signInAs(page: Page, label: string) {
  const devBtn = page.getByRole('button', { name: 'DEV' })
  await devBtn.waitFor({ state: 'visible', timeout: 5000 })
  await devBtn.click()
  await page.getByRole('button', { name: label, exact: true }).click()
  await page.waitForFunction(
    () => !document.querySelector('.fixed.bottom-4 [class*="space-y-3"] button:not([class*="rounded-full"])'),
    { timeout: 10000 },
  )
  await page.waitForTimeout(1000)
}

async function ensureSignedOut(page: Page) {
  const devBtn = page.getByRole('button', { name: 'DEV' })
  await devBtn.waitFor({ state: 'visible', timeout: 5000 })
  await devBtn.click()
  const signOutBtn = page.getByRole('button', { name: 'Sign out' })
  if (await signOutBtn.isVisible({ timeout: 2000 })) {
    await signOutBtn.click()
    await page.waitForTimeout(1500)
  } else {
    await devBtn.click()
  }
}

test.describe.configure({ mode: 'serial' })

let adminId: string
let setupSessionId: string
let liveSessionId: string

test.beforeAll(async () => {
  adminId = await getUserId('admin@test.local')
  const today = new Date().toISOString().slice(0, 10)

  const { data: setupSession } = await supabase
    .from('sessions')
    .insert({ name: 'Court Count Setup Session', date: today, status: 'setup', created_by: adminId, court_count: 2 })
    .select('id')
    .single()
  setupSessionId = (setupSession as { id: string }).id

  const { data: liveSession } = await supabase
    .from('sessions')
    .insert({ name: 'Court Count Live Session', date: today, status: 'in_progress', created_by: adminId, court_count: 3 })
    .select('id')
    .single()
  liveSessionId = (liveSession as { id: string }).id

  const playerIds = await Promise.all([
    getUserId('s1-alex@test.local'),
    getUserId('s1-jamie@test.local'),
    getUserId('s1-sam@test.local'),
    getUserId('s1-wei@test.local'),
    getUserId('s2-marcus@test.local'),
    getUserId('s2-dana@test.local'),
    getUserId('s2-kim@test.local'),
    getUserId('s2-raj@test.local'),
  ])

  const matches = [
    {
      session_id: liveSessionId,
      queue_position: 1,
      status: 'playing',
      court_number: 1,
      started_at: new Date().toISOString(),
      team1_player1_id: playerIds[0],
      team1_player2_id: playerIds[1],
      team2_player1_id: playerIds[2],
      team2_player2_id: playerIds[3],
    },
    {
      session_id: liveSessionId,
      queue_position: 2,
      status: 'playing',
      court_number: 2,
      started_at: new Date().toISOString(),
      team1_player1_id: playerIds[4],
      team1_player2_id: playerIds[5],
      team2_player1_id: playerIds[6],
      team2_player2_id: playerIds[7],
    },
    {
      session_id: liveSessionId,
      queue_position: 3,
      status: 'playing',
      court_number: 3,
      started_at: new Date().toISOString(),
      team1_player1_id: playerIds[0],
      team1_player2_id: playerIds[2],
      team2_player1_id: playerIds[4],
      team2_player2_id: playerIds[6],
    },
    {
      session_id: liveSessionId,
      queue_position: 4,
      status: 'queued',
      court_number: null,
      team1_player1_id: playerIds[1],
      team1_player2_id: playerIds[3],
      team2_player1_id: playerIds[5],
      team2_player2_id: playerIds[7],
    },
  ]

  await supabase.from('matches').insert(matches)
})

test.afterAll(async () => {
  await supabase.from('sessions').delete().in('id', [setupSessionId, liveSessionId])
})

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await ensureSignedOut(page)
  await signInAs(page, 'Admin')
})

test.afterEach(async ({ page }) => {
  try { await ensureSignedOut(page) } catch { /* ignore */ }
})

test('admin can persist a session court count from setup', async ({ page }) => {
  await page.goto(`/session/${setupSessionId}`)
  await page.getByLabel('Court count').fill('3')
  await page.getByRole('button', { name: 'Confirm' }).click()
  await expect(page.getByText('Close Registration')).toBeVisible({ timeout: 15000 })

  const { data } = await supabase.from('sessions').select('court_count').eq('id', setupSessionId).maybeSingle()
  expect((data as { court_count: number }).court_count).toBe(3)
})

test('live board renders one court panel per configured court', async ({ page }) => {
  await page.goto(`/live-board/${liveSessionId}`)
  await expect(page.getByRole('heading', { name: 'COURT 1' })).toBeVisible({ timeout: 15000 })
  await expect(page.getByRole('heading', { name: 'COURT 2' })).toBeVisible({ timeout: 15000 })
  await expect(page.getByRole('heading', { name: 'COURT 3' })).toBeVisible({ timeout: 15000 })
})
