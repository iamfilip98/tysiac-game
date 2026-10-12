import { defineConfig, devices } from '@playwright/test';

// Real Worker + Durable Objects + D1 under `wrangler dev`, serving the built app (apps/app/dist).
const BROWSER = process.env.E2E_BROWSER === 'chromium' ? 'chromium' : 'webkit';

const PORT = Number(process.env.E2E_WORKER_PORT ?? 8787);

export default defineConfig({
  testDir: 'e2e-worker',
  timeout: 5 * 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: { baseURL: `http://127.0.0.1:${PORT}`, serviceWorkers: 'block', actionTimeout: 15_000, trace: 'retain-on-failure' },
  webServer: {
    command: 'pnpm build && pnpm --filter @tysiac/worker dev:e2e',
    url: `http://127.0.0.1:${PORT}/api/rooms/AAAAAA`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    env: { WRANGLER_SEND_METRICS: 'false', E2E_WORKER_PORT: String(PORT) },
  },
  projects: [
    {
      name: 'iphone15',
      use: {
        ...devices['Desktop Safari'],
        browserName: BROWSER,
        viewport: { width: 393, height: 852 },
        isMobile: BROWSER === 'webkit',
        hasTouch: true,
        deviceScaleFactor: 2,
      },
    },
  ],
});
