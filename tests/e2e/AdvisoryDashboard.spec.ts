import { expect, test } from '@playwright/test'

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
