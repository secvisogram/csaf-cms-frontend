import { getAppConfig } from './appConfig'

export type ApiError = {
  status: number
  message: string
  body: unknown
}

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiError }

let redirectTransition: Promise<never> | undefined

/** Navigates to login once and shares the in-progress transition with all callers. */
function redirectToLogin(): Promise<never> {
  if (redirectTransition) return redirectTransition

  let rejectTransition!: (error: unknown) => void
  const transition = new Promise<never>((_resolve, reject) => {
    rejectTransition = reject
  })
  redirectTransition = transition

  return getAppConfig()
    .then(({ loginUrl }) => {
      const target = new URL(loginUrl, window.location.origin)
      target.searchParams.set('rd', window.location.href)
      window.location.href = target.href
      // Navigation is in progress; all callers remain pending until the page unloads.
      return new Promise<never>(() => {})
    })
    .catch((error) => {
      // A failure before navigation leaves the app usable; allow a later request to retry.
      if (redirectTransition === transition) redirectTransition = undefined
      rejectTransition(error)
      return transition
    })
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
 * Fetches an API endpoint. A 401, or a successful (2xx) response whose body is
 * neither JSON nor plain text (e.g. oauth2-proxy returning its HTML login
 * page), is treated as an expired/missing session and redirects to login
 * instead of resolving. Every non-2xx status (including 403 and edge-generated
 * HTML errors such as 413/502/504) resolves `{ ok: false, error }` for the
 * caller to handle; non-JSON bodies are preserved as raw text in `error.body`.
 * Rejected fetches (API or CSRF-cookie lookup) reject without redirecting.
 * Plain-text bodies (the backend returns the new revision that way) resolve as
 * the raw string.
 */
export async function fetchApiOrRedirect<T>(
  path: string,
  init?: RequestInit,
): Promise<ApiResult<T>> {
  if (redirectTransition) return redirectTransition

  const requestInit = await withCsrfHeader(init)
  if (redirectTransition) return redirectTransition
  const response = await fetch(path, requestInit)

  if (response.status === 401) {
    return redirectToLogin()
  }

  const text = await response.text()
  let body: unknown = null
  if (text.length > 0) {
    try {
      body = JSON.parse(text)
    } catch {
      if (
        response.ok &&
        !response.headers.get('content-type')?.startsWith('text/plain')
      ) {
        return redirectToLogin()
      }
      body = text
    }
  }

  if (!response.ok) {
    return { ok: false, error: toApiError(response.status, body) }
  }
  return { ok: true, data: body as T }
}
