import { expect, test } from '@playwright/test'

// Template for future feature specs: the CMS backend can be mocked via
// page.route() without a real backend/docker instance.
test('advisory dashboard loads with a mocked backend', async ({ page }) => {
  await page.route('**/api/v1/advisories', (route) =>
    route.fulfill({ json: [{ advisoryId: 'intercepted-advisory' }] }),
  )

  await page.goto('/')

  await expect(
    page.getByRole('heading', { name: 'Advisory Dashboard' }),
  ).toBeVisible()
})
