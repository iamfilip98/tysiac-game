import { expect, test } from '@playwright/test';
import { drive, firstLaunch } from './helpers';
import { expectFits } from './layout';

test('focusing and blurring the name input leaves the page at the top', async ({ page }) => {
  await firstLaunch(page);
  await expectFits(page, 'home', { allowScroll: true });
});

test('plays a full practice game against bots with nothing off-screen', async ({ page }) => {
  await firstLaunch(page);
  await page.getByRole('button', { name: 'Practice vs bots' }).click();
  await expect(page.locator('.zone')).toBeVisible({ timeout: 20_000 });
  const seen = new Set<string>();
  await drive(page, {
    check: async key => {
      seen.add(key);
      await expectFits(page, key);
    },
  });
  for (const key of ['bidding', 'tricks', 'waiting', 'round result', 'game over']) expect(seen.has(key), `saw ${key}`).toBe(true);
});

test('a four-player table fits through bidding, hand-out and tricks', async ({ page }) => {
  await firstLaunch(page);
  await page.getByRole('button', { name: '4 players' }).click();
  await expect(page.getByText('Room code')).toBeVisible();
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Add bot' }).click();
  await page.getByRole('button', { name: 'Start game' }).click();
  await expect(page.locator('.zone')).toBeVisible({ timeout: 20_000 });
  const seen = new Set<string>();
  await drive(page, {
    check: async key => {
      seen.add(key);
      await expectFits(page, `4p ${key}`);
    },
    stop: async () => (await page.getByRole('button', { name: 'Continue' }).isVisible()) && seen.has('tricks'),
  });
  for (const key of ['bidding', 'tricks']) expect(seen.has(key), `saw ${key}`).toBe(true);
});

test('the Wycinanki theme also fits', async ({ page }) => {
  await firstLaunch(page);
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('radio', { name: /Wycinanki/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'wycinanki');
  await page.getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', { name: 'Practice vs bots' }).click();
  await expect(page.locator('.zone')).toBeVisible({ timeout: 20_000 });
  await expectFits(page, 'wycinanki game');
});
