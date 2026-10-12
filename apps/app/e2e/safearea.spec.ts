import { expect, test, type Page } from '@playwright/test';
import { drive, firstLaunch } from './helpers';
import { expectSafe, setSafeInsets, type SafeInsets } from './layout';

// iPhone 15: Dynamic Island + home indicator in portrait; island on the left, indicator at the bottom in landscape.
const MODES: { name: string; width: number; height: number; insets: SafeInsets }[] = [
  { name: 'portrait', width: 393, height: 852, insets: { top: 59, right: 0, bottom: 34, left: 0 } },
  { name: 'landscape', width: 852, height: 393, insets: { top: 0, right: 59, bottom: 21, left: 59 } },
];

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== 'iphone15', 'safe-area modes set their own viewport');
});

for (const mode of MODES) {
  test(`${mode.name}: hand, actions, home, lobby and sheets stay in the safe area and out of the rounded corners`, async ({ page }) => {
    await page.setViewportSize({ width: mode.width, height: mode.height });
    await firstLaunch(page);
    const safe = (label: string, scope?: string, scrollable?: boolean) =>
      expectSafe(page, `${mode.name} ${label}`, mode.insets, scope, scrollable);
    await setSafeInsets(page, mode.insets);
    await safe('home', 'body', true);

    await page.getByRole('button', { name: 'Settings' }).click();
    await safe('settings sheet', '[role="dialog"]');
    await page.getByRole('button', { name: 'Close' }).click();

    await page.getByRole('button', { name: '3 players' }).click();
    await expect(page.getByText('Room code')).toBeVisible();
    await page.getByRole('button', { name: 'Add bot' }).click();
    await safe('lobby', 'body', true);
    await page.getByRole('button', { name: 'Leave' }).click();

    await page.getByRole('button', { name: 'Practice vs bots' }).click();
    await expect(page.locator('.zone')).toBeVisible({ timeout: 20_000 });
    await setSafeInsets(page, mode.insets);
    await openMenuSheetCheck(page, safe);
    // Stop after one round result: bidding, decision, hand-out and tricks have all been checked by then.
    await drive(page, {
      check: async key => {
        if (key === 'round result') await safe(key, '[role="dialog"]');
        else await safe(key);
      },
      stop: async () => (await page.getByRole('button', { name: 'Continue' }).isVisible()),
    });
  });
}

async function openMenuSheetCheck(page: Page, safe: (label: string, scope?: string, scrollable?: boolean) => Promise<void>): Promise<void> {
  const menu = page.getByRole('button', { name: 'Menu' });
  if (await menu.isVisible()) {
    await menu.click();
    await safe('menu sheet', '[role="dialog"]');
    await page.getByRole('button', { name: 'Close' }).click();
  }
}
