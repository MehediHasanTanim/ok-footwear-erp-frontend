import { defineConfig, devices } from '@playwright/test'
import dotenv from 'dotenv'
import path from 'path'

// Load E2E-specific env vars.  In CI, PLAYWRIGHT_BASE_URL is set by the pipeline.
dotenv.config({ path: path.resolve(__dirname, '.env.e2e') })
// Allow overrides from a local .env.e2e.local (gitignored)
dotenv.config({ path: path.resolve(__dirname, '.env.e2e.local'), override: true })

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173'

export default defineConfig({
  testDir: './specs',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { outputFolder: 'playwright-report' }], ['list']],

  // Global setup — logs in each role via API, stores auth state in .auth/
  globalSetup: './global-setup.ts',

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  // Two browser projects — no WebKit (Safari font rendering differences cause flakiness)
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
  ],

  // Output directories
  outputDir: 'test-results/',
  // Auth state files
  // globalSetup writes these; project-level use loads them per role.
})
