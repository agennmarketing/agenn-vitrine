import { defineConfig, devices } from '@playwright/test'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

export const APP_URL = 'http://app.localhost:3000'

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: APP_URL, trace: 'retain-on-failure', locale: 'pt-BR' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    // No CI o workflow já rodou `npm run build`; localmente segue o `next dev`.
    command: process.env.CI ? 'npm run start' : 'npm run dev',
    url: 'http://localhost:3000/',
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
})
