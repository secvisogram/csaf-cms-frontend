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
      { name: 'XSRF-TOKEN', value: 'token', url: 'http://localhost:5173' },
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
