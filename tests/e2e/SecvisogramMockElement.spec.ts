import { expect, test } from '@playwright/test'

async function gotoEditPage(page: import('@playwright/test').Page) {
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
}

test('reflects the doc property in what it renders', async ({ page }) => {
  await gotoEditPage(page)

  await page.locator('secvisogram-editor').evaluate(
    (el, doc) => {
      ;(el as HTMLElement & { doc: unknown }).doc = doc
    },
    { title: 'Example advisory' },
  )

  await expect(page.getByTestId('secvisogram-mock-doc')).toHaveValue(
    JSON.stringify({ title: 'Example advisory' }, null, 2),
  )
})

test('dispatches csaf-change and csaf-validate when the stand-in content is edited', async ({
  page,
}) => {
  await gotoEditPage(page)

  await page.locator('secvisogram-editor').evaluate((el) => {
    const w = window as unknown as {
      capturedChanges: unknown[]
      capturedValidations: unknown[]
    }
    w.capturedChanges = []
    w.capturedValidations = []
    el.addEventListener('csaf-change', (event) =>
      w.capturedChanges.push((event as CustomEvent).detail),
    )
    el.addEventListener('csaf-validate', (event) =>
      w.capturedValidations.push((event as CustomEvent).detail),
    )
  })

  await page
    .getByTestId('secvisogram-mock-doc')
    .fill(JSON.stringify({ title: 'Edited advisory' }))

  const captured = await page.evaluate(
    () =>
      (
        window as unknown as {
          capturedChanges: unknown[]
          capturedValidations: unknown[]
        }
      ).capturedChanges,
  )
  expect(captured).toEqual([{ doc: { title: 'Edited advisory' } }])

  const capturedValidations = await page.evaluate(
    () =>
      (
        window as unknown as {
          capturedChanges: unknown[]
          capturedValidations: unknown[]
        }
      ).capturedValidations,
  )
  expect(capturedValidations).toEqual([{ errors: [], valid: true }])
})

test('the valid toggle lets a test manually simulate the invalid-document path', async ({
  page,
}) => {
  await gotoEditPage(page)

  await page.locator('secvisogram-editor').evaluate((el) => {
    const w = window as unknown as { capturedValidations: unknown[] }
    w.capturedValidations = []
    el.addEventListener('csaf-validate', (event) =>
      w.capturedValidations.push((event as CustomEvent).detail),
    )
  })

  await page.getByTestId('secvisogram-mock-valid-toggle').uncheck()

  const capturedValidations = await page.evaluate(
    () =>
      (window as unknown as { capturedValidations: unknown[] })
        .capturedValidations,
  )
  expect(capturedValidations).toEqual([
    {
      errors: [
        { type: 'error', instancePath: '', message: 'Mock validation error' },
      ],
      valid: false,
    },
  ])
})

test('accepts locale and validatorUrl as JS properties', async ({ page }) => {
  await gotoEditPage(page)

  const readBack = await page.locator('secvisogram-editor').evaluate((el) => {
    const editor = el as HTMLElement & {
      locale?: string
      validatorUrl?: string
    }
    editor.locale = 'de'
    editor.validatorUrl = 'https://validator.example/api/v1/validate'
    return {
      locale: editor.locale,
      validatorUrl: editor.validatorUrl,
    }
  })

  expect(readBack).toEqual({
    locale: 'de',
    validatorUrl: 'https://validator.example/api/v1/validate',
  })
})

test('re-setting doc after mount resets internal state', async ({ page }) => {
  await gotoEditPage(page)

  const editor = page.locator('secvisogram-editor')
  await editor.evaluate(
    (el, doc) => {
      ;(el as HTMLElement & { doc: unknown }).doc = doc
    },
    { title: 'First advisory' },
  )

  // simulate an in-progress unsaved edit and a manually-flipped invalid state
  await page
    .getByTestId('secvisogram-mock-doc')
    .fill(JSON.stringify({ title: 'Unsaved edit' }))
  await page.getByTestId('secvisogram-mock-valid-toggle').uncheck()

  await editor.evaluate(
    (el, doc) => {
      ;(el as HTMLElement & { doc: unknown }).doc = doc
    },
    { title: 'Second advisory' },
  )

  await expect(page.getByTestId('secvisogram-mock-doc')).toHaveValue(
    JSON.stringify({ title: 'Second advisory' }, null, 2),
  )
  await expect(page.getByTestId('secvisogram-mock-valid-toggle')).toBeChecked()
})
