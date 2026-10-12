export type AppConfig = {
  loginUrl: string
  logoutUrl: string
  userInfoUrl: string
  validatorUrl?: string
  keyBindings?: Record<string, unknown>
}

/** The app-config could not be loaded or is unusable; a deployment error, not a user state. */
export class AppConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AppConfigError'
  }
}

const APP_CONFIG_URL = '/.well-known/appspecific/de.bsi.secvisogram.json'

let cachedAppConfig: Promise<AppConfig> | undefined

function requireUrl(raw: Record<string, unknown>, key: string): string {
  const value = raw[key]
  if (typeof value !== 'string' || value.length === 0) {
    throw new AppConfigError(`app config is missing "${key}"`)
  }
  return value
}

async function loadAppConfig(): Promise<AppConfig> {
  let response: Response
  try {
    response = await fetch(APP_CONFIG_URL)
  } catch {
    throw new AppConfigError('app config fetch failed')
  }
  if (!response.ok) {
    throw new AppConfigError(
      `app config fetch failed with status ${response.status}`,
    )
  }

  let raw: unknown
  try {
    raw = await response.json()
  } catch {
    throw new AppConfigError('app config is not valid JSON')
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new AppConfigError('app config is not a JSON object')
  }

  const config = raw as Record<string, unknown>
  return {
    loginUrl: requireUrl(config, 'loginUrl'),
    logoutUrl: requireUrl(config, 'logoutUrl'),
    userInfoUrl: requireUrl(config, 'userInfoUrl'),
    ...(typeof config.validatorUrl === 'string' && {
      validatorUrl: config.validatorUrl,
    }),
    ...(typeof config.keyBindings === 'object' &&
      config.keyBindings !== null && {
        keyBindings: config.keyBindings as Record<string, unknown>,
      }),
  }
}

/** Rejects with `AppConfigError` on any failure; failures are not cached, so a retry refetches. */
export function getAppConfig(): Promise<AppConfig> {
  cachedAppConfig ??= loadAppConfig().catch((error: unknown) => {
    cachedAppConfig = undefined
    throw error
  })
  return cachedAppConfig
}

/** Test-only: clears the module-level cache so each test starts from a clean state. */
export function resetAppConfigCache(): void {
  cachedAppConfig = undefined
}
