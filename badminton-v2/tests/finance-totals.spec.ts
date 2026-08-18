import { expect, test, type Page } from '@playwright/test'

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

async function signInAsAdmin(page: Page) {
  await openDevPanel(page)
  await page.getByRole('button', { name: 'Admin', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Welcome back!' })).toBeVisible({ timeout: 15000 })
}

/** Parses "₱1,234.56" / "-₱1,234.56" into a number. */
function parsePeso(text: string): number {
  const negative = text.trim().startsWith('-')
  const digits = text.replace(/[^\d.]/g, '')
  const value = Number(digits)
  return negative ? -value : value
}

test.afterEach(async ({ page }) => {
  try {
    await ensureSignedOut(page)
  } catch {
    // Best-effort teardown so it never masks the real failure.
  }
})

test('finance page shows All Sessions and Completed totals level with the heading', async ({ page }) => {
  await page.goto('/')
  await signInAsAdmin(page)
  await page.goto('/finance')

  await expect(page.getByRole('heading', { name: 'Finance' })).toBeVisible()
  await expect(page.getByText('All Sessions', { exact: true })).toBeVisible({ timeout: 15000 })
  await expect(page.getByText('Completed', { exact: true })).toBeVisible()

  // Both totals render a peso amount once loading settles (SC-001).
  const allSessionsValue = page.getByText('All Sessions', { exact: true }).locator('~ p')
  const completedValue = page.getByText('Completed', { exact: true }).locator('~ p')

  await expect(allSessionsValue).toHaveText(/₱/, { timeout: 15000 })
  await expect(completedValue).toHaveText(/₱/)
})

test('all-sessions total equals the sum of the Net Cash column (SC-002)', async ({ page }) => {
  await page.goto('/')
  await signInAsAdmin(page)
  await page.goto('/finance')

  await expect(page.getByText('All Sessions', { exact: true })).toBeVisible({ timeout: 15000 })

  const rows = page.locator('tbody tr')
  const rowCount = await rows.count()
  test.skip(rowCount === 0, 'No finance rows seeded — nothing to reconcile against.')

  let sum = 0
  for (let i = 0; i < rowCount; i++) {
    // Net Cash is the fifth and last cell in each row.
    const netCash = await rows.nth(i).locator('td').nth(4).innerText()
    sum += parsePeso(netCash)
  }

  const headerTotal = await page
    .getByText('All Sessions', { exact: true })
    .locator('~ p')
    .innerText()

  expect(parsePeso(headerTotal)).toBeCloseTo(Number(sum.toFixed(2)), 2)
})

test('completed total never exceeds the all-sessions total when results are positive', async ({ page }) => {
  await page.goto('/')
  await signInAsAdmin(page)
  await page.goto('/finance')

  await expect(page.getByText('All Sessions', { exact: true })).toBeVisible({ timeout: 15000 })

  const all = parsePeso(
    await page.getByText('All Sessions', { exact: true }).locator('~ p').innerText(),
  )
  const completed = parsePeso(
    await page.getByText('Completed', { exact: true }).locator('~ p').innerText(),
  )

  if (all >= 0 && completed >= 0) {
    expect(completed).toBeLessThanOrEqual(all)
  }
})
