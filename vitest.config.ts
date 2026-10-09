import { defineConfig } from 'vitest/config'
import { playwright } from '@vitest/browser-playwright'

export default defineConfig({
  test: {
    projects: [
      {
        // clientLoader/clientAction/API-client logic: no DOM, no browser boot
        resolve: { tsconfigPaths: true },
        test: {
          name: 'node',
          environment: 'node',
          include: ['app/**/*.test.ts'],
        },
      },
      {
        // rendered components, run in a real browser via the Playwright provider
        resolve: { tsconfigPaths: true },
        test: {
          name: 'browser',
          include: ['app/**/*.test.tsx'],
          browser: {
            enabled: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
})
