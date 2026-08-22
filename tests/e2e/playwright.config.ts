import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './src',
  timeout: 120_000,
  use: {
    baseURL: 'http://127.0.0.1:5173',
  },
  webServer: {
    command: 'npm run dev --prefix ../../app',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
