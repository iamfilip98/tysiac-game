import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false, // game tests need sequential execution
  retries: process.env.CI ? 1 : 0,
  workers: 1, // one worker to avoid port conflicts
  reporter: process.env.CI ? 'html' : 'list',

  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
    screenshot: 'only-on-failure',
    video: process.env.CI ? 'on-first-retry' : 'off',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'desktop-chrome',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
      testMatch: /visual\/.*/,
    },
  ],

  webServer: [
    {
      command: 'pnpm --filter=@tysiac/server exec tsx src/index.ts',
      url: 'http://localhost:3001/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000, // ESM resolution can take up to 90s on first run
      env: {
        PORT: '3001',
        CORS_ORIGIN: 'http://localhost:3000',
        NODE_ENV: 'test',
      },
    },
    {
      command: 'pnpm --filter=@tysiac/web dev',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        NEXT_PUBLIC_SOCKET_URL: 'http://localhost:3001',
      },
    },
  ],
});
