import { expect, test, type Page } from '@playwright/test'

const blankDoc = {
  document: { category: 'csaf_security_advisory', csaf_version: '2.0' },
}
const templateDoc = {
  document: {
    category: 'csaf_vex',
    csaf_version: '2.0',
    title: 'From template',
  },
}
const templates = [
  { templateId: 'vex', templateDescription: 'VEX template' },
  { templateId: 'other', templateDescription: 'Other template' },
]

async function mockBackend(
  page: Page,
  options: { groups?: string[]; templatesStatus?: number } = {},
) {
  await page
    .context()
    .addCookies([
      { name: 'XSRF-TOKEN', value: 'token', url: 'http://localhost:5173' },
    ])
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
    route.fulfill({ json: { groups: options.groups ?? ['author'] } }),
  )
  await page.route('**/api/v1/advisories', (route) =>
    route.request().method() === 'GET'
      ? route.fulfill({ json: [] })
      : route.fulfill({ status: 201, json: { id: 'new-id', revision: 'r1' } }),
  )
  await page.route('**/api/v1/advisories/templates', (route) =>
    options.templatesStatus
      ? route.fulfill({ status: options.templatesStatus, json: {} })
      : route.fulfill({ json: templates }),
  )
  await page.route('**/api/v1/advisories/templates/vex', (route) =>
    route.fulfill({ json: templateDoc }),
  )
  await page.route('**/api/v1/advisories/templates/gone', (route) =>
    route.fulfill({ status: 404, json: { message: 'no such template' } }),
  )
  await page.route('**/api/v1/advisories/new-id', (route) =>
    route.fulfill({
      json: { advisoryId: 'new-id', revision: 'r1', csaf: templateDoc },
    }),
  )
}

async function openNewDialog(page: Page) {
  await page.getByRole('button', { name: 'New', exact: true }).click()
  return page.getByRole('dialog', { name: 'New document' })
}

test('Blank document navigates to /new without POST or template requests', async ({
  page,
}) => {
  await mockBackend(page)
  const requests: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('/api/v1/advisories/templates/')) {
      requests.push(request.url())
    }
    if (request.method() === 'POST') requests.push(request.url())
  })

  await page.goto('/')
  const dialog = await openNewDialog(page)
  await expect(dialog.getByLabel('Blank document')).toBeChecked()
  await dialog.getByRole('button', { name: 'Create' }).click()

  await expect(page).toHaveURL(/\/new$/)
  await expect(page.getByTestId('secvisogram-mock-doc')).toHaveValue(
    JSON.stringify(blankDoc, null, 2),
  )
  expect(requests).toEqual([])
})

test('Use a template navigates to /new?template=<id> and seeds the editor with its content', async ({
  page,
}) => {
  await mockBackend(page)

  await page.goto('/')
  const dialog = await openNewDialog(page)
  await dialog.getByLabel('Use a template').check()
  await dialog.getByLabel('Template', { exact: true }).selectOption('vex')
  await dialog.getByRole('button', { name: 'Create' }).click()

  await expect(page).toHaveURL(/\/new\?template=vex$/)
  await expect(page.getByTestId('secvisogram-mock-doc')).toHaveValue(
    JSON.stringify(templateDoc, null, 2),
  )
})

test('refetches the template list on every open', async ({ page }) => {
  await mockBackend(page)
  let listRequests = 0
  page.on('request', (request) => {
    if (request.url().endsWith('/api/v1/advisories/templates')) listRequests++
  })

  await page.goto('/')
  const dialog = await openNewDialog(page)
  await expect(dialog.getByLabel('Template', { exact: true })).toBeVisible()
  const afterFirstOpen = listRequests
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await openNewDialog(page)
  await expect(page.getByLabel('Template', { exact: true })).toBeVisible()

  expect(listRequests).toBeGreaterThan(afterFirstOpen)
})

test('disables "Use a template" when the template list fails to load, keeping Blank document usable', async ({
  page,
}) => {
  await mockBackend(page, { templatesStatus: 500 })

  await page.goto('/')
  const dialog = await openNewDialog(page)

  await expect(dialog.getByRole('alert')).toHaveText(
    'No templates are available.',
  )
  await expect(dialog.getByLabel('Use a template')).toBeDisabled()
  await dialog.getByRole('button', { name: 'Create' }).click()
  await expect(page).toHaveURL(/\/new$/)
  await expect(page.getByTestId('secvisogram-mock-doc')).toBeVisible()
})

test('renders the route error boundary instead of the editor when the template fetch fails', async ({
  page,
}) => {
  await mockBackend(page)

  await page.goto('/new?template=gone')

  await expect(page.getByRole('alert')).toHaveText(
    'The new document could not be loaded.',
  )
  await expect(page.locator('secvisogram-editor')).toHaveCount(0)
})

test('redirects a user without the author group from /new to the dashboard', async ({
  page,
}) => {
  await mockBackend(page, { groups: ['editor'] })

  await page.goto('/new')

  await expect(
    page.getByRole('heading', { name: 'Advisory Dashboard' }),
  ).toBeVisible()
  await expect(page).toHaveURL(/\/$/)
  await expect(
    page.getByRole('button', { name: 'New', exact: true }),
  ).toHaveCount(0)
})

test('first Save creates the advisory and replaces /new with the edit page', async ({
  page,
}) => {
  await mockBackend(page)
  let postBody: unknown
  await page.route('**/api/v1/advisories', async (route) => {
    if (route.request().method() === 'POST') {
      postBody = route.request().postDataJSON()
      return route.fulfill({
        status: 201,
        json: { id: 'new-id', revision: 'r1' },
      })
    }
    return route.fulfill({ json: [] })
  })

  await page.goto('/')
  const dialog = await openNewDialog(page)
  await dialog.getByRole('button', { name: 'Create' }).click()
  await expect(page).toHaveURL(/\/new$/)

  const edited = { document: { ...blankDoc.document, title: 'Edited' } }
  await page.getByTestId('secvisogram-mock-doc').fill(JSON.stringify(edited))
  await expect(page.getByTestId('new_page_tracked_doc')).toHaveText(
    JSON.stringify(edited),
  )

  await page.getByRole('button', { name: 'Save…' }).click()
  const saveDialog = page.getByRole('dialog', { name: 'Save…' })
  await saveDialog.getByLabel('Summary').fill('Initial version')
  await saveDialog.getByLabel('Legacy version').fill('1.0')
  await saveDialog.getByRole('button', { name: 'Save', exact: true }).click()

  await expect(page).toHaveURL(/\/new-id\/edit$/)
  await expect(page.getByTestId('edit_page_tracked_doc')).toHaveText(
    JSON.stringify(templateDoc),
  )
  await expect(page.getByRole('status')).toHaveText(/Advisory created\./)
  expect(postBody).toEqual({
    csaf: edited,
    summary: 'Initial version',
    legacyVersion: '1.0',
  })

  await page.goBack()
  await expect(page).toHaveURL(/\/$/)
})

test('keeps the modal open and shows an error toast when the first Save fails', async ({
  page,
}) => {
  await mockBackend(page)
  await page.route('**/api/v1/advisories', (route) =>
    route.request().method() === 'POST'
      ? route.fulfill({ status: 400, json: { message: 'bad summary' } })
      : route.fulfill({ json: [] }),
  )

  await page.goto('/new')
  await page.getByRole('button', { name: 'Save…' }).click()
  const saveDialog = page.getByRole('dialog', { name: 'Save…' })
  await saveDialog.getByLabel('Summary').fill('Kept')
  await saveDialog.getByRole('button', { name: 'Save', exact: true }).click()

  await expect(page.getByRole('status')).toHaveText(
    /The advisory could not be created\./,
  )
  await expect(saveDialog.getByLabel('Summary')).toHaveValue('Kept')
  await expect(page).toHaveURL(/\/new$/)
})

test('disables Save… while the document is invalid', async ({ page }) => {
  await mockBackend(page)

  await page.goto('/new')
  await expect(page.getByRole('button', { name: 'Save…' })).toBeEnabled()

  await page.getByTestId('secvisogram-mock-valid-toggle').uncheck()

  await expect(page.getByRole('button', { name: 'Save…' })).toBeDisabled()
})

test('saves a document seeded from a template', async ({ page }) => {
  await mockBackend(page)
  let postBody: unknown
  await page.route('**/api/v1/advisories', (route) => {
    if (route.request().method() !== 'POST') return route.fulfill({ json: [] })
    postBody = route.request().postDataJSON()
    return route.fulfill({
      status: 201,
      json: { id: 'new-id', revision: 'r1' },
    })
  })

  await page.goto('/new?template=vex')
  await expect(page.getByTestId('new_page_tracked_doc')).toHaveText(
    JSON.stringify(templateDoc),
  )
  await page.getByRole('button', { name: 'Save…' }).click()
  const saveDialog = page.getByRole('dialog', { name: 'Save…' })
  await saveDialog.getByLabel('Summary').fill('From template')
  await saveDialog.getByLabel('Legacy version').fill('   ')
  await saveDialog.getByRole('button', { name: 'Save', exact: true }).click()

  await expect(page).toHaveURL(/\/new-id\/edit$/)
  expect(postBody).toEqual({ csaf: templateDoc, summary: 'From template' })
})

test('closes the New dialog with Escape', async ({ page }) => {
  await mockBackend(page)

  await page.goto('/')
  const dialog = await openNewDialog(page)
  await expect(dialog).toBeVisible()

  await page.keyboard.press('Escape')

  await expect(dialog).toBeHidden()
})

for (const width of [1280, 1920]) {
  test(`fills the shell's content area edge to edge and sits flush above the footer at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 })
    await mockBackend(page)

    await page.goto('/new')

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
  })
}
