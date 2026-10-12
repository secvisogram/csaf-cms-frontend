import { getAppConfig } from './appConfig'

export type ApiError = {
  status: number
  message: string
  body: unknown
}

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiError }

const REDIRECT_GUARD_KEY = 'csaf-cms-frontend.auth-redirect-in-progress'

/** Navigates to login, coalescing concurrent/looping failures into a single navigation. */
async function redirectToLogin(): Promise<never> {
  if (!sessionStorage.getItem(REDIRECT_GUARD_KEY)) {
    sessionStorage.setItem(REDIRECT_GUARD_KEY, '1')
    let loginUrl: string
    try {
      ;({ loginUrl } = await getAppConfig())
    } catch (error) {
      // Without a login URL no navigation happens, so the guard must not stay set.
      sessionStorage.removeItem(REDIRECT_GUARD_KEY)
      throw error
    }
    const target = new URL(loginUrl, window.location.origin)
    target.searchParams.set('rd', window.location.href)
    window.location.href = target.href
  }
  // The page is navigating away; there is nothing meaningful to hand back to the caller.
  throw new Error('Session expired or missing; redirecting to login')
}

function toApiError(status: number, body: unknown): ApiError {
  const message =
    typeof body === 'object' &&
    body !== null &&
    'message' in body &&
    typeof (body as { message: unknown }).message === 'string'
      ? (body as { message: string }).message
      : `Request failed with status ${status}`
  return { status, message, body }
}

/** The backend enforces CSRF via a double-submit XSRF-TOKEN cookie on every non-GET/HEAD request. */
async function withCsrfHeader(
  init?: RequestInit,
): Promise<RequestInit | undefined> {
  const method = (init?.method ?? 'GET').toUpperCase()
  if (
    method === 'GET' ||
    method === 'HEAD' ||
    typeof document === 'undefined'
  ) {
    return init
  }

  let token = readXsrfToken()
  if (!token) {
    // A GET makes the backend set the cookie.
    await fetch('/api/v1/about')
    token = readXsrfToken()
  }
  if (!token) return init

  const headers = new Headers(init?.headers)
  headers.set('X-XSRF-TOKEN', token)
  return { ...init, headers }
}

function readXsrfToken(): string | undefined {
  const prefix = 'XSRF-TOKEN='
  const cookie = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(prefix))
  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : undefined
}

/**
 * Fetches an API endpoint. A 401/403, a network failure, or a body that is
 * neither JSON nor plain text (e.g. oauth2-proxy returning its HTML login
 * page) are all treated as an expired/missing session and redirect to login
 * instead of resolving. Every other non-2xx status resolves
 * `{ ok: false, error }` for the caller to handle. Plain-text bodies (the
 * backend returns the new revision that way) resolve as the raw string.
 */
export async function fetchApiOrRedirect<T>(
  path: string,
  init?: RequestInit,
): Promise<ApiResult<T>> {
  let response: Response
  try {
    response = await fetch(path, await withCsrfHeader(init))
  } catch {
    return redirectToLogin()
  }

  if (response.status === 401 || response.status === 403) {
    return redirectToLogin()
  }

  const text = await response.text()
  let body: unknown = null
  if (text.length > 0) {
    try {
      body = JSON.parse(text)
    } catch {
      if (!response.headers.get('content-type')?.startsWith('text/plain')) {
        return redirectToLogin()
      }
      body = text
    }
  }

  sessionStorage.removeItem(REDIRECT_GUARD_KEY)

  if (!response.ok) {
    return { ok: false, error: toApiError(response.status, body) }
  }
  return { ok: true, data: body as T }
}
