/**
 * E2E tests: Payment phone number & QR code on the session detail screen
 *
 * Verifies a registered, unpaid player sees the admin-configured payment
 * phone number (copyable) and QR code on their session detail screen, that
 * it disappears once marked Paid, that it's identical across sessions
 * (global config, FR-007), and that a non-admin cannot reach the settings
 * screen (FR-006, US2 AS3).
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

const TEST_PHONE = '0917 000 0000'
const TEST_QR_URL = 'https://placehold.co/300x300.png?text=Test+QR'

// ---------------------------------------------------------------------------
// Shared test state
// ---------------------------------------------------------------------------
let sessionAId: string
let sessionBId: string
let testPlayerId: string
let originalSettings: { phone_number: string | null; qr_code_url: string | null } | null

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

async function setRegistrationPaid(sessionId: string, playerId: string, paid: boolean | null) {
  await supabase.from('session_registrations').update({ paid }).eq('session_id', sessionId).eq('player_id', playerId)
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------
test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  const adminId = await getUserId('admin@test.local')
  testPlayerId = await getUserId('s1-alex@test.local')

  const { data: existing } = await supabase.from('payment_settings').select('phone_number, qr_code_url').eq('id', 1).maybeSingle()
  originalSettings = existing as { phone_number: string | null; qr_code_url: string | null } | null

  await supabase.from('payment_settings').update({ phone_number: TEST_PHONE, qr_code_url: TEST_QR_URL }).eq('id', 1)

  const { data: sessionA, error: sessionAError } = await supabase
    .from('sessions')
    .insert({ name: 'Payment Test — Session A', date: daysFromToday(5), status: 'registration_open', created_by: adminId })
    .select('id')
    .single()
  if (sessionAError) throw new Error(`Failed to create test session A: ${sessionAError.message}`)
  sessionAId = (sessionA as { id: string }).id

  const { data: sessionB, error: sessionBError } = await supabase
    .from('sessions')
    .insert({ name: 'Payment Test — Session B', date: daysFromToday(6), status: 'registration_open', created_by: adminId })
    .select('id')
    .single()
  if (sessionBError) throw new Error(`Failed to create test session B: ${sessionBError.message}`)
  sessionBId = (sessionB as { id: string }).id

  await supabase.from('session_registrations').insert([
    { session_id: sessionAId, player_id: testPlayerId, paid: false },
    { session_id: sessionBId, player_id: testPlayerId, paid: false },
  ])
})

test.afterAll(async () => {
  await supabase.from('sessions').delete().in('id', [sessionAId, sessionBId])
  if (originalSettings) {
    await supabase.from('payment_settings').update(originalSettings).eq('id', 1)
  }
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
test('registered, unpaid player sees the payment phone number and QR code, and can copy the number', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await signInAs(page, 'S1 Alex Tan')
  await page.goto(`/sessions/${sessionAId}`)
  await page.waitForLoadState('networkidle')

  await expect(page.getByText(TEST_PHONE)).toBeVisible({ timeout: 15000 })
  await expect(page.getByAltText('Payment QR code')).toBeVisible({ timeout: 15000 })

  await page.getByRole('button', { name: 'Copy' }).click()
  await expect(page.getByText('Phone number copied')).toBeVisible({ timeout: 5000 })
})

test('the same payment info appears identically on a second unpaid session (FR-007)', async ({ page }) => {
  await signInAs(page, 'S1 Alex Tan')
  await page.goto(`/sessions/${sessionBId}`)
  await page.waitForLoadState('networkidle')

  await expect(page.getByText(TEST_PHONE)).toBeVisible({ timeout: 15000 })
  await expect(page.getByAltText('Payment QR code')).toBeVisible({ timeout: 15000 })
})

test('payment info disappears once the registration is marked Paid', async ({ page }) => {
  await setRegistrationPaid(sessionAId, testPlayerId, true)

  await signInAs(page, 'S1 Alex Tan')
  await page.goto(`/sessions/${sessionAId}`)
  await page.waitForLoadState('networkidle')

  await expect(page.getByText("You're registered!")).toBeVisible({ timeout: 15000 })
  await expect(page.getByText(TEST_PHONE)).not.toBeVisible()

  await setRegistrationPaid(sessionAId, testPlayerId, false)
})

test('a non-admin cannot reach the payment settings screen (FR-006, US2 AS3)', async ({ page }) => {
  await signInAs(page, 'S1 Alex Tan')
  await page.goto('/payment-settings')
  await page.waitForLoadState('networkidle')

  await expect(page).not.toHaveURL(/\/payment-settings/)
})
