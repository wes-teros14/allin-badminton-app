import { test, expect, type Locator, type Page } from '@playwright/test'
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

const TEST_USERS = {
  admin: 'admin@test.local',
  paidOne: 's1-alex@test.local',
  paidTwo: 's1-jamie@test.local',
}

const SESSION_NAMES = {
  manual: 'Phase 18 Finance Manual Regression',
  auto: 'Phase 18 Finance Auto Regression',
}

const BATCH_BRANDS = {
  manualPrimary: 'Phase 18 Manual Alpha',
  manualSecondary: 'Phase 18 Manual Beta',
  autoPrimary: 'Phase 18 Auto Alpha',
  autoSecondary: 'Phase 18 Auto Beta',
}

type SessionFixture = {
  id: string
  name: string
}

type BatchFixture = {
  id: string
  brand: string
}

const userIds = new Map<string, string>()
const sessionFixtures = new Map<string, SessionFixture>()
const batchFixtures = new Map<string, BatchFixture>()

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

async function clearCheersGate(page: Page) {
  const skipButton = page.getByRole('button', { name: /Skip/ })
  for (let i = 0; i < 25; i += 1) {
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

async function cleanupExistingFixtures() {
  const sessionNames = Object.values(SESSION_NAMES)
  const batchBrands = Object.values(BATCH_BRANDS)

  const { data: existingSessions } = await supabase
    .from('sessions')
    .select('id')
    .in('name', sessionNames)

  const sessionIds = ((existingSessions ?? []) as Array<{ id: string }>).map((row) => row.id)
  if (sessionIds.length > 0) {
    await supabase.from('shuttle_usage').delete().in('session_id', sessionIds)
    await supabase.from('session_registrations').delete().in('session_id', sessionIds)
    await supabase.from('sessions').delete().in('id', sessionIds)
  }

  const { data: existingBatches } = await supabase
    .from('shuttle_batches')
    .select('id')
    .in('brand', batchBrands)

  const batchIds = ((existingBatches ?? []) as Array<{ id: string }>).map((row) => row.id)
  if (batchIds.length > 0) {
    await supabase.from('shuttle_usage').delete().in('batch_id', batchIds)
    await supabase.from('shuttle_batches').delete().in('id', batchIds)
  }
}

async function createSessionFixture(name: string): Promise<SessionFixture> {
  const adminId = userIds.get(TEST_USERS.admin)!
  const today = new Date().toISOString().slice(0, 10)

  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .insert({
      name,
      date: today,
      status: 'schedule_locked',
      created_by: adminId,
      price: 150,
      court_cost: 100,
      shuttle_allocation_mode: 'auto',
    })
    .select('id, name')
    .single()

  if (sessionError) throw new Error(`Failed to create session ${name}: ${sessionError.message}`)

  const sessionId = (session as { id: string; name: string }).id
  const paidPlayers = [userIds.get(TEST_USERS.paidOne)!, userIds.get(TEST_USERS.paidTwo)!]
  await supabase.from('session_registrations').insert(
    paidPlayers.map((playerId) => ({
      session_id: sessionId,
      player_id: playerId,
      source: 'self',
      paid: true,
    })),
  )

  return { id: sessionId, name }
}

async function createBatchFixture(
  brand: string,
  costPerTube: number,
  shuttlesPerTube: number,
): Promise<BatchFixture> {
  const adminId = userIds.get(TEST_USERS.admin)!
  const { data: batch, error } = await supabase
    .from('shuttle_batches')
    .insert({
      brand,
      tube_count: 1,
      shuttles_per_tube: shuttlesPerTube,
      cost_per_tube: costPerTube,
      notes: `${brand} notes`,
      created_by: adminId,
    })
    .select('id, brand')
    .single()

  if (error) throw new Error(`Failed to create batch ${brand}: ${error.message}`)

  return batch as BatchFixture
}

function financeRow(page: Page, name: string): Locator {
  return page.locator('tr').filter({ hasText: name }).first()
}

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  for (const email of Object.values(TEST_USERS)) {
    userIds.set(email, await getUserId(email))
  }

  await cleanupExistingFixtures()

  sessionFixtures.set('manual', await createSessionFixture(SESSION_NAMES.manual))
  sessionFixtures.set('auto', await createSessionFixture(SESSION_NAMES.auto))

  batchFixtures.set('manualPrimary', await createBatchFixture(BATCH_BRANDS.manualPrimary, 120, 12))
  batchFixtures.set('manualSecondary', await createBatchFixture(BATCH_BRANDS.manualSecondary, 144, 12))
  batchFixtures.set('autoPrimary', await createBatchFixture(BATCH_BRANDS.autoPrimary, 60, 12))
  batchFixtures.set('autoSecondary', await createBatchFixture(BATCH_BRANDS.autoSecondary, 72, 12))
})

test.afterAll(async () => {
  const sessionIds = [...sessionFixtures.values()].map((session) => session.id)
  if (sessionIds.length > 0) {
    await supabase.from('shuttle_usage').delete().in('session_id', sessionIds)
    await supabase.from('session_registrations').delete().in('session_id', sessionIds)
    await supabase.from('sessions').delete().in('id', sessionIds)
  }

  const batchIds = [...batchFixtures.values()].map((batch) => batch.id)
  if (batchIds.length > 0) {
    await supabase.from('shuttle_usage').delete().in('batch_id', batchIds)
    await supabase.from('shuttle_batches').delete().in('id', batchIds)
  }
})

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await ensureSignedOut(page)
})

test.afterEach(async ({ page }) => {
  try {
    await ensureSignedOut(page)
  } catch {
    // best effort
  }
})

test('blocks invalid manual saves and preserves manual allocation totals in the browser', async ({ page }) => {
  await signInAs(page, 'Admin')
  await clearCheersGate(page)

  await page.goto('/finance')
  await clearCheersGate(page)
  await financeRow(page, SESSION_NAMES.manual).click()

  await page.getByRole('button', { name: 'Manual', exact: true }).click()
  await expect(page.getByText('Manual batch allocation')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save Allocation' })).toBeDisabled()

  await page.getByRole('button', { name: 'Add batch' }).click()
  await page.getByLabel('Search batches by brand').fill('Manual Beta')
  await expect(page.getByRole('cell', { name: BATCH_BRANDS.manualSecondary, exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.getByLabel('Search batches by brand')).toBeHidden()
  await expect(page.getByRole('cell', { name: BATCH_BRANDS.manualSecondary, exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Add batch' }).click()
  await page.getByLabel('Search batches by brand').fill('Manual Beta')
  const duplicateAddButton = page.getByRole('button', { name: 'Add', exact: true })
  if (await duplicateAddButton.count()) {
    await duplicateAddButton.click()
  }
  await expect(page.getByRole('cell', { name: BATCH_BRANDS.manualSecondary, exact: true })).toHaveCount(1)
  await page.getByLabel('Search batches by brand').fill('Manual Alpha')
  await page.getByRole('button', { name: 'Add', exact: true }).click()

  const usedInputs = page.locator('table input[type="number"]')
  await usedInputs.nth(0).fill('13')
  await expect(page.getByText('Only 12 shuttles available in this batch.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save Allocation' })).toBeDisabled()

  await usedInputs.nth(0).fill('3')
  await usedInputs.nth(1).fill('5')
  await expect(page.getByRole('button', { name: 'Save Allocation' })).toBeEnabled()

  await page.getByRole('button', { name: 'Save Allocation' }).click()
  await expect(page.getByText('Manual batch allocation saved.')).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('8 shuttles logged')).toBeVisible()
  await expect(page.getByText(/86\.00/)).toBeVisible()
  await expect(page.getByRole('cell', { name: BATCH_BRANDS.manualPrimary, exact: true })).toBeVisible()
  await expect(page.getByRole('cell', { name: BATCH_BRANDS.manualSecondary, exact: true })).toBeVisible()
})

test('keeps automatic allocation behavior compatible after manual hardening', async ({ page }) => {
  await signInAs(page, 'Admin')
  await clearCheersGate(page)

  await page.goto('/finance')
  await clearCheersGate(page)
  await financeRow(page, SESSION_NAMES.auto).click()

  await expect(page.getByRole('button', { name: 'Auto', exact: true })).toBeVisible()
  await page.getByLabel('Total Shuttles Used').fill('14')
  await page.getByRole('button', { name: 'Save Usage' }).click()

  await expect(page.getByText('Shuttle usage saved.')).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('14 shuttles logged')).toBeVisible()
  await expect(page.getByText(/72\.00/)).toBeVisible()
  await expect(page.getByRole('cell', { name: BATCH_BRANDS.autoPrimary, exact: true })).toBeVisible()
  await expect(page.getByRole('cell', { name: BATCH_BRANDS.autoSecondary, exact: true })).toBeVisible()
})
