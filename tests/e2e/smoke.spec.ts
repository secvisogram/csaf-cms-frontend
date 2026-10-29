import { expect, test } from '@playwright/test'

// Template for future feature specs: the CMS backend can be mocked via
// page.route() without a real backend/docker instance.
test('advisory dashboard loads with a mocked backend', async ({ page }) => {
  await page.route(
    '**/.well-known/appspecific/de.bsi.secvisogram.json',
    (route) =>
      route.fulfill({
        json: {
          loginUrl: '/oauth2/sign_in',
          logoutUrl: '/oauth2/sign_out',
          userInfoUrl: '/oauth2/userinfo',
        },
      }),
  )
  await page.route('**/oauth2/userinfo', (route) =>
    route.fulfill({ json: { groups: [] } }),
  )
  await page.route('**/api/v1/advisories', (route) =>
    route.fulfill({
      json: [{ advisoryId: 'intercepted-advisory', allowedStateChanges: [] }],
    }),
  )

  await page.goto('/')

  await expect(
    page.getByRole('heading', { name: 'Advisory Dashboard' }),
  ).toBeVisible()
})
