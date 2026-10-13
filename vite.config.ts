import { defineConfig, loadEnv } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { reactRouter } from '@react-router/dev/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backendUrl = env.CSAF_DEV_BACKEND_URL

  return {
    plugins: [tailwindcss(), reactRouter()],
    resolve: {
      tsconfigPaths: true,
    },
    ...(backendUrl && {
      server: {
        proxy: {
          '/api': backendUrl,
          '/oauth2': backendUrl,
          '/.well-known/appspecific/de.bsi.secvisogram.json': backendUrl,
        },
      },
    }),
  }
})
