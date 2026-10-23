import { expect, test, type Page, type Route } from '@playwright/test'

const csaf = {
  document: { csaf_version: '2.1', title: 'Example advisory' },
}

type Patch = { revision: string | null; body: Record<string, unknown> }

async function mockBackend(
  page: Page,
  overrides?: {
    validatorUrl?: string
    onPatch?: (patch: Patch, route: Route) => Promise<void> | void
  },
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
  // Mutations read this double-submit cookie; without it the client would probe /about first.
  await page
    .context()
    .addCookies([
      { name: 'XSRF-TOKEN', value: 'token', url: 'http://localhost:5173' },
    ])
  await page.route('**/oauth2/userinfo', (route) =>
    route.fulfill({ json: { groups: ['editor'] } }),
  )
  await page.route('**/api/v1/advisories/some-advisory-id**', (route) => {
    const request = route.request()
    if (request.method() === 'PATCH') {
      const patch = {
        revision: new URL(request.url()).searchParams.get('revision'),
        body: request.postDataJSON(),
      }
      return overrides?.onPatch?.(patch, route)
    }
    return route.fulfill({
      json: { advisoryId: 'some-advisory-id', revision: 'rev-1', csaf },
    })
  })
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

test('always shows the footer with the current validity and disables Save… while invalid', async ({
  page,
}) => {
  await mockBackend(page)

  await page.goto('/some-advisory-id/edit')

  const footer = page.getByTestId('save_footer')
  await expect(footer).toContainText('Document is valid')
  await expect(footer.getByRole('button', { name: 'Save…' })).toBeEnabled()

  await page.getByTestId('secvisogram-mock-valid-toggle').uncheck()

  await expect(footer).toContainText('Document is invalid')
  await expect(footer.getByRole('button', { name: 'Save…' })).toBeDisabled()
})

test('saves the tracked doc with the loaded revision and shows a success toast', async ({
  page,
}) => {
  const patches: Patch[] = []
  await mockBackend(page, {
    onPatch: (patch, route) => {
      patches.push(patch)
      return route.fulfill({ json: { revision: 'rev-2' } })
    },
  })
  await page.goto('/some-advisory-id/edit')

  const edited = { document: { csaf_version: '2.1', title: 'Edited title' } }
  await page.getByTestId('secvisogram-mock-doc').fill(JSON.stringify(edited))
  await page.getByRole('button', { name: 'Save…' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Summary').fill('Fixed the title')
  await dialog.getByLabel('Legacy version').fill('v0.9')
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()

  await expect(page.getByRole('status')).toHaveText(/Advisory saved/)
  await expect(dialog).toBeHidden()
  expect(patches).toEqual([
    {
      revision: 'rev-1',
      body: { csaf: edited, summary: 'Fixed the title', legacyVersion: 'v0.9' },
    },
  ])
})

test('omits a blank legacy version from the request', async ({ page }) => {
  const patches: Patch[] = []
  await mockBackend(page, {
    onPatch: (patch, route) => {
      patches.push(patch)
      return route.fulfill({ json: { revision: 'rev-2' } })
    },
  })
  await page.goto('/some-advisory-id/edit')

  await page.getByRole('button', { name: 'Save…' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Summary').fill('Summary only')
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()

  await expect(page.getByRole('status')).toHaveText(/Advisory saved/)
  expect(patches[0]?.body).toEqual({ csaf, summary: 'Summary only' })
})

test('sends the revision returned by the previous save on the next save', async ({
  page,
}) => {
  const patches: Patch[] = []
  await mockBackend(page, {
    onPatch: (patch, route) => {
      patches.push(patch)
      return route.fulfill({
        json: { revision: `rev-${patches.length + 1}` },
      })
    },
  })
  await page.goto('/some-advisory-id/edit')

  for (const summary of ['First', 'Second']) {
    await page.getByRole('button', { name: 'Save…' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Summary').fill(summary)
    await dialog.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(dialog).toBeHidden()
  }

  expect(patches.map((patch) => patch.revision)).toEqual(['rev-1', 'rev-2'])
})

test('shows an error toast and keeps the modal and its values when saving fails', async ({
  page,
}) => {
  await mockBackend(page, {
    onPatch: (_patch, route) =>
      route.fulfill({ status: 500, json: { message: 'boom' } }),
  })
  await page.goto('/some-advisory-id/edit')

  await page.getByRole('button', { name: 'Save…' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Summary').fill('Will fail')
  await dialog.getByLabel('Legacy version').fill('v1')
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()

  await expect(page.getByRole('status')).toHaveText(
    /Could not save the advisory/,
  )
  await expect(dialog).toBeVisible()
  // Only a top-layer toast container renders above the modal's backdrop.
  await expect(page.locator('[popover]:popover-open')).toContainText(
    'Could not save the advisory',
  )
  await expect(dialog.getByLabel('Summary')).toHaveValue('Will fail')
  await expect(dialog.getByLabel('Legacy version')).toHaveValue('v1')
})

test('shows an error toast and keeps the modal when the save request rejects', async ({
  page,
}) => {
  await mockBackend(page, {
    onPatch: (_patch, route) => route.fulfill({ json: { revision: 'rev-2' } }),
  })
  // Reading the response body can fail after the headers arrived; Playwright cannot simulate that.
  await page.addInitScript(() => {
    const text = Response.prototype.text
    Response.prototype.text = function () {
      return this.url.includes('?revision=')
        ? Promise.reject(new TypeError('body stream failed'))
        : text.call(this)
    }
  })
  await page.goto('/some-advisory-id/edit')

  await page.getByRole('button', { name: 'Save…' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Summary').fill('Will reject')
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()

  await expect(page.getByRole('status')).toHaveText(
    /Could not save the advisory/,
  )
  await expect(dialog.getByLabel('Summary')).toHaveValue('Will reject')
  await expect(
    dialog.getByRole('button', { name: 'Save', exact: true }),
  ).toBeEnabled()
})

for (const width of [1280, 1920]) {
  test(`fills the shell's content area edge to edge and sits flush above the footer at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 })
    await mockBackend(page)

    await page.goto('/some-advisory-id/edit')

    const editor = page.locator('secvisogram-editor')
    await expect(editor).toBeVisible()
    const box = await editor.boundingBox()
    const footer = await page.getByTestId('save_footer').boundingBox()
    expect(box?.x).toBe(0)
    expect(box?.width).toBe(width)
    expect(footer?.y).toBeGreaterThan(0)
    expect(
      Math.abs((box?.y ?? 0) + (box?.height ?? 0) - (footer?.y ?? 0)),
    ).toBeLessThanOrEqual(1)
    await expect(page.getByTestId('save_footer')).toContainText(
      'some-advisory-id',
    )
    const overflow = await editor.evaluate((el) => {
      const container = el.parentElement?.closest('.overflow-auto')
      return container ? container.scrollHeight - container.clientHeight : NaN
    })
    expect(overflow).toBe(0)
  })
}
