import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeStorage } from '~/testing/fakeStorage'

let fetchApiOrRedirect: typeof import('./session').fetchApiOrRedirect

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
    vi.stubGlobal('sessionStorage', fakeStorage())
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

  it('redirects to login on a 401 response instead of resolving', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).includes('.well-known')) {
          return configResponse('/oauth2/sign_in')
        }
        return new Response(null, { status: 401 })
      }),
    )

    await expect(fetchApiOrRedirect('/api/v1/advisories/1')).rejects.toThrow()

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
      vi.fn(async () => {
        throw new Error('network down')
      }),
    )

    await expect(fetchApiOrRedirect('/api/v1/advisories/1')).rejects.toThrow(
      'network down',
    )
    expect(currentHref()).toBe('https://cms.example/some/page')
    expect(
      sessionStorage.getItem('csaf-cms-frontend.auth-redirect-in-progress'),
    ).toBeNull()
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

    await expect(fetchApiOrRedirect('/api/v1/advisories/1')).rejects.toThrow(
      'redirecting to login',
    )
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

  it('does not leave the loop guard set when the app-config cannot be loaded', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) =>
        String(input).includes('.well-known')
          ? new Response(null, { status: 500 })
          : new Response(null, { status: 401 }),
      ),
    )

    await expect(fetchApiOrRedirect('/api/v1/advisories/1')).rejects.toThrow()

    expect(
      sessionStorage.getItem('csaf-cms-frontend.auth-redirect-in-progress'),
    ).toBeNull()
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

  it('only navigates once when multiple calls hit a redirect condition (loop guard)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).includes('.well-known')) {
          return configResponse('/login')
        }
        return new Response(null, { status: 401 })
      }),
    )

    await fetchApiOrRedirect('/api/v1/advisories/1').catch(() => {})
    const hrefAfterFirst = (window as unknown as { location: { href: string } })
      .location.href

    await fetchApiOrRedirect('/api/v1/advisories/2').catch(() => {})
    const hrefAfterSecond = (
      window as unknown as { location: { href: string } }
    ).location.href

    expect(hrefAfterFirst).toBe(hrefAfterSecond)
  })

  it('clears the redirect guard after a subsequent successful call', async () => {
    let call = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).includes('.well-known')) {
          return configResponse('/login')
        }
        call += 1
        return call === 1
          ? new Response(null, { status: 401 })
          : new Response(JSON.stringify({ ok: true }), { status: 200 })
      }),
    )

    await fetchApiOrRedirect('/api/v1/advisories/1').catch(() => {})
    await fetchApiOrRedirect('/api/v1/advisories/2')

    expect(
      sessionStorage.getItem('csaf-cms-frontend.auth-redirect-in-progress'),
    ).toBeNull()
  })
})
