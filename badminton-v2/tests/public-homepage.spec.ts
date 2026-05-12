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

async function signInAs(page: Page, label: string) {
  await openDevPanel(page)
  await page.getByRole('button', { name: label, exact: true }).click()
  await page.waitForFunction(
    () => !document.querySelector('.fixed.bottom-4 [class*="space-y-3"] button:not([class*="rounded-full"])'),
    { timeout: 10000 },
  )
  await expect(page.getByRole('heading', { name: 'Welcome back!' })).toBeVisible({ timeout: 15000 })
}

test.afterEach(async ({ page }) => {
  try {
    await ensureSignedOut(page)
  } catch {
    // Keep teardown best-effort so a navigation-away assertion does not hide the real failure.
  }
})

test('signed-out visitors see a public homepage with a register action and no form', async ({ page }) => {
  await page.goto('/')
  await ensureSignedOut(page)

  await expect(page.getByRole('heading', { name: 'Badminton Gang' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Register for upcoming games' })).toBeVisible()
  await expect(page.getByText('Join the group, see available sessions')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Register with Google' })).toBeVisible()
  await expect(page.locator('form')).toHaveCount(0)
  await expect(page.getByRole('textbox')).toHaveCount(0)
})

test('register action starts existing Google OAuth for the root homepage', async ({ page }) => {
  let authorizeUrl: string | null = null

  await page.route('**/auth/v1/authorize**', async (route) => {
    authorizeUrl = route.request().url()
    await route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><title>OAuth intercepted</title><p>OAuth intercepted</p>',
    })
  })

  await page.goto('/')
  await ensureSignedOut(page)
  const appOrigin = new URL(page.url()).origin
  await page.getByRole('button', { name: 'Register with Google' }).click()
  await expect(page.getByText('OAuth intercepted')).toBeVisible({ timeout: 10000 })

  expect(authorizeUrl).not.toBeNull()
  const parsed = new URL(authorizeUrl!)
  expect(parsed.pathname).toContain('/auth/v1/authorize')
  expect(parsed.searchParams.get('provider')).toBe('google')
  expect(parsed.searchParams.get('redirect_to')).toBe(`${appOrigin}/`)
})

test('signed-in players still see the authenticated homepage', async ({ page }) => {
  await page.goto('/')
  await ensureSignedOut(page)
  await signInAs(page, 'S1 Alex Tan')

  await expect(page.getByRole('heading', { name: 'Welcome back!' })).toBeVisible()
  await expect(page.getByText('Check Sessions to register and see your schedule.')).toBeVisible()
  await expect(page.getByText('Notice Board')).toBeVisible()
})

test('invite registration route remains reachable without a token', async ({ page }) => {
  await page.goto('/register')

  await expect(page.getByText('Registration Closed')).toBeVisible()
  await expect(page.getByText('Registration is closed. Contact the admin.')).toBeVisible()
})
