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
  // Glows must not be clipped, and the K-Q marriage pill must be visible and span both cards. The deal is random,
  // so stage the classes / pill on real hand cards: this checks the CSS (padding, clipping, stacking), not the deal.
  const probe = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('.hand .hand__card'));
    els[0].classList.add('card--glow-marriage');
    els[els.length - 1].classList.add('card--glow-marriage');
    els[Math.floor(els.length / 2)].classList.add('card--raised', 'card--glow-trump');
    const hand = document.querySelector<HTMLElement>('.hand')!;
    const tag = document.createElement('span');
    tag.className = 'hand__mtag';
    tag.setAttribute('data-staged', '');
    tag.setAttribute('style', '--i: 3; --span: 2');
    tag.textContent = '♥\uFE0E 100';
    hand.appendChild(tag);
    const glowExtent = (el: HTMLElement) =>
      Math.max(...Array.from(getComputedStyle(el).boxShadow.matchAll(/(-?[\d.]+)px (-?[\d.]+)px (-?[\d.]+)px(?: (-?[\d.]+)px)?/g)).slice(0, 2).map(m => Math.abs(Number(m[2])) + Number(m[3]) + Number(m[4] ?? 0)));
    return els.map((el, i) => ({ i, extent: glowExtent(el), glow: el.className.includes('glow') }));
  });
  await page.waitForTimeout(400);
  const vh = page.viewportSize()!.height;
  const geo = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.hand .hand__card')).map(c => c.getBoundingClientRect());
    const tag = document.querySelector('.hand__mtag[data-staged]')!;
    const t = tag.getBoundingClientRect();
    const hit = document.elementFromPoint(t.left + t.width / 2, t.top + t.height / 2);
    return { cards: cards.map(c => ({ l: c.left, r: c.right, t: c.top, b: c.bottom })), tag: { l: t.left, r: t.right, t: t.top, b: t.bottom }, hitIsTag: hit === tag, pe: getComputedStyle(tag).pointerEvents };
  });
  for (const g of probe.filter(p => p.glow)) {
    const c = geo.cards[g.i];
    expect(vh - c.b, `glow on card ${g.i} clipped at the bottom`).toBeGreaterThanOrEqual(g.extent);
    expect(c.l - g.extent, `glow on card ${g.i} clipped at the left`).toBeGreaterThanOrEqual(0);
  }
  const k = geo.cards[3];
  const q = geo.cards[4];
  expect(geo.tag.t, 'tag is inside the viewport').toBeGreaterThanOrEqual(0);
  expect(geo.tag.l).toBeLessThanOrEqual(k.l + 1);
  expect(geo.tag.r).toBeGreaterThanOrEqual(q.r - 1);
  expect(geo.tag.b, 'tag sits above the cards').toBeLessThanOrEqual(k.t + 1);
  expect(geo.pe).toBe('none'); // never blocks a tap on either card
  expect(geo.hitIsTag).toBe(false); // so the hit test reaches whatever is beneath it
  // The "You got X" pill is compact and sits at the top of the table: clear of the action zone and the trick spots.
  const pill = await page.evaluate(() => {
    const b = document.createElement('button');
    b.className = 'received';
    b.innerHTML = '<span class="received__lbl">You got</span><span class="card received__card"></span><span class="received__from">from <b>Bot Basia</b></span>';
    document.querySelector('.game')!.appendChild(b);
    const r = b.getBoundingClientRect();
    const z = document.querySelector('.zone')!.getBoundingClientRect();
    const t = document.querySelector('.table')!.getBoundingClientRect();
    const spots = Array.from(document.querySelectorAll('.tcard')).length;
    b.remove();
    return { top: r.top, bottom: r.bottom, h: r.height, zoneTop: z.top, tableTop: t.top, tableH: t.height, spots };
  });
  expect(pill.bottom).toBeLessThanOrEqual(pill.zoneTop);
  expect(pill.top).toBeGreaterThanOrEqual(pill.tableTop);
  expect(pill.h).toBeLessThanOrEqual(60);
  expect(pill.h).toBeLessThan(pill.tableH * 0.45);
  await expectFits(page, '10-card hand with glows');
});
