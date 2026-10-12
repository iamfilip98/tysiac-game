import { expect, test } from '@playwright/test';
import { drive, firstLaunch } from './helpers';
import { expectFits } from './layout';

test('when a bot wins above 100 the human must confirm the talon', async ({ page }) => {
  await firstLaunch(page);
  await page.getByRole('button', { name: 'Practice vs bots' }).click();
  await expect(page.locator('.zone')).toBeVisible({ timeout: 20_000 });
  const zone = page.locator('.zone');
  await drive(page, {
    passAlways: true,
    check: async () => {},
    stop: async () => (await zone.getAttribute('data-phase')) === 'talon' && (await page.getByRole('button', { name: 'Seen' }).isVisible()),
  });
  await expect(page.locator('.talon .card')).toHaveCount(3);
  await expectFits(page, 'talon confirm');
  await page.getByRole('button', { name: 'Seen' }).click();
  await expect(page.getByRole('button', { name: 'Seen' })).toBeHidden();
});
