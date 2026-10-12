import { expect, test } from '@playwright/test';
import { expectFits, expectSafe, setSafeInsets } from './layout';

const LONG = ['Bartłomiej Wojciechowski', 'Katarzyna Szczepańska-Ko', 'Przemysław Grzegorzewski'];
function bigHistory(me: string) {
  return {
    games: Array.from({ length: 20 }, (_, i) => ({
      id: `g${i}`, finishedAt: Date.UTC(2026, 9, 10 - (i % 9), 20, i), playerCount: 3, winnerId: i % 2 ? me : `o${i % 3}`,
      players: [
        { id: me, name: 'Tester', avatar: '🐻', isBot: false, finalScore: 1000 - i, won: i % 2 === 1 },
        { id: `o${i % 3}`, name: LONG[i % 3], avatar: '🦊', isBot: false, finalScore: 900 - i, won: i % 2 === 0 },
        { id: 'bot-1', name: 'Bot Basia', avatar: '🤖', isBot: true, finalScore: 300, won: false },
      ],
    })),
    headToHead: LONG.map((name, i) => ({ opponentId: `o${i}`, name, avatar: '🦊', games: 7, wins: 4, losses: 3 })),
    leaderboard: [{ playerId: me, name: 'Tester', avatar: '🐻', games: 20, wins: 10 }, ...LONG.map((name, i) => ({ playerId: `o${i}`, name, avatar: '🦊', games: 7, wins: 3 }))],
  };
}

test('a long history fits and only the list scrolls', async ({ page }, info) => {
  await page.goto('/?local=0');
  await page.getByLabel('Your name').fill('Tester');
  await page.getByRole('button', { name: 'Continue' }).click();
  // The identity is created lazily by the History screen, so answer with whichever id it asks for.
  await page.route('**/api/history?**', route => route.fulfill({ json: bigHistory(new URL(route.request().url()).searchParams.get('player')!) }));
  await page.getByRole('link', { name: 'History' }).click();
  await expect(page.getByText('You won').first()).toBeVisible();
  for (const tab of ['Recent games', 'Head-to-head', 'Leaderboard']) {
    await page.getByRole('radio', { name: tab }).click();
    await expectFits(page, `history ${tab}`);
  }
  const list = page.locator('.history__list');
  await list.evaluate(el => el.scrollTo(0, el.scrollHeight));
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  if (info.project.name === 'iphone15') {
    const insets = { top: 59, right: 0, bottom: 34, left: 0 };
    await setSafeInsets(page, insets);
    await expectSafe(page, 'history', insets);
  }
});
