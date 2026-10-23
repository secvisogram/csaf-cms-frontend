import { defineConfig, devices } from '@playwright/test'

// Smoke checks against a running edge (local container or deployed origin):
//   SMOKE_BASE_URL=https://<origin> npm run test:smoke
export default defineConfig({
  testDir: './tests/smoke',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: 'list',
  use: {
    baseURL: process.env.SMOKE_BASE_URL ?? 'http://localhost:8080',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
