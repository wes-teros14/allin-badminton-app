import { expect, test, type Page } from '@playwright/test'

/**
 * Browser coverage for leaderboard celebrations.
 *
 * Deliberately read-only with respect to the database. Producing a real
 * celebration would mean completing a session and mutating player_stats — the
 * counter tables this feature only ever reads. The detection rule is covered
 * exhaustively by src/__tests__/podiumCelebration.test.ts, and the storage rules
 * by src/__tests__/celebrationStorage.test.ts.
 *
 * What is asserted here is what only a browser can show: that the card appears
 * over whatever screen the player is on without navigating, that it leaves on its
 * own, and — the important one — that the row sweep plays on *both* routes to the
 * leaderboard. A prototype of this feature armed the sweep only when the toast was
 * ignored, so the main route silently never swept and looked perfectly fine.
 */

const PLAYER = 'Admin'
const STORAGE_PREFIX = 'badminton-celebration:'

async function openDevPanel(page: Page) {
  const devBtn = page.getByRole('button', { name: 'DEV' })
  await devBtn.waitFor({ state: 'visible', timeout: 5000 })
  await devBtn.click()
}

async function signInAs(page: Page, label: string) {
  await openDevPanel(page)
  await page.getByRole('button', { name: label, exact: true }).click()
  await expect(page.getByRole('link', { name: 'Leaderboard' })).toBeVisible({ timeout: 15000 })
}

/**
 * The player id the app stored state under, waiting for the first evaluation.
 *
 * Deliberately waits rather than returning null: the evaluation is asynchronous
 * (a sentinel query, then the board fetchers), and a test that skipped itself
 * when the state had not landed yet would report green while asserting nothing.
 * If no state appears, that is a real failure — the silent first run is supposed
 * to record exactly this.
 */
async function storedPlayerId(page: Page): Promise<string> {
  await page.waitForFunction(
    (prefix) => Object.keys(localStorage).some((k) => k.startsWith(prefix)),
    STORAGE_PREFIX,
    { timeout: 30000 },
  )
  return page.evaluate((prefix) => {
    const key = Object.keys(localStorage).find((k) => k.startsWith(prefix))!
    return key.slice(prefix.length)
  }, STORAGE_PREFIX)
}

async function armSweep(page: Page, playerId: string, board: string) {
  await page.evaluate(
    ({ prefix, id, board }) => {
      const key = prefix + id
      const state = JSON.parse(localStorage.getItem(key) ?? '{}')
      state.sweepOwed = { board, sentinel: state.sentinel ?? null }
      localStorage.setItem(key, JSON.stringify(state))
    },
    { prefix: STORAGE_PREFIX, id: playerId, board },
  )
}

const sweptRowCount = (page: Page) =>
  page.locator('[class*="animate-celebration-lift"]').count()

test('a celebration appears over the current screen and leaves on its own', async ({ page }) => {
  await page.goto('/sessions')
  await signInAs(page, PLAYER)

  await page.waitForFunction(() => typeof (window as unknown as Record<string, unknown>).__celebrate === 'function', { timeout: 15000 })
  await page.evaluate(() => (window as unknown as { __celebrate: (a: unknown[]) => void })
    .__celebrate([{ board: 'wins', kind: 'podium', rank: 2, previousRank: 5 }]))

  const card = page.getByRole('status')
  await expect(card).toBeVisible({ timeout: 5000 })
  await expect(card).toContainText('2nd place!')
  await expect(card).toContainText('Individual')

  // It must not have taken the player anywhere (FR-011, FR-012).
  expect(new URL(page.url()).pathname).toBe('/sessions')

  // And it must clear itself, with no dismiss action offered (FR-014).
  await expect(card).toBeHidden({ timeout: 10000 })
})

test('the owed sweep plays when the player reaches the board unprompted (FR-024)', async ({ page }) => {
  await page.goto('/sessions')
  await signInAs(page, PLAYER)

  const playerId = await storedPlayerId(page)
  await armSweep(page, playerId, 'wins')

  // Arriving by their own navigation, not by accepting an offer.
  await page.getByRole('link', { name: 'Leaderboard' }).click()
  await expect(page.getByText('All-time Leaderboard')).toBeVisible({ timeout: 15000 })

  await expect.poll(() => sweptRowCount(page), { timeout: 10000 }).toBeGreaterThan(0)

  // A sweep is a one-off; the debt must not survive to shimmer again.
  const debt = await page.evaluate((prefix) => {
    const key = Object.keys(localStorage).find((k) => k.startsWith(prefix))
    return key ? JSON.parse(localStorage.getItem(key)!).sweepOwed : 'no-state'
  }, STORAGE_PREFIX)
  expect(debt).toBeNull()
})

test('the owed sweep also plays when the player arrives by deep link (FR-024)', async ({ page }) => {
  await page.goto('/sessions')
  await signInAs(page, PLAYER)

  const playerId = await storedPlayerId(page)
  await armSweep(page, playerId, 'wins')

  // The route the toast's action takes.
  await page.goto('/leaderboard?tab=wins')
  await expect(page.getByText('All-time Leaderboard')).toBeVisible({ timeout: 15000 })

  await expect.poll(() => sweptRowCount(page), { timeout: 10000 }).toBeGreaterThan(0)
})

test('no sweep plays when nothing is owed', async ({ page }) => {
  await page.goto('/sessions')
  await signInAs(page, PLAYER)

  await page.goto('/leaderboard?tab=wins')
  await expect(page.getByText('All-time Leaderboard')).toBeVisible({ timeout: 15000 })
  await page.waitForTimeout(1500)

  expect(await sweptRowCount(page)).toBe(0)
})

test('a non-podium achievement gets the same card with the bunny and a plain border (US3)', async ({ page }) => {
  await page.goto('/sessions')
  await signInAs(page, PLAYER)
  await page.waitForFunction(() => typeof (window as unknown as Record<string, unknown>).__celebrate === 'function', { timeout: 15000 })

  await page.evaluate(() => (window as unknown as { __celebrate: (a: unknown[]) => void })
    .__celebrate([{ board: 'wins', kind: 'personal-best', rank: 6, previousRank: 9 }]))

  const card = page.getByRole('status')
  await expect(card).toBeVisible({ timeout: 5000 })
  await expect(card).toContainText('Your best yet!')
  await expect(card).toContainText('was 9th')

  // The bunny stands in for a medal, and the border stays the ordinary one.
  await expect(card.locator('img[src="/bunny-thumbsup.png"]')).toBeVisible()
  const borderWidth = await card.locator('div').first().evaluate(
    (el) => getComputedStyle(el).borderTopWidth,
  )
  expect(parseFloat(borderWidth)).toBeLessThan(2)
})

test('several achievements at once produce one card listing them all (US4)', async ({ page }) => {
  await page.goto('/sessions')
  await signInAs(page, PLAYER)
  await page.waitForFunction(() => typeof (window as unknown as Record<string, unknown>).__celebrate === 'function', { timeout: 15000 })

  await page.evaluate(() => (window as unknown as { __celebrate: (a: unknown[]) => void })
    .__celebrate([
      { board: 'pairs', kind: 'podium', rank: 1, previousRank: null },
      { board: 'wins', kind: 'personal-best', rank: 6, previousRank: 9 },
      { board: 'cheers:good_sport', kind: 'personal-best', rank: 4, previousRank: 7 },
    ]))

  // Exactly one card, never a queue of three.
  const cards = page.getByRole('status')
  await expect(cards).toHaveCount(1, { timeout: 5000 })
  await expect(cards).toContainText('3 to celebrate!')
  await expect(cards).toContainText('Partners')
  await expect(cards).toContainText('Individual')
  await expect(cards).toContainText('Good Sport')

  // It takes the best placing's medal edge, matching what the toast will name.
  const borderWidth = await cards.locator('div').first().evaluate(
    (el) => getComputedStyle(el).borderTopWidth,
  )
  expect(parseFloat(borderWidth)).toBeGreaterThan(2)
})
