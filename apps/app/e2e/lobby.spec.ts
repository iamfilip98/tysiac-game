import { expect, test } from '@playwright/test';
import { expectFits } from './layout';

test('lobby: add bots, swap seats, choose the first dealer, start', async ({ page }) => {
  await page.goto('/?local=1&fast=1');
  await page.getByLabel('Your name').fill('Host');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: '3 players' }).click();
  await expect(page.getByText('Room code')).toBeVisible();
  await expectFits(page, 'lobby', { allowScroll: true });

  await page.getByRole('button', { name: 'Add bot' }).click();
  await page.getByRole('button', { name: 'Add bot' }).click();
  await expect(page.getByRole('button', { name: 'Seat 3: Bot Zenek' })).toBeVisible();

  await page.getByRole('button', { name: 'Seat 2: Bot Basia' }).click();
  await page.getByRole('button', { name: 'Seat 3: Bot Zenek' }).click();
  await expect(page.getByRole('button', { name: 'Seat 2: Bot Zenek' })).toBeVisible();

  await page.getByRole('button', { name: 'Seat 2: Bot Zenek' }).click();
  await page.getByRole('button', { name: 'Make first dealer' }).click();
  await page.getByRole('button', { name: 'Start game' }).click();

  await expect(page.locator('.game')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('Bot Zenek deals · bidding')).toBeVisible();
  await expectFits(page, 'first bidding');
});
