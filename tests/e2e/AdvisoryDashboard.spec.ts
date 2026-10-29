import { expect, test, type Page } from '@playwright/test'

const advisories = [
  {
    advisoryId: 'advisory-1',
    workflowState: 'Draft',
    documentTrackingId: 'CSAFPX-2024-001',
    title: 'Buffer overflow in Foo',
    owner: 'alice',
    changeable: true,
    deletable: true,
    canCreateVersion: true,
    allowedStateChanges: [],
    currentReleaseDate: '2024-01-15',
  },
  {
    advisoryId: 'advisory-2',
    workflowState: 'Approved',
    documentTrackingId: 'CSAFPX-2024-002',
    title: 'Authentication bypass in Bar',
    owner: 'bob',
    changeable: false,
    deletable: false,
    canCreateVersion: false,
    allowedStateChanges: [],
    currentReleaseDate: '2024-02-20',
  },
]

test.beforeEach(async ({ page }) => {
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
    route.fulfill({ json: advisories }),
  )
  await page.route('**/api/v1/advisories/advisory-1', (route) =>
    route.fulfill({
      json: {
        ...advisories[0],
        revision: 'rev-1',
        csaf: { document: { csaf_version: '2.1' } },
      },
    }),
  )
})

test('renders advisory rows with the expected columns, each linking to its edit page', async ({
  page,
}) => {
  await page.goto('/')

  await expect(page.getByRole('columnheader', { name: 'Title' })).toBeVisible()
  await expect(
    page.getByRole('columnheader', { name: 'Tracking ID' }),
  ).toBeVisible()
  await expect(
    page.getByRole('columnheader', { name: 'Workflow State' }),
  ).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'Owner' })).toBeVisible()
  await expect(
    page.getByRole('columnheader', { name: 'Current Release Date' }),
  ).toBeVisible()

  const row = page.getByRole('row', { name: /Buffer overflow in Foo/ })
  await expect(row.getByText('CSAFPX-2024-001')).toBeVisible()
  await expect(row.getByText('Draft')).toBeVisible()
  await expect(row.getByText('alice')).toBeVisible()
  await expect(row.getByText('2024-01-15')).toBeVisible()

  await row.getByRole('link', { name: 'Buffer overflow in Foo' }).click()
  await expect(page).toHaveURL('/advisory-1/edit')
})

test('filters rows by a client-side text search', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('textbox', { name: 'Filter advisories' }).fill('bob')

  await expect(
    page.getByRole('row', { name: /Authentication bypass in Bar/ }),
  ).toBeVisible()
  await expect(
    page.getByRole('row', { name: /Buffer overflow in Foo/ }),
  ).not.toBeVisible()
})

test('sorts rows by clicking a column header', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('columnheader', { name: 'Title' }).click()

  const rows = page.getByRole('row')
  // rows.nth(0) is the header row
  await expect(rows.nth(1)).toContainText('Authentication bypass in Bar')
  await expect(rows.nth(2)).toContainText('Buffer overflow in Foo')

  await page.getByRole('columnheader', { name: 'Title' }).click()

  await expect(rows.nth(1)).toContainText('Buffer overflow in Foo')
  await expect(rows.nth(2)).toContainText('Authentication bypass in Bar')
})

test.describe('workflow-state change', () => {
  const changeable = {
    ...advisories[0],
    allowedStateChanges: ['Review', 'Published'],
  }

  /** The mocked list and detail reflect a state change once the PATCH succeeded, like the real backend. */
  async function mockWorkflowBackend(page: Page, patchStatus: number) {
    const calls: string[] = []
    let workflowState = 'Draft'
    await page
      .context()
      .addCookies([
        { name: 'XSRF-TOKEN', value: 'token', url: 'http://localhost:5173' },
      ])
    await page.route('**/api/v1/advisories', (route) =>
      route.fulfill({
        json: [{ ...changeable, workflowState }, advisories[1]],
      }),
    )
    await page.route('**/api/v1/advisories/advisory-1', (route) => {
      calls.push('GET detail')
      return route.fulfill({
        json: { ...changeable, workflowState, revision: 'rev-2', csaf: {} },
      })
    })
    await page.route(
      '**/api/v1/advisories/advisory-1/workflowstate/**',
      (route) => {
        const url = new URL(route.request().url())
        calls.push(`PATCH ${url.pathname}${url.search}`)
        if (patchStatus !== 200) {
          return route.fulfill({ status: patchStatus, json: { message: 'x' } })
        }
        workflowState = url.pathname.split('/').pop() ?? workflowState
        return route.fulfill({
          status: 200,
          contentType: 'text/plain',
          body: 'rev-3',
        })
      },
    )
    return calls
  }

  test('changes the state with a fresh revision and updates the row', async ({
    page,
  }) => {
    const calls = await mockWorkflowBackend(page, 200)
    await page.goto('/')

    const row = page.getByRole('row', { name: /Buffer overflow in Foo/ })
    await expect(row.getByText('Draft')).toBeVisible()
    await row.getByRole('button', { name: 'Change state' }).click()

    const dialog = page.getByRole('dialog', { name: 'Change workflow state' })
    const options = await dialog
      .getByLabel('New workflow state')
      .locator('option')
      .allTextContents()
    expect(options).toEqual(['-- Choose --', 'Review', 'Published'])

    await dialog.getByLabel('New workflow state').selectOption('Review')
    await dialog.getByRole('button', { name: 'Change', exact: true }).click()

    await expect(row.getByText('Review')).toBeVisible()
    await expect(row.getByText('Draft')).not.toBeVisible()
    await expect(
      page.getByRole('status').filter({ hasText: 'Workflow state changed' }),
    ).toBeVisible()
    await expect(dialog).not.toBeVisible()
    expect(calls.slice(0, 2)).toEqual([
      'GET detail',
      'PATCH /api/v1/advisories/advisory-1/workflowstate/Review?revision=rev-2',
    ])
  })

  test('sends the tracking status when publishing', async ({ page }) => {
    const calls = await mockWorkflowBackend(page, 200)
    await page.goto('/')

    await page.getByRole('button', { name: 'Change state' }).click()
    const dialog = page.getByRole('dialog', { name: 'Change workflow state' })
    await dialog.getByLabel('New workflow state').selectOption('Published')
    await dialog.getByLabel('Document tracking status').selectOption('Final')
    await dialog.getByRole('button', { name: 'Change', exact: true }).click()

    await expect(dialog).not.toBeVisible()
    expect(calls[1]).toBe(
      'PATCH /api/v1/advisories/advisory-1/workflowstate/Published?revision=rev-2&documentTrackingStatus=Final',
    )
  })

  test('shows an error toast and keeps the state when the change fails', async ({
    page,
  }) => {
    await mockWorkflowBackend(page, 500)
    await page.goto('/')

    const row = page.getByRole('row', { name: /Buffer overflow in Foo/ })
    await row.getByRole('button', { name: 'Change state' }).click()
    const dialog = page.getByRole('dialog', { name: 'Change workflow state' })
    await dialog.getByLabel('New workflow state').selectOption('Review')
    await dialog.getByRole('button', { name: 'Change', exact: true }).click()

    await expect(
      page.getByRole('status').filter({ hasText: 'could not be changed' }),
    ).toBeVisible()
    await expect(row.getByText('Draft')).toBeVisible()
  })

  test('offers no action for an advisory without allowed state changes', async ({
    page,
  }) => {
    await mockWorkflowBackend(page, 200)
    await page.goto('/')

    await expect(
      page
        .getByRole('row', { name: /Authentication bypass in Bar/ })
        .getByRole('button', { name: 'Change state' }),
    ).toHaveCount(0)
  })
})

test('shows an error notification and an empty table when loading fails', async ({
  page,
}) => {
  await page.route('**/api/v1/advisories', (route) =>
    route.fulfill({ status: 500, json: { message: 'boom' } }),
  )
  await page.goto('/')

  await expect(
    page.getByRole('status').filter({ hasText: 'could not be loaded' }),
  ).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'Title' })).toBeVisible()
  await expect(page.getByRole('row')).toHaveCount(1)
})
