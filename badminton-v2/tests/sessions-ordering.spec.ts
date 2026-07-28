/**
 * E2E tests: Session card ordering on /sessions
 *
 * Verifies active/upcoming session cards render soonest-first (ascending by
 * scheduled date), and that registering for a new, sooner-dated session
 * moves it to the top on next load.
 *
 * Prerequisites:
 *   - Dev server running (playwright starts it via webServer config)
 *   - Seed data applied: npm run seed -- --sessions 2
 *   - .env has VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 */

import { test, expect, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Load .env into process.env (Playwright workers don't inherit from config)
try {
  const raw = readFileSync(resolve(process.cwd(), '.env'), 'utf-8')
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    const key = trimmed.slice(0, idx).trim()
    const val = trimmed.slice(idx + 1).trim()
    if (!process.env[key]) process.env[key] = val
  }
} catch { /* rely on actual env vars */ }

// ---------------------------------------------------------------------------
// Supabase admin client (service role — bypasses RLS for test setup)
// ---------------------------------------------------------------------------
const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// ---------------------------------------------------------------------------
// Shared test state
// ---------------------------------------------------------------------------
let farSessionId: string
let nearSessionId: string
let testPlayerId: string

function daysFromToday(offset: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.toISOString().slice(0, 10)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function getUserId(email: string): Promise<string> {
  const { data } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  const user = data?.users?.find((u) => u.email === email)
  if (!user) throw new Error(`Test user not found: ${email}. Run: npm run seed -- --sessions 2`)
  return user.id
}

async function signInAs(page: Page, label: string) {
  const devBtn = page.getByRole('button', { name: 'DEV' })
  await devBtn.waitFor({ state: 'visible', timeout: 5000 })
  await devBtn.click()
  await page.getByRole('button', { name: label, exact: true }).click()
  await page.waitForFunction(() => !document.querySelector('.fixed.bottom-4 [class*="space-y-3"] button:not([class*="rounded-full"])'), { timeout: 10000 })
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

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------
test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  const adminId = await getUserId('admin@test.local')
  testPlayerId = await getUserId('s1-alex@test.local')

  const { data: far, error: farError } = await supabase
    .from('sessions')
    .insert({ name: 'Ordering Test — Far Session', date: daysFromToday(10), status: 'registration_open', created_by: adminId })
    .select('id')
    .single()
  if (farError) throw new Error(`Failed to create far test session: ${farError.message}`)
  farSessionId = (far as { id: string }).id

  const { data: near, error: nearError } = await supabase
    .from('sessions')
    .insert({ name: 'Ordering Test — Near Session', date: daysFromToday(3), status: 'registration_open', created_by: adminId })
    .select('id')
    .single()
  if (nearError) throw new Error(`Failed to create near test session: ${nearError.message}`)
  nearSessionId = (near as { id: string }).id

  await supabase.from('session_registrations').insert([
    { session_id: farSessionId, player_id: testPlayerId },
    { session_id: nearSessionId, player_id: testPlayerId },
  ])
})

test.afterAll(async () => {
  await supabase.from('sessions').delete().in('id', [farSessionId, nearSessionId])
})

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await ensureSignedOut(page)
})

test.afterEach(async ({ page }) => {
  try { await ensureSignedOut(page) } catch { /* ignore */ }
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
test('soonest scheduled session appears above a later one', async ({ page }) => {
  await signInAs(page, 'S1 Alex Tan')
  await page.goto('/sessions')
  await page.waitForLoadState('networkidle')

  const nearCard = page.getByText('Ordering Test — Near Session')
  const farCard = page.getByText('Ordering Test — Far Session')
  await expect(nearCard).toBeVisible({ timeout: 15000 })
  await expect(farCard).toBeVisible({ timeout: 15000 })

  const nearBox = await nearCard.boundingBox()
  const farBox = await farCard.boundingBox()
  expect(nearBox).not.toBeNull()
  expect(farBox).not.toBeNull()
  expect(nearBox!.y).toBeLessThan(farBox!.y)
})

test('registering for a new, sooner session moves it to the top', async ({ page }) => {
  const { data: soonest, error } = await supabase
    .from('sessions')
    .insert({ name: 'Ordering Test — Soonest Session', date: daysFromToday(1), status: 'registration_open', created_by: testPlayerId })
    .select('id')
    .single()
  if (error) throw new Error(`Failed to create soonest test session: ${error.message}`)
  const soonestId = (soonest as { id: string }).id

  try {
    await supabase.from('session_registrations').insert({ session_id: soonestId, player_id: testPlayerId })

    await signInAs(page, 'S1 Alex Tan')
    await page.goto('/sessions')
    await page.waitForLoadState('networkidle')

    const soonestCard = page.getByText('Ordering Test — Soonest Session')
    const nearCard = page.getByText('Ordering Test — Near Session')
    await expect(soonestCard).toBeVisible({ timeout: 15000 })
    await expect(nearCard).toBeVisible({ timeout: 15000 })

    const soonestBox = await soonestCard.boundingBox()
    const nearBox = await nearCard.boundingBox()
    expect(soonestBox).not.toBeNull()
    expect(nearBox).not.toBeNull()
    expect(soonestBox!.y).toBeLessThan(nearBox!.y)
  } finally {
    await supabase.from('sessions').delete().eq('id', soonestId)
  }
})
