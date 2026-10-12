import { expect, test } from '@playwright/test';
import { drive, firstLaunch } from './helpers';
import { setSafeInsets } from './layout';

for (const theme of ['Brass', 'Wycinanki', 'Midnight']) {
  test(`screenshots in ${theme}`, async ({ page }, info) => {
    test.skip(info.project.name !== 'iphone15', 'owner phone size only');
    await firstLaunch(page);
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('radio', { name: new RegExp(theme) }).click();
    await page.getByRole('button', { name: 'Close' }).click();
    await page.getByRole('button', { name: 'Practice vs bots' }).click();
    await expect(page.locator('.zone')).toBeVisible({ timeout: 20_000 });
    await setSafeInsets(page, { top: 59, bottom: 34, left: 0, right: 0 });
    const shot = (name: string) => page.screenshot({ path: `e2e-shots/${theme.toLowerCase()}-${name}.png` });
    await drive(page, {
      bidAlways: true,
      check: async key => { await shot(key.replace(/\s+/g, '-')); },
      stop: async () => (await page.locator('.zone').getAttribute('data-phase')) === 'tricks',
    });
    await shot('tricks');
  });
}
