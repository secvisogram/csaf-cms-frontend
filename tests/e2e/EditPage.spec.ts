import { expect, test } from '@playwright/test'

test('passes locale="en" to the embedded secvisogram-editor element', async ({
  page,
}) => {
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
    route.fulfill({ json: { groups: ['editor'] } }),
  )

  await page.goto('/some-advisory-id/edit')

  await expect(page.locator('secvisogram-editor')).toHaveAttribute(
    'locale',
    'en',
  )
})
