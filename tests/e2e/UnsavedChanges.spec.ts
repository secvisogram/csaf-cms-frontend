import { expect, test, type Page } from '@playwright/test'

const loadedDoc = {
  document: { csaf_version: '2.1', title: 'Example advisory' },
}
const editedDoc = {
  document: { csaf_version: '2.1', title: 'Edited title' },
}

async function mockBackend(page: Page) {
  let savedDoc: unknown = loadedDoc
  await page
    .context()
    .addCookies([
      { name: 'XSRF-TOKEN', value: 'token', domain: 'localhost', path: '/' },
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
    route.fulfill({ json: { groups: ['author', 'editor'] } }),
  )
  await page.route('**/api/v1/advisories/some-advisory-id**', (route) => {
    if (route.request().method() === 'PATCH') {
      savedDoc = route.request().postDataJSON().csaf
      return route.fulfill({ json: { revision: 'rev-2' } })
    }
    return route.fulfill({
      json: {
        advisoryId: 'some-advisory-id',
        revision: 'rev-1',
        csaf: savedDoc,
      },
    })
  })
  await page.route('**/api/v1/advisories', (route) => {
    if (route.request().method() === 'POST') {
      savedDoc = route.request().postDataJSON().csaf
      return route.fulfill({
        status: 201,
        json: { id: 'some-advisory-id', revision: 'rev-1' },
      })
    }
    return route.fulfill({ json: [] })
  })
  await page.route('**/api/v1/advisories/templates', (route) =>
    route.fulfill({ json: [] }),
  )
}

const routes = [
  { path: '/new', trackedDoc: 'new_page_tracked_doc' },
  { path: '/some-advisory-id/edit', trackedDoc: 'edit_page_tracked_doc' },
] as const

async function editDocument(page: Page, trackedDoc: string) {
  await page.getByTestId('secvisogram-mock-doc').fill(JSON.stringify(editedDoc))
  await expect(page.getByTestId(trackedDoc)).toHaveText(
    JSON.stringify(editedDoc),
  )
}

for (const route of routes) {
  test(`cancels Dashboard navigation with unsaved edits on ${route.path}`, async ({
    page,
  }) => {
    await mockBackend(page)
    await page.goto(route.path)
    await editDocument(page, route.trackedDoc)

    const prompt = page.waitForEvent('dialog')
    await page.getByTestId('dashboard_link').click()
    const dialog = await prompt
    expect(dialog.type()).toBe('confirm')
    expect(dialog.message()).toBe('You have unsaved changes. Leave this page?')
    await dialog.dismiss()

    await expect(page).toHaveURL(route.path)
  })

  test(`continues Dashboard navigation after confirmation on ${route.path}`, async ({
    page,
  }) => {
    await mockBackend(page)
    await page.goto(route.path)
    await editDocument(page, route.trackedDoc)

    const prompt = page.waitForEvent('dialog')
    await page.getByTestId('dashboard_link').click()
    await (await prompt).accept()

    await expect(page).toHaveURL('/')
    await expect(
      page.getByRole('heading', { name: 'Advisory Dashboard' }),
    ).toBeVisible()
  })

  test(`does not block clean Dashboard navigation on ${route.path}`, async ({
    page,
  }) => {
    await mockBackend(page)
    await page.goto(route.path)

    let promptShown = false
    page.on('dialog', async (dialog) => {
      promptShown = true
      await dialog.dismiss()
    })
    await page.getByTestId('dashboard_link').click()

    await expect(page).toHaveURL('/')
    expect(promptShown).toBe(false)
  })
}

test('blocks creating a new document from an edited advisory', async ({
  page,
}) => {
  await mockBackend(page)
  await page.goto('/some-advisory-id/edit')
  await editDocument(page, 'edit_page_tracked_doc')

  await page.getByTestId('new_document_button').click()
  const newDialog = page.getByRole('dialog', { name: 'New document' })
  await newDialog.getByRole('button', { name: 'Create' }).click()

  const dialog = await page.waitForEvent('dialog')
  expect(dialog.type()).toBe('confirm')
  await dialog.dismiss()

  await expect(page).toHaveURL('/some-advisory-id/edit')
  await expect(page.getByTestId('new_page_tracked_doc')).toHaveCount(0)
})

test('continues creating a new document after confirming the prompt', async ({
  page,
}) => {
  await mockBackend(page)
  await page.goto('/some-advisory-id/edit')
  await editDocument(page, 'edit_page_tracked_doc')

  await page.getByTestId('new_document_button').click()
  const newDialog = page.getByRole('dialog', { name: 'New document' })
  const prompt = page.waitForEvent('dialog')
  await newDialog.getByRole('button', { name: 'Create' }).click()
  const dialog = await prompt
  expect(dialog.type()).toBe('confirm')
  await dialog.accept()

  await expect(page).toHaveURL('/new')
  await expect(page.getByTestId('new_page_tracked_doc')).toBeAttached()
})

test('prompts before starting another new document from /new', async ({
  page,
}) => {
  await mockBackend(page)
  await page.goto('/new')
  await editDocument(page, 'new_page_tracked_doc')

  await page.getByTestId('new_document_button').click()
  const newDialog = page.getByRole('dialog', { name: 'New document' })
  const prompt = page.waitForEvent('dialog')
  await newDialog.getByRole('button', { name: 'Create' }).click()
  const dialog = await prompt
  expect(dialog.type()).toBe('confirm')
  await dialog.dismiss()

  await expect(page).toHaveURL('/new')
  await expect(page.getByTestId('new_page_tracked_doc')).toHaveText(
    JSON.stringify(editedDoc),
  )
})

test('starts another new document after confirming the prompt from /new', async ({
  page,
}) => {
  await mockBackend(page)
  await page.goto('/new')
  await editDocument(page, 'new_page_tracked_doc')

  await page.getByTestId('new_document_button').click()
  const newDialog = page.getByRole('dialog', { name: 'New document' })
  const prompt = page.waitForEvent('dialog')
  await newDialog.getByRole('button', { name: 'Create' }).click()
  const dialog = await prompt
  expect(dialog.type()).toBe('confirm')
  await dialog.accept()

  await expect(page).toHaveURL('/new')
  await expect(page.getByTestId('new_page_tracked_doc')).toHaveText(
    JSON.stringify({
      document: { category: 'csaf_security_advisory', csaf_version: '2.0' },
    }),
  )
})

test('cancels browser Back when the current document has unsaved edits', async ({
  page,
}) => {
  await mockBackend(page)
  await page.goto('/')
  await page.getByTestId('new_document_button').click()
  await page
    .getByRole('dialog', { name: 'New document' })
    .getByRole('button', { name: 'Create' })
    .click()
  await expect(page).toHaveURL('/new')
  await editDocument(page, 'new_page_tracked_doc')

  const prompt = page.waitForEvent('dialog')
  void page.goBack().catch(() => undefined)
  const dialog = await prompt
  expect(dialog.type()).toBe('confirm')
  await dialog.dismiss()

  await expect(page).toHaveURL('/new')
})

test('continues browser Back from /new after confirming the prompt', async ({
  page,
}) => {
  await mockBackend(page)
  await page.goto('/')
  await page.getByTestId('new_document_button').click()
  await page
    .getByRole('dialog', { name: 'New document' })
    .getByRole('button', { name: 'Create' })
    .click()
  await expect(page).toHaveURL('/new')
  await editDocument(page, 'new_page_tracked_doc')

  const prompt = page.waitForEvent('dialog')
  void page.goBack().catch(() => undefined)
  const dialog = await prompt
  expect(dialog.type()).toBe('confirm')
  await dialog.accept()

  await expect(page).toHaveURL('/')
})

test('cancels browser Back from an edited advisory', async ({ page }) => {
  await mockBackend(page)
  await page.goto('/')
  await page.getByTestId('new_document_button').click()
  await page
    .getByRole('dialog', { name: 'New document' })
    .getByRole('button', { name: 'Create' })
    .click()
  await expect(page).toHaveURL('/new')
  await page.getByRole('button', { name: 'Save…' }).click()
  const saveDialog = page.getByRole('dialog', { name: 'Save…' })
  await saveDialog.getByLabel('Summary').fill('Initial save')
  await saveDialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page).toHaveURL('/some-advisory-id/edit')
  await editDocument(page, 'edit_page_tracked_doc')

  const prompt = page.waitForEvent('dialog')
  void page.goBack().catch(() => undefined)
  const dialog = await prompt
  expect(dialog.type()).toBe('confirm')
  await dialog.dismiss()

  await expect(page).toHaveURL('/some-advisory-id/edit')
})

test('continues browser Back from an edited advisory after confirmation', async ({
  page,
}) => {
  await mockBackend(page)
  await page.goto('/')
  await page.getByTestId('new_document_button').click()
  await page
    .getByRole('dialog', { name: 'New document' })
    .getByRole('button', { name: 'Create' })
    .click()
  await expect(page).toHaveURL('/new')
  await page.getByRole('button', { name: 'Save…' }).click()
  const saveDialog = page.getByRole('dialog', { name: 'Save…' })
  await saveDialog.getByLabel('Summary').fill('Initial save')
  await saveDialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page).toHaveURL('/some-advisory-id/edit')
  await editDocument(page, 'edit_page_tracked_doc')

  const prompt = page.waitForEvent('dialog')
  void page.goBack().catch(() => undefined)
  const dialog = await prompt
  expect(dialog.type()).toBe('confirm')
  await dialog.accept()

  await expect(page).toHaveURL('/')
})

test('a successful Save clears the dirty state on an existing advisory', async ({
  page,
}) => {
  await mockBackend(page)
  await page.goto('/some-advisory-id/edit')
  await editDocument(page, 'edit_page_tracked_doc')

  await page.getByRole('button', { name: 'Save…' }).click()
  const saveDialog = page.getByRole('dialog', { name: 'Save…' })
  await saveDialog.getByLabel('Summary').fill('Saved edits')
  await saveDialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(saveDialog).toBeHidden()

  let promptShown = false
  page.on('dialog', async (dialog) => {
    promptShown = true
    await dialog.dismiss()
  })
  await page.getByTestId('dashboard_link').click()

  await expect(page).toHaveURL('/')
  expect(promptShown).toBe(false)
})

test('the first successful Save replaces /new with the edit page without a prompt', async ({
  page,
}) => {
  await mockBackend(page)
  await page.goto('/new')
  await editDocument(page, 'new_page_tracked_doc')

  let promptShown = false
  page.on('dialog', async (dialog) => {
    promptShown = true
    await dialog.dismiss()
  })
  await page.getByRole('button', { name: 'Save…' }).click()
  const saveDialog = page.getByRole('dialog', { name: 'Save…' })
  await saveDialog.getByLabel('Summary').fill('Initial save')
  await saveDialog.getByRole('button', { name: 'Save', exact: true }).click()

  await expect(page).toHaveURL('/some-advisory-id/edit')
  await expect(page.getByTestId('edit_page_tracked_doc')).toHaveText(
    JSON.stringify(editedDoc),
  )
  expect(promptShown).toBe(false)

  let laterPromptShown = false
  page.on('dialog', async (dialog) => {
    laterPromptShown = true
    await dialog.dismiss()
  })
  await page.getByTestId('dashboard_link').click()

  await expect(page).toHaveURL('/')
  expect(laterPromptShown).toBe(false)
})

test('reload and Logout use the browser beforeunload prompt for unsaved edits', async ({
  page,
}) => {
  await mockBackend(page)
  await page.goto('/some-advisory-id/edit')
  await editDocument(page, 'edit_page_tracked_doc')

  const reloadPrompt = page.waitForEvent('dialog')
  void page.reload().catch(() => undefined)
  const reloadDialog = await reloadPrompt
  expect(reloadDialog.type()).toBe('beforeunload')
  await reloadDialog.dismiss()
  await expect(page.locator('secvisogram-editor')).toBeVisible()

  const logoutPrompt = page.waitForEvent('dialog')
  void page
    .getByTestId('logout_button')
    .click()
    .catch(() => undefined)
  const logoutDialog = await logoutPrompt
  expect(logoutDialog.type()).toBe('beforeunload')
  await logoutDialog.dismiss()
  await expect(page).toHaveURL('/some-advisory-id/edit')
})

test('reloading a new document with unsaved edits shows beforeunload', async ({
  page,
}) => {
  await mockBackend(page)
  await page.goto('/new')
  await editDocument(page, 'new_page_tracked_doc')

  const prompt = page.waitForEvent('dialog')
  void page.reload().catch(() => undefined)
  const dialog = await prompt
  expect(dialog.type()).toBe('beforeunload')
  await dialog.dismiss()
  await expect(page.locator('secvisogram-editor')).toBeVisible()
})

test('a clean document does not show a beforeunload prompt on reload', async ({
  page,
}) => {
  await mockBackend(page)
  await page.goto('/some-advisory-id/edit')

  let promptShown = false
  page.on('dialog', async (dialog) => {
    promptShown = true
    await dialog.dismiss()
  })
  await page.reload()

  expect(promptShown).toBe(false)
  await expect(page.locator('secvisogram-editor')).toBeVisible()
})
