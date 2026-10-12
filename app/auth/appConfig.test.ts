import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let getAppConfig: typeof import('./appConfig').getAppConfig
let AppConfigError: typeof import('./appConfig').AppConfigError

const validConfig = {
  loginUrl: '/oauth2/sign_in',
  logoutUrl: '/oauth2/sign_out',
  userInfoUrl: '/oauth2/userinfo',
}

function stubConfigResponse(body: unknown, status = 200) {
  const fetchMock = vi.fn(
    async () => new Response(JSON.stringify(body), { status }),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('getAppConfig', () => {
  // A fresh module instance per test gives an empty app-config cache.
  beforeEach(async () => {
    vi.resetModules()
    ;({ getAppConfig, AppConfigError } = await import('./appConfig'))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('resolves the parsed config on a successful fetch', async () => {
    stubConfigResponse({
      ...validConfig,
      validatorUrl: 'https://validator.example',
      keyBindings: { save: 'Ctrl+S' },
    })

    await expect(getAppConfig()).resolves.toEqual({
      ...validConfig,
      validatorUrl: 'https://validator.example',
      keyBindings: { save: 'Ctrl+S' },
    })
  })

  it('ignores loginAvailable', async () => {
    stubConfigResponse({ ...validConfig, loginAvailable: false })

    await expect(getAppConfig()).resolves.toEqual(validConfig)
  })

  it('rejects with an AppConfigError when the fetch itself fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down')
      }),
    )

    await expect(getAppConfig()).rejects.toBeInstanceOf(AppConfigError)
  })

  it('rejects with an AppConfigError on a non-OK response', async () => {
    stubConfigResponse({ message: 'not found' }, 404)

    await expect(getAppConfig()).rejects.toBeInstanceOf(AppConfigError)
  })

  it('rejects with an AppConfigError when the body is not valid JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('<html></html>', { status: 200 })),
    )

    await expect(getAppConfig()).rejects.toBeInstanceOf(AppConfigError)
  })

  it.each(['loginUrl', 'logoutUrl', 'userInfoUrl'] as const)(
    'rejects with an AppConfigError when %s is missing',
    async (key) => {
      stubConfigResponse({ ...validConfig, [key]: undefined })

      await expect(getAppConfig()).rejects.toBeInstanceOf(AppConfigError)
    },
  )

  it.each(['loginUrl', 'logoutUrl', 'userInfoUrl'] as const)(
    'rejects with an AppConfigError when %s is empty',
    async (key) => {
      stubConfigResponse({ ...validConfig, [key]: '' })

      await expect(getAppConfig()).rejects.toBeInstanceOf(AppConfigError)
    },
  )

  it('caches a successful result across calls instead of fetching every time', async () => {
    const fetchMock = stubConfigResponse(validConfig)

    await getAppConfig()
    await getAppConfig()

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not cache a failure, so a retry refetches', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('boom', { status: 500 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify(validConfig), { status: 200 }),
      )
    vi.stubGlobal('fetch', fetchMock)

    await expect(getAppConfig()).rejects.toBeInstanceOf(AppConfigError)
    await expect(getAppConfig()).resolves.toEqual(validConfig)
  })
})
