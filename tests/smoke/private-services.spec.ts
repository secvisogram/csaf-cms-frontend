import { expect, test } from '@playwright/test'

// Needs the private services behind the edge (see README, "Edge in front of the development
// Compose stack").

const MINIMAL_DOCUMENT = { document: { csaf_version: '2.0' } }

test('a validator round-trip through the edge returns a validation result', async ({
  request,
}) => {
  const tests = await request.get('/validate/api/v1/tests')
  expect(tests.status()).toBe(200)
  expect(await tests.json()).toContainEqual(
    expect.objectContaining({ name: 'csaf_2_0' }),
  )

  const response = await request.post('/validate/api/v1/validate', {
    data: {
      tests: [{ type: 'test', name: 'csaf_2_0' }],
      document: MINIMAL_DOCUMENT,
    },
  })
  expect(response.status()).toBe(200)
  const result = await response.json()
  expect(result.isValid).toBe(false)
  expect(result.tests).toEqual([
    expect.objectContaining({ name: 'csaf_2_0', isValid: false }),
  ])
})

test('validator paths other than tests and validate are not proxied', async ({
  request,
}) => {
  const response = await request.get('/validate/health')

  expect(response.headers()['content-type']).toContain('text/html')
  expect(await response.text()).toContain('<!DOCTYPE html>')
})

test('the csaf realm is reachable on the edge origin', async ({
  request,
  baseURL,
}) => {
  const response = await request.get(
    '/realms/csaf/.well-known/openid-configuration',
  )
  expect(response.status()).toBe(200)

  const configuration = await response.json()
  const origin = new URL(baseURL!).origin
  expect(configuration.issuer).toBe(`${origin}/realms/csaf`)
  expect(new URL(configuration.authorization_endpoint).origin).toBe(origin)
})

test('the csaf login page renders under its own CSP without errors', async ({
  page,
}) => {
  const problems: string[] = []
  const resources: number[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(message.text())
  })
  page.on('requestfailed', (request) => problems.push(request.url()))
  page.on('response', (response) => {
    if (new URL(response.url()).pathname.startsWith('/resources/')) {
      resources.push(response.status())
    }
  })

  await page.goto('/oauth2/start?rd=/')

  await expect(page).toHaveURL(/\/realms\/csaf\//)
  await expect(page.locator('input[name="username"]')).toBeVisible()
  expect(resources.length).toBeGreaterThan(0)
  expect(resources.filter((status) => status !== 200)).toEqual([])
  expect(problems).toEqual([])
})

for (const path of [
  '/admin/',
  '/admin/master/console/',
  '/realms/master/',
  '/realms/master/.well-known/openid-configuration',
]) {
  test(`${path} is not reachable through the edge`, async ({ request }) => {
    const response = await request.get(path)

    expect(response.status()).toBe(404)
  })
}

test('an unauthenticated API request is answered by oauth2-proxy', async ({
  request,
}) => {
  const response = await request.get('/api/v1/advisories', {
    headers: { accept: 'application/json' },
    maxRedirects: 0,
  })

  expect(response.status()).toBe(401)
})

test('oauth2 paths reach oauth2-proxy with the public host and scheme', async ({
  request,
  baseURL,
}) => {
  const response = await request.get('/oauth2/start?rd=/', {
    maxRedirects: 0,
  })

  expect(response.status()).toBe(302)
  const location = new URL(response.headers()['location']!)
  const origin = new URL(baseURL!).origin
  expect(location.origin).toBe(origin)
  expect(location.pathname).toMatch(/^\/realms\/csaf\//)
  expect(location.searchParams.get('redirect_uri')).toBe(
    `${origin}/oauth2/callback`,
  )
})
