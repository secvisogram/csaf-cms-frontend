import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from 'react-router'
import { useTranslation } from 'react-i18next'

import { AppConfigError, getAppConfig } from '~/auth/appConfig'
import { fetchApiOrRedirect } from '~/auth/session'
import '~/i18n/i18n'
import { NotificationProvider } from '~/notifications/NotificationContext'
import type { Route } from './+types/root'
import './app.css'

export type UserInfo = {
  groups: string[]
}

export const links: Route.LinksFunction = () => []

export const clientLoader = async () => {
  const appConfig = await getAppConfig()
  const result = await fetchApiOrRedirect<UserInfo>(appConfig.userInfoUrl)
  if (!result.ok) {
    throw new Error(`Failed to load user info: ${result.error.message}`)
  }
  return { appConfig, userInfo: result.data }
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        {import.meta.env.DEV ? (
          <script type="module" src="/secvisogram-mock/index.js"></script>
        ) : null}
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}

export default function App() {
  return (
    <NotificationProvider>
      <Outlet />
    </NotificationProvider>
  )
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const { t } = useTranslation()

  if (error instanceof AppConfigError) {
    return (
      <main className="pt-16 p-4 container mx-auto">
        <h1>{t('appConfigError.heading')}</h1>
        <p>{t('appConfigError.body')}</p>
        <button
          type="button"
          className="underline"
          onClick={() => window.location.reload()}
        >
          {t('appConfigError.retry')}
        </button>
      </main>
    )
  }

  let message = 'Oops!'
  let details = 'An unexpected error occurred.'
  let stack: string | undefined

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? '404' : 'Error'
    details =
      error.status === 404
        ? 'The requested page could not be found.'
        : error.statusText || details
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message
    stack = error.stack
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  )
}
