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
