import { defineConfig, loadEnv, type Plugin } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { reactRouter } from '@react-router/dev/vite'

const APP_CONFIG_PATH = '/.well-known/appspecific/de.bsi.secvisogram.json'

/**
 * Serves the backend's app-config with its `userInfoUrl` made same-origin. The
 * stack publishes absolute URLs on its own origin, which the dev server's
 * origin cannot call without CORS, so every load would look like an expired
 * session and redirect to login.
 */
function devBackendAppConfig(backendUrl: string): Plugin {
  const origin = new URL(backendUrl).origin
  return {
    name: 'csaf-dev-backend-app-config',
    configureServer(server) {
      server.middlewares.use(APP_CONFIG_PATH, async (_req, res) => {
        try {
          const upstream = await fetch(new URL(APP_CONFIG_PATH, backendUrl))
          const config = await upstream.json()
          if (config.userInfoUrl?.startsWith(`${origin}/`)) {
            config.userInfoUrl = config.userInfoUrl.slice(origin.length)
          }
          res.statusCode = upstream.status
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(config))
        } catch {
          res.statusCode = 502
          res.end()
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backendUrl = env.CSAF_DEV_BACKEND_URL

  return {
    plugins: [
      tailwindcss(),
      reactRouter(),
      ...(backendUrl ? [devBackendAppConfig(backendUrl)] : []),
    ],
    resolve: {
      tsconfigPaths: true,
    },
    ...(backendUrl && {
      server: {
        proxy: {
          '/api': backendUrl,
          '/oauth2': backendUrl,
        },
      },
    }),
  }
})
