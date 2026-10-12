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

  // Rematch: the new game restarts at seq 0 and must replace the finished one on every client.
  await page.getByRole('button', { name: 'Rematch' }).click();
  await expect(page.getByRole('dialog', { name: 'Game over' })).toBeHidden({ timeout: 10_000 });
  await expect(page.locator('.zone')).toBeVisible();
  await drive(page, {
    check: async () => {},
    stop: async () => (await page.locator('.zone').getAttribute('data-phase')) === 'tricks',
  });
  await expect(page.getByRole('dialog', { name: 'Game over' })).toBeHidden();
});

test('the human wins an auction: decision and hand-out panels are reached and fit', async ({ page }) => {
  await firstLaunch(page);
  await page.getByRole('button', { name: 'Practice vs bots' }).click();
  await expect(page.locator('.zone')).toBeVisible({ timeout: 20_000 });
  const seen = new Set<string>();
  await drive(page, {
    bidAlways: true,
    check: async key => {
      seen.add(key);
      await expectFits(page, key);
    },
    stop: async () => seen.has('decision') && seen.has('handout'),
  });
  for (const key of ['decision', 'handout']) expect(seen.has(key), `saw ${key}`).toBe(true);
});

test('a four-player table fits including sit-out, decision, hand-out and tricks', async ({ page }) => {
  await firstLaunch(page);
  await page.getByRole('button', { name: '4 players' }).click();
  await expect(page.getByText('Room code')).toBeVisible();
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Add bot' }).click();
  // Make the human the first dealer so round 1 shows the sit-out panel.
  await page.getByRole('button', { name: /^Seat \d: Tester$/ }).click();
  await page.getByRole('button', { name: 'Make first dealer' }).click();
  await page.getByRole('button', { name: 'Start game' }).click();
  await expect(page.locator('.zone')).toBeVisible({ timeout: 20_000 });
  const seen = new Set<string>();
  // Round 1: the human deals and sits out; the panel is on screen from the start (no trick cards in flight yet).
  await expect(page.getByText('You deal and sit out this round.')).toBeVisible();
  await expectFits(page, '4p sitout');
  seen.add('sitout');
  await drive(page, {
    bidAlways: true,
    check: async key => {
      seen.add(key);
      await expectFits(page, `4p ${key}`);
    },
    stop: async () => seen.has('bidding') && seen.has('tricks') && seen.has('decision') && seen.has('handout'),
  });
  for (const key of ['sitout', 'bidding', 'decision', 'handout', 'tricks']) expect(seen.has(key), `saw ${key}`).toBe(true);
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
