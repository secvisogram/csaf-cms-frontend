import { expect, test, type Page, type Route } from '@playwright/test'

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
    allowedStateChanges: [
      'Review',
      'RfPublication',
      'AutoPublish',
      'Published',
    ],
  }

  /** The mocked list and detail reflect a state change once the PATCH succeeded, like the real backend. */
  async function mockWorkflowBackend(page: Page, patchStatus: number) {
    const calls: string[] = []
    let workflowState = 'Draft'
    await page
      .context()
      .addCookies([
        { name: 'XSRF-TOKEN', value: 'token', domain: 'localhost', path: '/' },
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
    expect(options).toEqual([
      '-- Choose --',
      'Review',
      'RfPublication',
      'AutoPublish',
      'Published',
    ])

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

  test('sends the tracking status and the prefilled release date when publishing', async ({
    page,
  }) => {
    const calls = await mockWorkflowBackend(page, 200)
    await page.goto('/')

    await page.getByRole('button', { name: 'Change state' }).click()
    const dialog = page.getByRole('dialog', { name: 'Change workflow state' })
    await dialog.getByLabel('New workflow state').selectOption('Published')
    await dialog.getByLabel('Document tracking status').selectOption('Final')
    await dialog.getByRole('button', { name: 'Change', exact: true }).click()

    await expect(dialog).not.toBeVisible()
    expect(calls[1]).toBe(
      'PATCH /api/v1/advisories/advisory-1/workflowstate/Published?revision=rev-2&documentTrackingStatus=Final&proposedTime=2024-01-15T00%3A00%3A00.000Z',
    )
  })

  test('sends the proposed time as an ISO UTC string for RfPublication', async ({
    page,
  }) => {
    const calls = await mockWorkflowBackend(page, 200)
    await page.goto('/')

    const row = page.getByRole('row', { name: /Buffer overflow in Foo/ })
    await row.getByRole('button', { name: 'Change state' }).click()
    const dialog = page.getByRole('dialog', { name: 'Change workflow state' })
    await dialog.getByLabel('New workflow state').selectOption('RfPublication')
    await dialog.getByLabel('Proposed time').fill('2030-05-06T07:08')
    await dialog.getByRole('button', { name: 'Change', exact: true }).click()

    await expect(row.getByText('RfPublication')).toBeVisible()
    const proposedTime = encodeURIComponent(
      await page.evaluate(() => new Date('2030-05-06T07:08').toISOString()),
    )
    expect(calls[1]).toBe(
      `PATCH /api/v1/advisories/advisory-1/workflowstate/RfPublication?revision=rev-2&proposedTime=${proposedTime}`,
    )
  })

  test('prefills the proposed time with the current release date', async ({
    page,
  }) => {
    await mockWorkflowBackend(page, 200)
    await page.goto('/')

    await page.getByRole('button', { name: 'Change state' }).click()
    const dialog = page.getByRole('dialog', { name: 'Change workflow state' })
    await dialog.getByLabel('New workflow state').selectOption('RfPublication')

    const expected = await page.evaluate(() => {
      const date = new Date('2024-01-15')
      const pad = (value: number) => String(value).padStart(2, '0')
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
    })
    await expect(dialog.getByLabel('Proposed time')).toHaveValue(expected)
  })

  test('offers no proposed time for AutoPublish', async ({ page }) => {
    await mockWorkflowBackend(page, 200)
    await page.goto('/')

    await page.getByRole('button', { name: 'Change state' }).click()
    const dialog = page.getByRole('dialog', { name: 'Change workflow state' })
    await dialog.getByLabel('New workflow state').selectOption('AutoPublish')

    await expect(dialog.getByLabel('Document tracking status')).toHaveCount(0)
    await expect(dialog.getByLabel('Proposed time')).toHaveCount(0)
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

const published = {
  advisoryId: 'advisory-3',
  workflowState: 'Published',
  documentTrackingId: 'CSAFPX-2024-003',
  title: 'Privilege escalation in Baz',
  owner: 'carol',
  changeable: false,
  deletable: false,
  canCreateVersion: true,
  allowedStateChanges: [],
  currentReleaseDate: '2024-03-10',
}

async function mockPublishedAdvisory(
  page: Page,
  onCreateVersion: (route: Route, revision: string | null) => Promise<void>,
) {
  await page
    .context()
    .addCookies([
      { name: 'XSRF-TOKEN', value: 'token', domain: 'localhost', path: '/' },
    ])
  const listRequests: string[] = []
  await page.route('**/api/v1/advisories', (route) => {
    listRequests.push(route.request().url())
    return route.fulfill({ json: [...advisories, published] })
  })
  await page.route('**/api/v1/advisories/advisory-3', (route) =>
    route.fulfill({
      json: { ...published, revision: 'rev-fresh', csaf: {} },
    }),
  )
  await page.route(
    '**/api/v1/advisories/advisory-3/createNewVersion**',
    (route) =>
      onCreateVersion(
        route,
        new URL(route.request().url()).searchParams.get('revision'),
      ),
  )
  return listRequests
}

test('shows Create new version only for advisories with canCreateVersion', async ({
  page,
}) => {
  await mockPublishedAdvisory(page, (route) => route.fulfill({ body: 'x' }))
  await page.goto('/')

  const button = page.getByRole('button', { name: 'Create new version' })
  await expect(button).toHaveCount(2)
  await expect(
    page
      .getByRole('row', { name: /Privilege escalation in Baz/ })
      .getByRole('button', { name: 'Create new version' }),
  ).toBeVisible()
  await expect(
    page
      .getByRole('row', { name: /Authentication bypass in Bar/ })
      .getByRole('button', { name: 'Create new version' }),
  ).toHaveCount(0)
})

test('creates a new version with a freshly fetched revision, shows a success toast and refreshes the list', async ({
  page,
}) => {
  let patchedRevision: string | null = null
  const listRequests = await mockPublishedAdvisory(
    page,
    async (route, revision) => {
      patchedRevision = revision
      expect(route.request().method()).toBe('PATCH')
      await route.fulfill({
        status: 200,
        contentType: 'text/plain',
        body: '2-new',
      })
    },
  )
  await page.goto('/')
  await expect.poll(() => listRequests.length).toBe(1)

  await page
    .getByRole('row', { name: /Privilege escalation in Baz/ })
    .getByRole('button', { name: 'Create new version' })
    .click()

  await expect(
    page.getByRole('status').filter({ hasText: 'New version created' }),
  ).toBeVisible()
  expect(patchedRevision).toBe('rev-fresh')
  await expect.poll(() => listRequests.length).toBe(2)
  await expect(page).toHaveURL('/')
})

test('shows an error toast and does not refresh the list when creating a new version fails', async ({
  page,
}) => {
  const listRequests = await mockPublishedAdvisory(page, (route) =>
    route.fulfill({ status: 409, json: { message: 'conflict' } }),
  )
  await page.goto('/')
  await expect.poll(() => listRequests.length).toBe(1)

  await page
    .getByRole('row', { name: /Privilege escalation in Baz/ })
    .getByRole('button', { name: 'Create new version' })
    .click()

  await expect(
    page
      .getByRole('status')
      .filter({ hasText: 'Could not create a new version' }),
  ).toBeVisible()
  await expect(
    page.getByRole('status').filter({ hasText: 'New version created' }),
  ).toHaveCount(0)
  expect(listRequests).toHaveLength(1)
  await expect(page).toHaveURL('/')
  await expect(
    page.getByRole('row', { name: /Privilege escalation in Baz/ }),
  ).toBeVisible()
})

test('shows an Edit link in the Actions column only for changeable advisories', async ({
  page,
}) => {
  await page.goto('/')

  await expect(
    page.getByRole('columnheader', { name: 'Actions' }),
  ).toBeVisible()

  const editable = page.getByRole('row', { name: /Buffer overflow in Foo/ })
  const readOnly = page.getByRole('row', {
    name: /Authentication bypass in Bar/,
  })
  await expect(editable.getByRole('link', { name: 'Edit' })).toBeVisible()
  await expect(readOnly.getByRole('link', { name: 'Edit' })).toHaveCount(0)
})

test('the Edit link opens the advisory edit page', async ({ page }) => {
  await page.goto('/')

  await page
    .getByRole('row', { name: /Buffer overflow in Foo/ })
    .getByRole('link', { name: 'Edit' })
    .click()

  await expect(page).toHaveURL('/advisory-1/edit')
})

test('clicking a row opens its edit page for read-only advisories too', async ({
  page,
}) => {
  await page.route('**/api/v1/advisories/advisory-2', (route) =>
    route.fulfill({
      json: {
        ...advisories[1],
        revision: 'rev-1',
        csaf: { document: { csaf_version: '2.1' } },
      },
    }),
  )
  await page.goto('/')

  await page
    .getByRole('row', { name: /Authentication bypass in Bar/ })
    .getByRole('link', { name: 'Authentication bypass in Bar' })
    .click()

  await expect(page).toHaveURL('/advisory-2/edit')
})

test('the Actions column header is not a sort control and is not filtered', async ({
  page,
}) => {
  await page.goto('/')

  const header = page.getByRole('columnheader', { name: 'Actions' })
  await expect(header.getByRole('button')).toHaveCount(0)

  await header.click()
  const rows = page.getByRole('row')
  await expect(rows.nth(1)).toContainText('Buffer overflow in Foo')
  await expect(rows.nth(2)).toContainText('Authentication bypass in Bar')

  await page.getByRole('textbox', { name: 'Filter advisories' }).fill('Edit')
  await expect(page.getByRole('row')).toHaveCount(1)
})

test('hides the New button for users without the author group', async ({
  page,
}) => {
  await page.route('**/oauth2/userinfo', (route) =>
    route.fulfill({ json: { groups: [] } }),
  )
  await page.goto('/')

  await expect(
    page.getByRole('heading', { name: 'Advisory Dashboard' }),
  ).toBeVisible()
  await expect(page.getByTestId('new_document_button')).toHaveCount(0)
})

test('shows the New button for users in the author group', async ({ page }) => {
  await page.route('**/oauth2/userinfo', (route) =>
    route.fulfill({ json: { groups: ['author'] } }),
  )
  await page.goto('/')

  await expect(page.getByTestId('new_document_button')).toHaveText('New')
})
