/**
 * E2E tests: Registration limit enforcement
 *
 * Tests that the player limit on a session invitation is enforced correctly —
 * both via the client-side pre-check and the DB-level trigger (migration 020).
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
// Shared test state (serial mode keeps these safe)
// ---------------------------------------------------------------------------
let testSessionId: string
let invitationToken: string

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function getUserId(email: string): Promise<string> {
  const { data } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  const user = data?.users?.find((u) => u.email === email)
  if (!user) throw new Error(`Test user not found: ${email}. Run: npm run seed -- --sessions 2`)
  return user.id
}

async function registerUserDirectly(email: string) {
  const userId = await getUserId(email)
  const { error } = await supabase
    .from('session_registrations')
    .upsert({ session_id: testSessionId, player_id: userId }, { onConflict: 'session_id,player_id' })
  if (error) throw new Error(`Direct register failed for ${email}: ${error.message}`)
}

async function clearRegistrations() {
  await supabase.from('session_registrations').delete().eq('session_id', testSessionId)
}

async function setLimit(limit: number | null) {
  await supabase
    .from('session_invitations')
    .update({ max_players: limit })
    .eq('id', invitationToken)
}

async function signInAs(page: Page, label: string) {
  const devBtn = page.getByRole('button', { name: 'DEV' })
  await devBtn.waitFor({ state: 'visible', timeout: 5000 })
  await devBtn.click()
  await page.getByRole('button', { name: label, exact: true }).click()
  // Panel closes automatically on successful auth — wait for it
  await page.waitForFunction(() => !document.querySelector('.fixed.bottom-4 [class*="space-y-3"] button:not([class*="rounded-full"])'), { timeout: 10000 })
  // Let auth state propagate
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
    // Not signed in — close the panel
    await devBtn.click()
  }
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------
test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  const adminId = await getUserId('admin@test.local')
  const today = new Date().toISOString().slice(0, 10)

  // Create a dedicated test session
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .insert({ name: 'Registration Limit Test Session', date: today, status: 'registration_open', created_by: adminId })
    .select('id')
    .single()
  if (sessionError) throw new Error(`Failed to create test session: ${sessionError.message}`)
  testSessionId = (session as { id: string }).id

  // Create an active invitation
  const { data: inv, error: invError } = await supabase
    .from('session_invitations')
    .insert({ session_id: testSessionId, is_active: true })
    .select('id')
    .single()
  if (invError) throw new Error(`Failed to create invitation: ${invError.message}`)
  invitationToken = (inv as { id: string }).id
})

test.afterAll(async () => {
  await supabase.from('sessions').delete().eq('id', testSessionId)
})

test.beforeEach(async ({ page }) => {
  await clearRegistrations()
  await setLimit(null)
  await page.goto('/')
  await ensureSignedOut(page)
})

test.afterEach(async ({ page }) => {
  try { await ensureSignedOut(page) } catch { /* ignore */ }
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
test('registers successfully when no limit is set', async ({ page }) => {
  await signInAs(page, 'S1 Alex Tan')
  await page.goto(`/register?token=${invitationToken}`)
  await page.waitForLoadState('networkidle')

  await expect(page.getByText("You're registered!")).toBeVisible({ timeout: 15000 })
})

test('registers successfully when under the limit', async ({ page }) => {
  await setLimit(5)

  await signInAs(page, 'S1 Jamie Lee')
  await page.goto(`/register?token=${invitationToken}`)
  await page.waitForLoadState('networkidle')

  await expect(page.getByText("You're registered!")).toBeVisible({ timeout: 15000 })
})

test('shows Session Full when limit is reached', async ({ page }) => {
  await setLimit(1)
  await registerUserDirectly('s1-alex@test.local') // fills the 1 slot

  await signInAs(page, 'S1 Jamie Lee')
  await page.goto(`/register?token=${invitationToken}`)
  await page.waitForLoadState('networkidle')

  await expect(page.getByText('Session Full')).toBeVisible({ timeout: 15000 })
  await expect(page.getByText('Registration is full')).toBeVisible()
})

test('already-registered user sees registered screen even when session is full', async ({ page }) => {
  await setLimit(1)
  await registerUserDirectly('s1-alex@test.local') // fills the 1 slot (alex is already registered)

  await signInAs(page, 'S1 Alex Tan') // same user who is registered
  await page.goto(`/register?token=${invitationToken}`)
  await page.waitForLoadState('networkidle')

  // Should see "You're registered!" — not "Session Full"
  await expect(page.getByText("You're registered!")).toBeVisible({ timeout: 15000 })
})

test('DB trigger blocks registration when limit is reached simultaneously', async ({ page }) => {
  await setLimit(1)
  await registerUserDirectly('s1-alex@test.local') // fills the 1 slot at DB level

  await signInAs(page, 'S1 Sam Wong')

  // Directly hit the DB (simulating the race condition scenario where
  // the client-side check passed but the DB trigger fires on insert)
  const samId = await getUserId('s1-sam@test.local')
  const { error } = await supabase
    .from('session_registrations')
    .insert({ session_id: testSessionId, player_id: samId })

  expect(error).not.toBeNull()
  expect(error!.message).toContain('session_full')
})
