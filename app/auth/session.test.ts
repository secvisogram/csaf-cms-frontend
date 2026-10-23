import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let fetchApiOrRedirect: typeof import('./session').fetchApiOrRedirect

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

async function expectPending(promise: Promise<unknown>) {
  const outcome = await Promise.race([
    promise.then(
      () => 'resolved' as const,
      () => 'rejected' as const,
    ),
    new Promise<'pending'>((resolve) =>
      setTimeout(() => resolve('pending'), 0),
    ),
  ])
  expect(outcome).toBe('pending')
}

function configResponse(loginUrl: string) {
  return new Response(
    JSON.stringify({
      loginUrl,
      logoutUrl: '/oauth2/sign_out',
      userInfoUrl: '/oauth2/userinfo',
    }),
    { status: 200 },
  )
}

function currentHref(): string {
  return (window as unknown as { location: { href: string } }).location.href
}

describe('fetchApiOrRedirect', () => {
  // A fresh module graph per test gives an empty app-config cache.
  beforeEach(async () => {
    vi.resetModules()
    ;({ fetchApiOrRedirect } = await import('./session'))
    vi.stubGlobal('window', {
      location: {
        origin: 'https://cms.example',
        href: 'https://cms.example/some/page',
      },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('resolves { ok: true, data } for a successful response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ hello: 'world' }), { status: 200 }),
      ),
    )

    await expect(fetchApiOrRedirect('/api/v1/about')).resolves.toEqual({
      ok: true,
      data: { hello: 'world' },
    })
  })

  it('resolves { ok: true, data: null } for an empty-body response (e.g. 204)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 204 })),
    )

    await expect(fetchApiOrRedirect('/api/v1/advisories/1')).resolves.toEqual({
      ok: true,
      data: null,
    })
  })

  it('resolves { ok: false, error } for a non-2xx status without redirecting', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ message: 'stale revision' }), {
            status: 409,
          }),
      ),
    )

    await expect(fetchApiOrRedirect('/api/v1/advisories/1')).resolves.toEqual({
      ok: false,
      error: {
        status: 409,
        message: 'stale revision',
        body: { message: 'stale revision' },
      },
    })
    expect(
      (window as unknown as { location: { href: string } }).location.href,
    ).toBe('https://cms.example/some/page')
  })

  it('redirects to login on a 401 response and keeps the call pending', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).includes('.well-known')) {
          return configResponse('/oauth2/sign_in')
        }
        return new Response(null, { status: 401 })
      }),
    )

    await expectPending(fetchApiOrRedirect('/api/v1/advisories/1'))

    expect(currentHref()).toBe(
      'https://cms.example/oauth2/sign_in?rd=https%3A%2F%2Fcms.example%2Fsome%2Fpage',
    )
  })

  it('resolves a 403 as an API error without redirecting', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 403 })),
    )

    await expect(fetchApiOrRedirect('/api/v1/advisories/1')).resolves.toEqual({
      ok: false,
      error: {
        status: 403,
        message: 'Request failed with status 403',
        body: null,
      },
    })
    expect(currentHref()).toBe('https://cms.example/some/page')
  })

  it.each([413, 502, 504])(
    'resolves a %d HTML response as an API error with the raw text in error.body',
    async (status) => {
      const html = `<html><body>Error ${status}</body></html>`
      vi.stubGlobal(
        'fetch',
        vi.fn(
          async () =>
            new Response(html, {
              status,
              headers: { 'Content-Type': 'text/html' },
            }),
        ),
      )

      await expect(fetchApiOrRedirect('/api/v1/advisories/1')).resolves.toEqual(
        {
          ok: false,
          error: {
            status,
            message: `Request failed with status ${status}`,
            body: html,
          },
        },
      )
      expect(currentHref()).toBe('https://cms.example/some/page')
    },
  )

  it('rejects without redirecting when the fetch itself fails (network error)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).includes('.well-known')) {
          return configResponse('/oauth2/sign_in')
        }
        throw new Error('network down')
      }),
    )

    await expect(fetchApiOrRedirect('/api/v1/advisories/1')).rejects.toThrow(
      'network down',
    )
    expect(currentHref()).toBe('https://cms.example/some/page')
  })

  it('redirects to login when a 2xx response body is not valid JSON or plain text', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).includes('.well-known')) {
          return configResponse('/oauth2/sign_in')
        }
        return new Response('<html>login page</html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html' },
        })
      }),
    )

    await expectPending(fetchApiOrRedirect('/api/v1/advisories/1'))
    expect(currentHref()).toBe(
      'https://cms.example/oauth2/sign_in?rd=https%3A%2F%2Fcms.example%2Fsome%2Fpage',
    )
  })

  it('resolves a plain-text body as the raw string (new revision responses)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response('3-abc123', {
            status: 200,
            headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
          }),
      ),
    )

    await expect(fetchApiOrRedirect('/api/v1/advisories/1')).resolves.toEqual({
      ok: true,
      data: '3-abc123',
    })
  })

  it('rejects when app config cannot be loaded so a later request can retry', async () => {
    let configCalls = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).includes('.well-known')) {
          configCalls += 1
          return configCalls === 1
            ? new Response(null, { status: 500 })
            : configResponse('/login')
        }
        return new Response(null, { status: 401 })
      }),
    )

    await expect(fetchApiOrRedirect('/api/v1/advisories/1')).rejects.toThrow()
    await expectPending(fetchApiOrRedirect('/api/v1/advisories/2'))
    expect(configCalls).toBe(2)
  })

  describe('CSRF', () => {
    it('adds the XSRF token header to non-GET requests', async () => {
      vi.stubGlobal('document', { cookie: 'a=b; XSRF-TOKEN=tok%3D1' })
      const fetchMock = vi.fn(
        async (_input: RequestInfo | URL, _init?: RequestInit) =>
          new Response(JSON.stringify({}), { status: 200 }),
      )
      vi.stubGlobal('fetch', fetchMock)

      await fetchApiOrRedirect('/api/v1/advisories/1', { method: 'DELETE' })

      const init = fetchMock.mock.calls[0]![1]
      expect(new Headers(init?.headers).get('X-XSRF-TOKEN')).toBe('tok=1')
    })

    it('does not add the header to GET requests', async () => {
      vi.stubGlobal('document', { cookie: 'XSRF-TOKEN=tok' })
      const fetchMock = vi.fn(
        async () => new Response(JSON.stringify({}), { status: 200 }),
      )
      vi.stubGlobal('fetch', fetchMock)

      await fetchApiOrRedirect('/api/v1/advisories/1')

      expect(fetchMock).toHaveBeenCalledWith('/api/v1/advisories/1', undefined)
    })

    it('fetches /about to obtain the cookie when it is missing', async () => {
      const doc = { cookie: '' }
      vi.stubGlobal('document', doc)
      const fetchMock = vi.fn(
        async (input: RequestInfo | URL, _init?: RequestInit) => {
          if (String(input) === '/api/v1/about') {
            doc.cookie = 'XSRF-TOKEN=fresh'
          }
          return new Response(JSON.stringify({}), { status: 200 })
        },
      )
      vi.stubGlobal('fetch', fetchMock)

      await fetchApiOrRedirect('/api/v1/advisories', { method: 'POST' })

      expect(fetchMock.mock.calls[0]![0]).toBe('/api/v1/about')
      const init = fetchMock.mock.calls[1]![1]
      expect(new Headers(init?.headers).get('X-XSRF-TOKEN')).toBe('fresh')
    })

    it('rejects without sending the mutation or redirecting when the cookie lookup fails', async () => {
      vi.stubGlobal('document', { cookie: '' })
      const fetchMock = vi.fn(
        async (_input: RequestInfo | URL, _init?: RequestInit) => {
          throw new Error('about unreachable')
        },
      )
      vi.stubGlobal('fetch', fetchMock)

      await expect(
        fetchApiOrRedirect('/api/v1/advisories', { method: 'POST' }),
      ).rejects.toThrow('about unreachable')

      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(fetchMock.mock.calls[0]![0]).toBe('/api/v1/about')
      expect(currentHref()).toBe('https://cms.example/some/page')
    })

    it('sends the mutation without the header when no token is available and returns a 403 as an API error', async () => {
      vi.stubGlobal('document', { cookie: '' })
      const fetchMock = vi.fn(
        async (input: RequestInfo | URL, _init?: RequestInit) =>
          String(input) === '/api/v1/about'
            ? new Response(JSON.stringify({}), { status: 200 })
            : new Response(null, { status: 403 }),
      )
      vi.stubGlobal('fetch', fetchMock)

      await expect(
        fetchApiOrRedirect('/api/v1/advisories', { method: 'POST' }),
      ).resolves.toEqual({
        ok: false,
        error: {
          status: 403,
          message: 'Request failed with status 403',
          body: null,
        },
      })

      expect(fetchMock).toHaveBeenCalledTimes(2)
      const init = fetchMock.mock.calls[1]![1]
      expect(new Headers(init?.headers).has('X-XSRF-TOKEN')).toBe(false)
      expect(currentHref()).toBe('https://cms.example/some/page')
    })

    it('rejects without redirecting when the mutation fetch fails after a successful lookup', async () => {
      vi.stubGlobal('document', { cookie: 'XSRF-TOKEN=tok' })
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          throw new Error('network down')
        }),
      )

      await expect(
        fetchApiOrRedirect('/api/v1/advisories', { method: 'POST' }),
      ).rejects.toThrow('network down')
      expect(currentHref()).toBe('https://cms.example/some/page')
    })
  })

  it('coordinates concurrent redirect conditions into one config lookup and navigation', async () => {
    const location = (window as unknown as { location: { href: string } })
      .location
    let assignedHref = location.href
    let navigationAssignments = 0
    Object.defineProperty(location, 'href', {
      configurable: true,
      get: () => assignedHref,
      set: (href: string) => {
        navigationAssignments += 1
        assignedHref = href
      },
    })

    const config = deferred<Response>()
    let configRequested!: () => void
    const configStarted = new Promise<void>((resolve) => {
      configRequested = resolve
    })
    let apiCalls = 0
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes('.well-known')) {
        configRequested()
        return config.promise
      }
      apiCalls += 1
      return new Response(null, { status: 401 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const first = fetchApiOrRedirect('/api/v1/advisories/1')
    const second = fetchApiOrRedirect('/api/v1/advisories/2')
    await configStarted
    config.resolve(configResponse('/login'))

    await Promise.all([expectPending(first), expectPending(second)])
    expect(apiCalls).toBe(2)
    expect(
      fetchMock.mock.calls.filter(([input]) =>
        String(input).includes('.well-known'),
      ),
    ).toHaveLength(1)
    expect(navigationAssignments).toBe(1)
    expect(
      (window as unknown as { location: { href: string } }).location.href,
    ).toBe(
      'https://cms.example/login?rd=https%3A%2F%2Fcms.example%2Fsome%2Fpage',
    )
  })

  it('blocks API and CSRF warm-up requests while redirecting', async () => {
    const config = deferred<Response>()
    let configRequested!: () => void
    const configStarted = new Promise<void>((resolve) => {
      configRequested = resolve
    })
    vi.stubGlobal('document', { cookie: '' })
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes('.well-known')) {
        configRequested()
        return config.promise
      }
      return new Response(null, { status: 401 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const redirecting = fetchApiOrRedirect('/api/v1/advisories/1')
    await configStarted
    const callsBeforeJoin = fetchMock.mock.calls.length
    const joining = fetchApiOrRedirect('/api/v1/advisories', { method: 'POST' })
    await Promise.resolve()
    expect(fetchMock).toHaveBeenCalledTimes(callsBeforeJoin)

    config.resolve(configResponse('/login'))
    await Promise.all([expectPending(redirecting), expectPending(joining)])

    const callsAfterNavigation = fetchMock.mock.calls.length
    const afterNavigation = fetchApiOrRedirect('/api/v1/advisories', {
      method: 'POST',
    })
    await expectPending(afterNavigation)
    expect(fetchMock).toHaveBeenCalledTimes(callsAfterNavigation)
  })

  it('blocks a mutation when redirect starts during its CSRF warm-up', async () => {
    const warmup = deferred<Response>()
    let warmupRequested!: () => void
    const warmupStarted = new Promise<void>((resolve) => {
      warmupRequested = resolve
    })
    const config = deferred<Response>()
    let configRequested!: () => void
    const configStarted = new Promise<void>((resolve) => {
      configRequested = resolve
    })
    vi.stubGlobal('document', { cookie: '' })
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/api/v1/about') {
        warmupRequested()
        return warmup.promise
      }
      if (url.includes('.well-known')) {
        configRequested()
        return config.promise
      }
      if (url === '/api/v1/advisories/redirect') {
        return new Response(null, { status: 401 })
      }
      return new Response(null, { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const mutation = fetchApiOrRedirect('/api/v1/advisories/1', {
      method: 'POST',
    })
    await warmupStarted

    const redirecting = fetchApiOrRedirect('/api/v1/advisories/redirect')
    await configStarted
    config.resolve(configResponse('/login'))
    await expectPending(redirecting)

    warmup.resolve(new Response(null, { status: 200 }))
    await expectPending(mutation)
    expect(fetchMock).not.toHaveBeenCalledWith(
      '/api/v1/advisories/1',
      expect.anything(),
    )
  })

  it('does not clear a redirect transition when an already-sent request succeeds', async () => {
    const alreadySentResponse = deferred<Response>()
    const config = deferred<Response>()
    let configRequested!: () => void
    const configStarted = new Promise<void>((resolve) => {
      configRequested = resolve
    })
    let apiCalls = 0
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes('.well-known')) {
        configRequested()
        return config.promise
      }
      apiCalls += 1
      return String(input).endsWith('/slow')
        ? alreadySentResponse.promise
        : new Response(null, { status: 401 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const redirecting = fetchApiOrRedirect('/api/v1/advisories/1')
    const alreadySent = fetchApiOrRedirect('/api/v1/slow')
    await configStarted
    config.resolve(configResponse('/login'))
    await expectPending(redirecting)
    alreadySentResponse.resolve(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    )
    await expect(alreadySent).resolves.toEqual({
      ok: true,
      data: { ok: true },
    })

    const callsAfterSuccess = fetchMock.mock.calls.length
    await expectPending(fetchApiOrRedirect('/api/v1/advisories/3'))
    expect(fetchMock).toHaveBeenCalledTimes(callsAfterSuccess)
    expect(apiCalls).toBe(2)
  })

  it('rejects all transition callers on config failure and resets for retry', async () => {
    const config = deferred<Response>()
    let configRequested!: () => void
    const configStarted = new Promise<void>((resolve) => {
      configRequested = resolve
    })
    let configCalls = 0
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes('.well-known')) {
        configCalls += 1
        if (configCalls === 1) {
          configRequested()
          return config.promise
        }
        return configResponse('/login')
      }
      return new Response(null, { status: 401 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const first = fetchApiOrRedirect('/api/v1/advisories/1')
    const second = fetchApiOrRedirect('/api/v1/advisories/2')
    await configStarted
    config.resolve(new Response(null, { status: 500 }))
    await expect(Promise.allSettled([first, second])).resolves.toEqual([
      expect.objectContaining({ status: 'rejected' }),
      expect.objectContaining({ status: 'rejected' }),
    ])

    await expectPending(fetchApiOrRedirect('/api/v1/advisories/3'))
    expect(configCalls).toBe(2)
  })
})
