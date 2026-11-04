import { expect, test } from '@playwright/test'

const appConfig = {
  loginUrl: '/oauth2/sign_in',
  logoutUrl: '/oauth2/sign_out',
  userInfoUrl: '/oauth2/userinfo',
}

test.beforeEach(async ({ page }) => {
  await page.route(
    '**/.well-known/appspecific/de.bsi.secvisogram.json',
    (route) => route.fulfill({ json: appConfig }),
  )
  await page.route('**/oauth2/userinfo', (route) =>
    route.fulfill({ json: { groups: ['author'] } }),
  )
  await page.route('**/api/v1/advisories', (route) =>
    route.fulfill({ json: [] }),
  )
})

const dialogName = 'About CSAF CMS'

test('shows the app version, license and author guide while the backend version is loading', async ({
  page,
}) => {
  let releaseRequest!: () => void
  const gate = new Promise<void>((resolve) => {
    releaseRequest = resolve
  })
  await page.route('**/api/v1/about', async (route) => {
    await gate
    await route.fulfill({ json: { version: 'backend-1' } })
  })

  await page.goto('/')
  await page.getByTestId('about_button').click()

  const dialog = page.getByRole('dialog', { name: dialogName })
  await expect(dialog.getByText('Loading backend version…')).toBeVisible()
  const frontendVersion = dialog.getByRole('link', { name: 'development' })
  await expect(frontendVersion).toHaveAttribute(
    'href',
    'https://github.com/secvisogram/csaf-cms-frontend',
  )
  await expect(frontendVersion).not.toHaveAttribute('target', '_blank')
  await expect(
    dialog.getByRole('link', { name: 'Apache-2.0' }),
  ).toHaveAttribute(
    'href',
    'https://github.com/secvisogram/csaf-cms-frontend/blob/main/LICENSE',
  )
  const authorGuide = dialog.getByRole('link', { name: 'CSAF Author Guide' })
  await expect(authorGuide).toHaveAttribute(
    'href',
    'https://secvisogram.github.io/secvisogram-documentation/',
  )
  await expect(authorGuide).toHaveAttribute('target', '_blank')

  releaseRequest()
  await expect(dialog.getByRole('link', { name: 'backend-1' })).toHaveAttribute(
    'href',
    'https://github.com/secvisogram/csaf-cms-backend/',
  )
})

test('closes About with Escape while the request is in flight', async ({
  page,
}) => {
  await page.route('**/api/v1/about', () => new Promise(() => {}))

  await page.goto('/')
  await page.getByTestId('about_button').click()
  const dialog = page.getByRole('dialog', { name: dialogName })
  await expect(dialog.getByText('Loading backend version…')).toBeVisible()
  await page.keyboard.press('Escape')

  await expect(dialog).not.toBeVisible()
})

test('closes About with its close button', async ({ page }) => {
  await page.route('**/api/v1/about', (route) =>
    route.fulfill({ json: { version: 'backend-1' } }),
  )

  await page.goto('/')
  await page.getByTestId('about_button').click()
  const dialog = page.getByRole('dialog', { name: dialogName })
  await dialog.getByRole('button', { name: 'Close' }).click()

  await expect(dialog).not.toBeVisible()
})

// The dev server runs under React StrictMode, which mounts effects twice, so
// these tests assert on request ordering rather than exact request counts.
test('fetches the backend version afresh on each opening without stale data', async ({
  page,
}) => {
  let requests = 0
  let gated = false
  let releaseGate!: () => void
  const gate = new Promise<void>((resolve) => {
    releaseGate = resolve
  })
  await page.route('**/api/v1/about', async (route) => {
    requests += 1
    const requestNumber = requests
    if (gated) await gate
    await route.fulfill({ json: { version: `backend-${requestNumber}` } })
  })

  await page.goto('/')
  await page.getByTestId('about_button').click()
  const dialog = page.getByRole('dialog', { name: dialogName })
  const backendLink = dialog.getByRole('link', { name: /^backend-\d+$/ })
  await expect(backendLink).toBeVisible()
  const firstVersion = await backendLink.textContent()
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()

  gated = true
  await page.getByTestId('about_button').click()

  await expect(dialog.getByText('Loading backend version…')).toBeVisible()
  await expect(backendLink).toHaveCount(0)
  releaseGate()
  await expect(backendLink).toBeVisible()
  await expect(backendLink).not.toHaveText(firstVersion!)
})

test('does not re-request the backend version in the background', async ({
  page,
}) => {
  let requests = 0
  await page.route('**/api/v1/about', async (route) => {
    requests += 1
    await route.fulfill({ json: { version: 'backend' } })
  })

  await page.goto('/')
  await page.getByTestId('about_button').click()
  const dialog = page.getByRole('dialog', { name: dialogName })
  await expect(dialog.getByRole('link', { name: 'backend' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  const requestsWhileOpen = requests

  await page.getByTestId('dashboard_link').click()
  await page.getByRole('heading', { name: 'Advisory Dashboard' }).waitFor()

  expect(requests).toBe(requestsWhileOpen)
})

test('keeps About open and shows an inline error without a toast when loading fails', async ({
  page,
}) => {
  await page.route('**/api/v1/about', (route) =>
    route.fulfill({ status: 500, body: 'service unavailable' }),
  )

  await page.goto('/')
  await page.getByTestId('about_button').click()

  const dialog = page.getByRole('dialog', { name: dialogName })
  await expect(dialog).toBeVisible()
  await expect(
    dialog.getByText('The backend version could not be loaded.'),
  ).toBeVisible()
  await expect(dialog.getByText('development')).toBeVisible()
  await expect(page.locator('[popover]:popover-open')).toHaveCount(0)
})
