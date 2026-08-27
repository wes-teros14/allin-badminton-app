/**
 * E2E tests: Payment receipt upload & admin receipt review
 *
 * Covers the full loop — a registered, unpaid player attaches a receipt with a
 * note from their session card, the admin sees a per-player link in the payment
 * panel, opens it, and confirms payment.
 *
 * Also pins the three assertions that a happy-path test would otherwise skip:
 *   - the receipt SURVIVES confirmation (FR-032 — nothing purges it)
 *   - the player card and admin panel agree in all three states (SC-007)
 *   - removing a player deletes their receipt IMAGES, not just the rows
 *     (FR-030 — the cascade drops the rows silently, so the bucket is the
 *     only place this regression is visible)
 *
 * Prerequisites:
 *   - Dev server running (playwright starts it via webServer config)
 *   - Seed data applied: npm run seed -- --sessions 2
 *   - Migrations 075-077 applied to the dev project
 *   - .env has VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 */

import { test, expect, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Load env into process.env (Playwright workers don't inherit from config).
// `.env` first, then `.env.development` — on some machines `.env` is empty and
// the credentials live only in `.env.development`, which would otherwise fail
// at createClient with a bare "supabaseUrl is required".
for (const file of ['.env', '.env.development']) {
  try {
    const raw = readFileSync(resolve(process.cwd(), file), 'utf-8')
    for (const line of raw.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const idx = trimmed.indexOf('=')
      if (idx === -1) continue
      const key = trimmed.slice(0, idx).trim()
      const val = trimmed.slice(idx + 1).trim()
      if (!process.env[key]) process.env[key] = val
    }
  } catch { /* try the next file / rely on actual env vars */ }
}

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const TEST_PHONE = '0917 000 0000'
const TEST_QR_URL = 'https://placehold.co/300x300.png?text=Test+QR'
const TEST_NOTE = 'partial 200, ref 8842'

let sessionId: string
let testPlayerId: string
let originalSettings: { phone_number: string | null; qr_code_url: string | null } | null

/** A tiny valid PNG, so the client-side resize has something real to work on. */
const ONE_PX_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

function daysFromToday(offset: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.toISOString().slice(0, 10)
}

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

async function setRegistrationPaid(paid: boolean) {
  await supabase.from('session_registrations').update({ paid }).eq('session_id', sessionId).eq('player_id', testPlayerId)
}

async function receiptRows() {
  const { data } = await supabase
    .from('session_receipts')
    .select('id, storage_path, note, dismissed_at')
    .eq('session_id', sessionId)
    .eq('player_id', testPlayerId)
  return (data ?? []) as Array<{ id: string; storage_path: string; note: string | null; dismissed_at: string | null }>
}

/** Does the object actually exist in the private bucket? */
async function objectExists(storagePath: string): Promise<boolean> {
  const slash = storagePath.lastIndexOf('/')
  const dir = storagePath.slice(0, slash)
  const file = storagePath.slice(slash + 1)
  const { data } = await supabase.storage.from('receipts').list(dir)
  return (data ?? []).some((o) => o.name === file)
}

/**
 * Attach an image through the dialog and submit with a note.
 *
 * Waits on the dialog CLOSING, not on the "awaiting confirmation" banner text:
 * once one receipt exists that text is already on screen, so asserting it would
 * pass instantly and let the test race ahead of the upload. The dialog closes
 * only when uploadReceipt resolves true, which makes it the honest signal.
 */
async function attachReceipt(page: Page, note: string, buttonName: RegExp) {
  await page.getByRole('button', { name: buttonName }).click()
  await page.setInputFiles('input[type="file"]', {
    name: 'receipt.png', mimeType: 'image/png', buffer: ONE_PX_PNG,
  })
  if (note) await page.getByLabel('Note (optional)').fill(note)
  await page.getByRole('button', { name: 'Submit receipt' }).click()
  await expect(page.getByRole('button', { name: 'Submit receipt' })).toBeHidden({ timeout: 30000 })
  // The note is unique per receipt, so this confirms THIS upload landed.
  if (note) await expect(page.getByText(note).first()).toBeVisible({ timeout: 15000 })
}

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  const adminId = await getUserId('admin@test.local')
  testPlayerId = await getUserId('s1-alex@test.local')

  const { data: existing } = await supabase.from('payment_settings').select('phone_number, qr_code_url').eq('id', 1).maybeSingle()
  originalSettings = existing as { phone_number: string | null; qr_code_url: string | null } | null
  await supabase.from('payment_settings').update({ phone_number: TEST_PHONE, qr_code_url: TEST_QR_URL }).eq('id', 1)

  const { data: session, error } = await supabase
    .from('sessions')
    .insert({ name: 'Receipt Test — Session', date: daysFromToday(5), status: 'registration_open', created_by: adminId })
    .select('id')
    .single()
  if (error) throw new Error(`Failed to create test session: ${error.message}`)
  sessionId = (session as { id: string }).id

  await supabase.from('session_registrations').insert([
    { session_id: sessionId, player_id: testPlayerId, paid: false },
  ])
})

test.afterAll(async () => {
  const paths = (await receiptRows()).map((r) => r.storage_path)
  if (paths.length > 0) await supabase.storage.from('receipts').remove(paths)
  await supabase.from('sessions').delete().eq('id', sessionId)
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
// US1 — player attaches a receipt with a note
// ---------------------------------------------------------------------------
test('a registered, unpaid player attaches a receipt with a note and sees the awaiting-confirmation state', async ({ page }) => {
  await signInAs(page, 'S1 Alex Tan')
  await page.goto(`/sessions/${sessionId}`)
  await page.waitForLoadState('networkidle')

  // Upload action lives inside the existing GCash banner
  await expect(page.getByText(TEST_PHONE)).toBeVisible({ timeout: 15000 })
  await attachReceipt(page, TEST_NOTE, /Add receipt \+ note/)

  await expect(page.getByText(TEST_NOTE)).toBeVisible({ timeout: 10000 })

  const rows = await receiptRows()
  expect(rows).toHaveLength(1)
  expect(rows[0].note).toBe(TEST_NOTE)
  expect(await objectExists(rows[0].storage_path)).toBe(true)

  // Survives a reload
  await page.reload()
  await page.waitForLoadState('networkidle')
  await expect(page.getByText('Receipt submitted — awaiting confirmation').first()).toBeVisible({ timeout: 15000 })
  await expect(page.getByText(TEST_NOTE)).toBeVisible()
})

test('the sessions list shows the same awaiting-confirmation state as the session card (SC-007)', async ({ page }) => {
  await signInAs(page, 'S1 Alex Tan')
  await page.goto('/sessions')
  await page.waitForLoadState('networkidle')

  await expect(page.getByText('Payment: Awaiting confirmation').first()).toBeVisible({ timeout: 15000 })
})

// ---------------------------------------------------------------------------
// US3 — player manages their own receipts
// ---------------------------------------------------------------------------
test('a player can add a second receipt, each with its own note', async ({ page }) => {
  await signInAs(page, 'S1 Alex Tan')
  await page.goto(`/sessions/${sessionId}`)
  await page.waitForLoadState('networkidle')

  await attachReceipt(page, 'balance 150', /Add another receipt/)

  const rows = await receiptRows()
  expect(rows).toHaveLength(2)
  expect(rows.map((r) => r.note).sort()).toEqual(['balance 150', TEST_NOTE].sort())
})

test('a player can remove their own receipt while unconfirmed, and the image goes with it', async ({ page }) => {
  const before = await receiptRows()
  const target = before[0]

  await signInAs(page, 'S1 Alex Tan')
  await page.goto(`/sessions/${sessionId}`)
  await page.waitForLoadState('networkidle')

  await page.getByRole('button', { name: 'Remove receipt' }).first().click()
  await expect(page.getByText('Receipt removed')).toBeVisible({ timeout: 10000 })

  const after = await receiptRows()
  expect(after.length).toBe(before.length - 1)
  // The image must be gone too, not just the row (FR-030)
  const removed = before.find((r) => !after.some((a) => a.id === r.id)) ?? target
  expect(await objectExists(removed.storage_path)).toBe(false)
})

// ---------------------------------------------------------------------------
// US2 — admin reviews and confirms
// ---------------------------------------------------------------------------
test('the admin sees a per-player receipt link, opens it, and confirms payment', async ({ page }) => {
  await signInAs(page, 'Admin')
  await page.goto(`/finance/${sessionId}`)
  await page.waitForLoadState('networkidle')

  // Open the Payment Status panel
  await page.getByText(/Payment Status —/).click()

  // Header tallies all three states, not just paid/unpaid (FR-025)
  await expect(page.getByText(/awaiting/)).toBeVisible({ timeout: 15000 })

  // Per-player link, labelled with the count (FR-022)
  const receiptLink = page.getByRole('button', { name: /receipt/ }).first()
  await expect(receiptLink).toBeVisible({ timeout: 10000 })
  await receiptLink.click()

  // Viewer shows the note (FR-023)
  await expect(page.getByText(TEST_NOTE)).toBeVisible({ timeout: 15000 })
  // .first() — the dialog primitive also exposes a built-in "Close" control
  await page.getByRole('button', { name: 'Close' }).first().click()

  // Explicit confirm is the only way to green (FR-018)
  await page.getByRole('button', { name: 'Confirm', exact: true }).first().click()
  await expect(page.getByRole('button', { name: 'Paid', exact: true }).first()).toBeVisible({ timeout: 10000 })

  const { data } = await supabase
    .from('session_registrations')
    .select('paid')
    .eq('session_id', sessionId)
    .eq('player_id', testPlayerId)
    .maybeSingle()
  expect((data as { paid: boolean }).paid).toBe(true)
})

test('confirming payment does NOT purge the receipt — it stays as the audit trail (FR-032)', async () => {
  const rows = await receiptRows()
  expect(rows.length).toBeGreaterThan(0)
  expect(await objectExists(rows[0].storage_path)).toBe(true)
})

test('a confirmed player sees no payment banner and no upload control', async ({ page }) => {
  await signInAs(page, 'S1 Alex Tan')
  await page.goto(`/sessions/${sessionId}`)
  await page.waitForLoadState('networkidle')

  await expect(page.getByText(TEST_PHONE)).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Add receipt \+ note|Add another receipt/ })).toHaveCount(0)
})

test('the sessions list agrees with the session card once confirmed (SC-007)', async ({ page }) => {
  await signInAs(page, 'S1 Alex Tan')
  await page.goto('/sessions')
  await page.waitForLoadState('networkidle')

  await expect(page.getByText('Payment: Paid').first()).toBeVisible({ timeout: 15000 })
  await expect(page.getByText('Payment: Awaiting confirmation')).toHaveCount(0)
})

// ---------------------------------------------------------------------------
// FR-030 — the silent one
// ---------------------------------------------------------------------------
test('removing a player from the roster deletes their receipt IMAGES, not just the rows (FR-030)', async ({ page }) => {
  // Reset to unconfirmed so a fresh receipt can be attached
  await setRegistrationPaid(false)

  await signInAs(page, 'S1 Alex Tan')
  await page.goto(`/sessions/${sessionId}`)
  await page.waitForLoadState('networkidle')
  await attachReceipt(page, 'to be orphaned', /Add receipt \+ note|Add another receipt/)

  const paths = (await receiptRows()).map((r) => r.storage_path)
  expect(paths.length).toBeGreaterThan(0)
  for (const p of paths) expect(await objectExists(p)).toBe(true)

  await ensureSignedOut(page)

  // SessionView only renders the editable Roster panel for a registration_open
  // session when a session_invitations row exists (SessionView.tsx:511); the
  // registration_closed branch (SessionView.tsx:530) has no such dependency and
  // exercises the same removePlayer path.
  await supabase.from('sessions').update({ status: 'registration_closed' }).eq('id', sessionId)

  // Reload before switching user — signing out mid-test leaves the DEV panel in
  // a different open/closed state than a fresh load, and signInAs assumes fresh.
  await page.goto('/')
  await signInAs(page, 'Admin')
  await page.goto(`/session/${sessionId}`)
  await page.waitForLoadState('networkidle')

  // Roster ✕ then ✕ again to confirm
  await page.getByText(/^Roster \(/).click()
  const removeBtn = page.getByRole('button', { name: '✕' }).first()
  await removeBtn.click()
  await page.getByRole('button', { name: 'Sure?' }).click()
  await page.waitForTimeout(2000)

  // Rows cascade away — that part always worked and proves nothing
  expect(await receiptRows()).toHaveLength(0)

  // This is the actual assertion: the images must be gone from the bucket too.
  // Without the cleanup in useRoster.removePlayer they linger forever,
  // unreachable and undeletable, with no error anywhere.
  for (const p of paths) {
    expect(await objectExists(p), `orphaned receipt image left in bucket: ${p}`).toBe(false)
  }
})
