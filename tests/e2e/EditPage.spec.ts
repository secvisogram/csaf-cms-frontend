import { expect, test } from '@playwright/test'

const csaf = {
  document: { csaf_version: '2.1', title: 'Example advisory' },
}

async function mockBackend(
  page: import('@playwright/test').Page,
  overrides?: { validatorUrl?: string },
) {
  await page.route(
    '**/.well-known/appspecific/de.bsi.secvisogram.json',
    (route) =>
      route.fulfill({
        json: {
          loginUrl: '/oauth2/sign_in',
          logoutUrl: '/oauth2/sign_out',
          userInfoUrl: '/oauth2/userinfo',
          validatorUrl: overrides?.validatorUrl,
        },
      }),
  )
  await page.route('**/oauth2/userinfo', (route) =>
    route.fulfill({ json: { groups: ['editor'] } }),
  )
  await page.route('**/api/v1/advisories/some-advisory-id', (route) =>
    route.fulfill({
      json: { advisoryId: 'some-advisory-id', revision: 'rev-1', csaf },
    }),
  )
}

test('fetches the advisory detail and passes doc/locale/validatorUrl to the element', async ({
  page,
}) => {
  await mockBackend(page, { validatorUrl: 'https://validator.example' })

  await page.goto('/some-advisory-id/edit')

  await expect(page.getByTestId('secvisogram-mock-doc')).toHaveValue(
    JSON.stringify(csaf, null, 2),
  )

  const properties = await page.locator('secvisogram-editor').evaluate((el) => {
    const editor = el as unknown as { locale?: string; validatorUrl?: string }
    return { locale: editor.locale, validatorUrl: editor.validatorUrl }
  })
  expect(properties).toEqual({
    locale: 'en',
    validatorUrl: 'https://validator.example',
  })
})

test('tracks the latest doc value from csaf-change events', async ({
  page,
}) => {
  await mockBackend(page)

  await page.goto('/some-advisory-id/edit')

  const edited = { document: { csaf_version: '2.1', title: 'Edited title' } }
  await page.getByTestId('secvisogram-mock-doc').fill(JSON.stringify(edited))

  await expect(page.getByTestId('edit_page_tracked_doc')).toHaveText(
    JSON.stringify(edited),
  )
})

test('tracks validity from csaf-validate events', async ({ page }) => {
  await mockBackend(page)

  await page.goto('/some-advisory-id/edit')

  await expect(page.getByTestId('edit_page_tracked_valid')).toHaveText('true')

  await page.getByTestId('secvisogram-mock-valid-toggle').uncheck()

  await expect(page.getByTestId('edit_page_tracked_valid')).toHaveText('false')
})
