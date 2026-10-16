import { expect, test } from '@playwright/test'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const EDITOR_TREE = 'build/client/secvisogram-editor'

function listFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? listFiles(join(dir, entry.name))
      : [join(dir, entry.name)],
  )
}

test('every file of the editor asset tree is served with 200', async ({
  request,
}) => {
  const paths = listFiles(EDITOR_TREE).map(
    (file) => '/secvisogram-editor/' + relative(EDITOR_TREE, file),
  )
  expect(paths.length).toBeGreaterThan(0)

  const failures: string[] = []
  for (let i = 0; i < paths.length; i += 50) {
    await Promise.all(
      paths.slice(i, i + 50).map(async (path) => {
        const response = await request.get(encodeURI(path))
        if (response.status() !== 200) {
          failures.push(`${response.status()} ${path}`)
        }
      }),
    )
  }
  expect(failures).toEqual([])
})

test('the served editor is the version built into this checkout', async ({
  request,
}) => {
  const response = await request.get('/secvisogram-editor/VERSION')

  expect(response.status()).toBe(200)
  expect(await response.text()).toBe(
    readFileSync(join(EDITOR_TREE, 'VERSION'), 'utf8'),
  )
})

test('a missing editor asset is a 404, not the app shell', async ({
  request,
}) => {
  const response = await request.get('/secvisogram-editor/does-not-exist.js')

  expect(response.status()).toBe(404)
})

test('a deep link returns the same app shell as the root URL', async ({
  request,
}) => {
  const root = await request.get('/')
  const deepLink = await request.get('/some-advisory-id/edit')

  expect(root.status()).toBe(200)
  expect(deepLink.status()).toBe(200)
  expect(deepLink.headers()['content-type']).toContain('text/html')
  expect(await deepLink.text()).toBe(await root.text())
})

test('the app config advertises login on the configured origin', async ({
  request,
  baseURL,
}) => {
  const response = await request.get(
    '/.well-known/appspecific/de.bsi.secvisogram.json',
  )
  expect(response.status()).toBe(200)

  const config = await response.json()
  const origin = new URL(baseURL!).origin
  expect(config.loginAvailable).toBe(true)
  expect(new URL(config.loginUrl).origin).toBe(origin)
  expect(new URL(config.userInfoUrl).origin).toBe(origin)
  expect(new URL(config.logoutUrl).origin).toBe(origin)
  expect(config.validatorUrl).toBe('/validate')
})

for (const path of [
  '/',
  '/some-advisory-id/edit',
  '/secvisogram-editor/VERSION',
  '/secvisogram-editor/does-not-exist.js',
  '/.well-known/appspecific/de.bsi.secvisogram.json',
]) {
  test(`${path} carries the transport and security headers`, async ({
    request,
  }) => {
    const headers = (await request.get(path)).headers()

    expect(headers['strict-transport-security']).toMatch(/max-age=\d+/)
    expect(headers['x-frame-options']).toBe('DENY')
    expect(headers['content-security-policy']).toContain(
      "frame-ancestors 'none'",
    )
    expect(headers['x-content-type-options']).toBe('nosniff')
  })
}

test('the real editor loads under the CSP without violations', async ({
  page,
}) => {
  await page.route('**/oauth2/userinfo', (route) =>
    route.fulfill({ json: { groups: ['editor'] } }),
  )
  await page.route('**/api/v1/advisories/some-advisory-id', (route) =>
    route.fulfill({
      json: {
        advisoryId: 'some-advisory-id',
        revision: 'rev-1',
        csaf: { document: { csaf_version: '2.0', title: 'Example advisory' } },
      },
    }),
  )
  const problems: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(message.text())
  })
  page.on('requestfailed', (request) => problems.push(request.url()))

  await page.goto('/some-advisory-id/edit')

  await expect(page.locator('secvisogram-editor')).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document
            .querySelector('secvisogram-editor')
            ?.shadowRoot?.textContent?.includes('Form Editor') ?? false,
      ),
    )
    .toBe(true)
  expect(problems).toEqual([])
})
