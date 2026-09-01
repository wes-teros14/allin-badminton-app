import { expect, test, type Page } from '@playwright/test'

/**
 * Browser coverage for the partnership (Tambalan) tab on the All-time Leaderboard.
 *
 * Deliberately read-only. Seeding six games for a pair would mean inserting
 * match_results, and that fires the on_match_result_insert trigger — writing to
 * player_stats and player_pair_stats, the exact counter tables this feature
 * promised not to touch (FR-023). The counting rules are covered instead by the
 * 22 unit tests in src/__tests__/pairStats.test.ts, and the against-reality check
 * is the manual spot-check in the feature's quickstart.
 *
 * What is asserted here is what only a browser can show: the tab exists, it is
 * reachable by deep link, the existing tabs still work, and the board renders
 * either a ranked list or its explanatory empty state — never a broken one.
 */

const PAIRS_TAB = 'Tambalan'

async function openDevPanel(page: Page) {
  const devBtn = page.getByRole('button', { name: 'DEV' })
  await devBtn.waitFor({ state: 'visible', timeout: 5000 })
  await devBtn.click()
}

async function signInAs(page: Page, label: string) {
  await openDevPanel(page)
  await page.getByRole('button', { name: label, exact: true }).click()
  await page.waitForFunction(
    () => !document.querySelector('.fixed.bottom-4 [class*="space-y-3"] button:not([class*="rounded-full"])'),
    { timeout: 10000 },
  )
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

/** The board has loaded when its skeleton is gone — a list or the empty state stands. */
async function waitForBoard(page: Page) {
  await expect(page.getByRole('heading', { name: 'All-time Leaderboard' })).toBeVisible({ timeout: 15000 })
  await expect(page.locator('.animate-pulse')).toHaveCount(0, { timeout: 15000 })
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await signInAs(page, 'Admin')
})

test.afterEach(async ({ page }) => {
  try {
    await ensureSignedOut(page)
  } catch {
    // Best-effort teardown, so it cannot mask the real failure.
  }
})

test('the partnership tab exists alongside the three existing tabs (FR-001)', async ({ page }) => {
  await page.goto('/leaderboard')
  await waitForBoard(page)

  await expect(page.getByRole('button', { name: 'Mga Lodi' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Cheers' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Awards' })).toBeVisible()
  await expect(page.getByRole('button', { name: PAIRS_TAB })).toBeVisible()
})

test('the partnership board renders a ranked list or its empty state, never a broken one (FR-022)', async ({ page }) => {
  await page.goto('/leaderboard')
  await waitForBoard(page)
  await page.getByRole('button', { name: PAIRS_TAB }).click()
  await expect(page.locator('.animate-pulse')).toHaveCount(0, { timeout: 15000 })

  const caption = page.getByText(/Ranked by win rate/)
  const emptyState = page.getByText(/No partnership has reached/)

  await expect(caption.or(emptyState).first()).toBeVisible({ timeout: 15000 })

  // When pairs qualify, the caption must state BOTH eligibility rules (FR-021).
  if (await caption.isVisible()) {
    await expect(caption).toContainText('games together')
    await expect(caption).toContainText('active in the last')

    // Every rendered row carries a win rate and a W/L record (FR-018).
    await expect(page.getByText(/^\d+W \d+L$/).first()).toBeVisible()
  }
})

test('a deep link opens the partnership tab directly (FR-002)', async ({ page }) => {
  await page.goto('/leaderboard?tab=pairs')
  await waitForBoard(page)

  const caption = page.getByText(/Ranked by win rate/)
  const emptyState = page.getByText(/No partnership has reached/)
  await expect(caption.or(emptyState).first()).toBeVisible({ timeout: 15000 })
})

test('deep links to the existing tabs are unaffected (FR-003)', async ({ page }) => {
  await page.goto('/leaderboard?tab=cheers')
  await waitForBoard(page)
  await expect(page.getByText(/No partnership has reached/)).toBeHidden()

  await page.goto('/leaderboard')
  await waitForBoard(page)

  // No tab named: still the default wins board. Assert on the wins board's own
  // two possible states rather than on it having data, so the check holds on any
  // dataset — and assert the pair board is NOT what rendered.
  const winsCaption = page.getByText(/min\. 3 sessions played/)
  const winsEmpty = page.getByText('No stats recorded yet.')
  await expect(winsCaption.or(winsEmpty).first()).toBeVisible({ timeout: 15000 })
  await expect(page.getByText(/games together/)).toBeHidden()
})
