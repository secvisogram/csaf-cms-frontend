import { expect, test } from '@playwright/test'

const appConfig = {
  loginUrl: '/oauth2/sign_in',
  logoutUrl: '/oauth2/sign_out',
  userInfoUrl: '/oauth2/userinfo',
}

test('renders a configuration-unavailable page instead of the shell when the app-config cannot be loaded', async ({
  page,
}) => {
  await page.route(
    '**/.well-known/appspecific/de.bsi.secvisogram.json',
    (route) => route.fulfill({ status: 500 }),
  )

  await page.goto('/')

  await expect(
    page.getByRole('heading', { name: 'Configuration unavailable' }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Advisory Dashboard' }),
  ).not.toBeVisible()
})

test('renders a configuration-unavailable page when a required login URL is missing', async ({
  page,
}) => {
  await page.route(
    '**/.well-known/appspecific/de.bsi.secvisogram.json',
    (route) =>
      route.fulfill({ json: { ...appConfig, userInfoUrl: undefined } }),
  )

  await page.goto('/')

  await expect(
    page.getByRole('heading', { name: 'Configuration unavailable' }),
  ).toBeVisible()
})

test('fetches userinfo once from the configured userInfoUrl and renders the shell', async ({
  page,
}) => {
  let userInfoRequests = 0
  await page.route(
    '**/.well-known/appspecific/de.bsi.secvisogram.json',
    (route) => route.fulfill({ json: appConfig }),
  )
  await page.route('**/oauth2/userinfo', (route) => {
    userInfoRequests += 1
    return route.fulfill({ json: { groups: ['editor'] } })
  })
  await page.route('**/api/v1/advisories', (route) =>
    route.fulfill({ json: [] }),
  )

  await page.goto('/')

  await expect(
    page.getByRole('heading', { name: 'Advisory Dashboard' }),
  ).toBeVisible()
  expect(userInfoRequests).toBe(1)
})

test.describe('app shell header', () => {
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

  test('shows a Logout link to the configured logoutUrl that navigates there when clicked', async ({
    page,
  }) => {
    let signOutRequests = 0
    await page.route('**/oauth2/sign_out', (route) => {
      signOutRequests += 1
      return route.fulfill({
        contentType: 'text/html',
        body: '<html><body>Signed out</body></html>',
      })
    })

    await page.goto('/')
    const logout = page.getByTestId('logout_button')
    await expect(logout).toHaveText('Logout')
    await expect(logout).toHaveAttribute('href', appConfig.logoutUrl)

    await logout.click()

    await expect(page).toHaveURL(/\/oauth2\/sign_out$/)
    expect(signOutRequests).toBe(1)
  })

  test('shows distinct Dashboard, New and Logout controls', async ({
    page,
  }) => {
    await page.goto('/')

    await expect(page.getByTestId('dashboard_link')).toHaveText('Dashboard')
    await expect(page.getByTestId('new_document_button')).toHaveText('New')
    await expect(page.getByTestId('logout_button')).toBeVisible()
  })

  test('does not show Export or document validity controls', async ({
    page,
  }) => {
    await page.goto('/')
    await expect(
      page.getByRole('heading', { name: 'Advisory Dashboard' }),
    ).toBeVisible()

    await expect(page.getByRole('button', { name: 'Export' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Export' })).toHaveCount(0)
    await expect(page.getByText('Document is invalid')).toHaveCount(0)
    await expect(page.getByText('Document is valid')).toHaveCount(0)
  })
})
