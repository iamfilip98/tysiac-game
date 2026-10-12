import { expect, test, type Page } from '@playwright/test';
import { drive, firstLaunch } from './helpers';
import { expectFits } from './layout';

/** Minimum hand-card width per project (px). */
const MIN_W: Record<string, number> = { se: 70, iphone15: 76, promax: 84, landscape: 38, desktop: 90 };

async function handMetrics(page: Page) {
  return page.locator('.hand .hand__card').evaluateAll(els =>
    els.map(el => {
      const r = el.getBoundingClientRect();
      const rank = el.querySelector('.card__idx .card__rank')!.getBoundingClientRect();
      return { left: r.left, right: r.right, width: r.width, rankRight: rank.right, rankH: rank.height };
    }),
  );
}

test('a 10-card hand is big, fully on screen and every index is readable', async ({ page }, info) => {
  await firstLaunch(page);
  await page.getByRole('button', { name: 'Practice vs bots' }).click();
  await expect(page.locator('.zone')).toBeVisible({ timeout: 20_000 });
  // Win the auction so the hand holds 10 cards (decision phase, before the hand-out).
  await drive(page, {
    bidAlways: true,
    check: async () => {},
    stop: async () => (await page.locator('.hand .hand__card').count()) === 10,
  });
  await page.waitForTimeout(1200); // let the deal / layout animations settle
  const cards = await handMetrics(page);
  const vw = page.viewportSize()!.width;
  expect(cards).toHaveLength(10);
  for (const [i, c] of cards.entries()) {
    expect(c.width, `card ${i} width`).toBeGreaterThanOrEqual(MIN_W[info.project.name] ?? 60);
    expect(c.left).toBeGreaterThanOrEqual(0);
    expect(c.right).toBeLessThanOrEqual(vw);
    const next = cards[i + 1];
    // The next card must not cover this card's rank.
    if (next) expect(next.left, `card ${i} index covered`).toBeGreaterThanOrEqual(c.rankRight - 1);
    expect(c.rankH).toBeGreaterThanOrEqual(c.width * 0.28);
  }
  await expectFits(page, '10-card hand');
  // Review focus 4: glows must not be clipped.
  const glowing = page.locator('.hand .card--glow-marriage, .hand .card--glow-trump');
  if (await glowing.count()) {
    const box = await glowing.first().boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
  }
  await expectFits(page, '10-card hand with glows');
});
