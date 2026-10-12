import { defineConfig, devices } from '@playwright/test';

const VIEWPORTS = [
  { name: 'se', width: 375, height: 667, mobile: true },
  { name: 'iphone15', width: 393, height: 852, mobile: true },
  { name: 'promax', width: 440, height: 956, mobile: true },
  { name: 'landscape', width: 852, height: 393, mobile: true },
  { name: 'desktop', width: 1280, height: 800, mobile: false },
];

const PORT = Number(process.env.E2E_PORT ?? 4173);

// WebKit-first (the owner plays on iPhone). E2E_BROWSER=chromium is a fallback when WebKit is unavailable.
const BROWSER = process.env.E2E_BROWSER === 'chromium' ? 'chromium' : 'webkit';

export default defineConfig({
  testDir: 'e2e',
  timeout: 10 * 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    serviceWorkers: 'block',
    actionTimeout: 10_000,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `pnpm build && pnpm preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
  projects: VIEWPORTS.map(v => ({
    name: v.name,
    use: {
      ...devices['Desktop Safari'],
      browserName: BROWSER,
      viewport: { width: v.width, height: v.height },
      isMobile: v.mobile && BROWSER === 'webkit',
      hasTouch: v.mobile,
      deviceScaleFactor: 2,
    },
  })),
});
