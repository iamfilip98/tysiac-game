import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { PNG } from 'playwright-core/lib/utilsBundle';
import { expect, test, type Page } from '@playwright/test';
import { drive, firstLaunch, labelsRank } from './helpers';
import { expectFits } from './layout';
import { hasTail } from '../src/game/cards';

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
  // The "You got X" banner shows the card big at the foot of the table: inside the table cell, never over the
  // action zone (portrait: above it; landscape: the zone is in the other column), the opponents or the hand.
  const pill = await page.evaluate(() => {
    const b = document.createElement('button');
    b.className = 'received';
    b.style.animation = 'none'; // measure the resting position, not the pop-in
    b.innerHTML = '<span class="card received__card"></span><span class="received__text"><span class="received__lbl">You got</span><span class="received__from">from <b>Bot Basia</b></span></span><span class="received__x">✕</span>';
    document.querySelector('.game')!.appendChild(b);
    const box = (sel: string | Element) => {
      const r = (typeof sel === 'string' ? document.querySelector(sel)! : sel).getBoundingClientRect();
      return { l: r.left, r: r.right, t: r.top, b: r.bottom, h: r.height };
    };
    const out = { pill: box(b), zone: box('.zone'), table: box('.table'), opps: box('.opps'), hand: box('.hand'), self: box('.selfstrip') };
    b.remove();
    return out;
  });
  const overlaps = (a: typeof pill.pill, b: typeof pill.pill) => a.l < b.r - 1 && b.l < a.r - 1 && a.t < b.b - 1 && b.t < a.b - 1;
  for (const k of ['zone', 'opps', 'hand', 'self'] as const) expect(overlaps(pill.pill, pill[k]), `received banner overlaps ${k}`).toBe(false);
  expect(pill.pill.t).toBeGreaterThanOrEqual(pill.table.t - 1);
  expect(pill.pill.b).toBeLessThanOrEqual(pill.table.b + 1);
  expect(pill.pill.h).toBeGreaterThanOrEqual(70); // the card is shown big
  await expectFits(page, '10-card hand with glows');
});

/**
 * Card faces, measured on real pixels: every part of the face is drawn in its own pure colour on a white card,
 * the probe is screenshotted, and each part's ink box is read back from the image. So a glyph's real ink counts,
 * Q's tail included, in the theme's real font. Parts: top rank, top suit, centre pip, and the mirrored
 * bottom-right rank and suit. Every pair must stay apart by a visible gap.
 */
const PARTS = [
  { name: 'top rank', sel: '.card__idx:not(.card__idx--br) .card__rank', rgb: [255, 0, 0] },
  { name: 'top suit', sel: '.card__idx:not(.card__idx--br) .card__suit', rgb: [255, 255, 0] },
  { name: 'pip', sel: '.card__pip', rgb: [0, 255, 0] },
  { name: 'bottom rank', sel: '.card__idx--br .card__rank', rgb: [0, 0, 255] },
  { name: 'bottom suit', sel: '.card__idx--br .card__suit', rgb: [255, 0, 255] },
] as const;
const RANKS = [...new Set(['en', 'pl', 'da'].flatMap(l => ['9', '10', 'J', 'Q', 'K', 'A'].map(r => labelsRank(l, r))))];
const SUIT_GLYPHS = ['♥︎', '♦︎', '♣︎', '♠︎'];

/**
 * The pip's ink width as a share of the card width, so no fix shrinks it to make room. The theme fonts have no suit
 * glyphs; the serif themes fall back to a face whose suits ink about 0.2w at 0.27w type, the sans one (midnight)
 * to the system face, whose diamond inks about 0.12w.
 */
const MIN_PIP: Record<string, number> = { brass: 0.19, wycinanki: 0.19, midnight: 0.11 };

async function savePng(path: string, body: Buffer): Promise<string> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, body);
  return path;
}

interface FaceLayout { w: number; h: number; cells: { rank: string; suit: string; x: number; y: number }[] }

/** Each part's ink box per probe card in one screenshot slice; every pair of parts must be a visible gap apart. */
function faceInk(img: { width: number; height: number; data: Buffer }, layout: FaceLayout, shift: number, vh: number, vw: number, host: string, minPip: number): string[] {
  const scale = img.width / vw;
  const out: string[] = [];
  for (const cell of layout.cells) {
    const top = cell.y - shift;
    if (top < 0 || top + layout.h > vh) continue;
    const x0 = Math.round(cell.x * scale), y0 = Math.round(top * scale);
    const W = Math.round(layout.w * scale), H = Math.round(layout.h * scale);
    const boxes = PARTS.map(() => ({ l: Infinity, r: -Infinity, t: Infinity, b: -Infinity, n: 0 }));
    for (let y = y0 + 1; y < y0 + H - 1; y++) {
      for (let x = x0 + 1; x < x0 + W - 1; x++) {
        const i = (y * img.width + x) * 4;
        const px = [img.data[i], img.data[i + 1], img.data[i + 2]];
        const low = px.map(v => v < 150);
        if (!low.some(Boolean)) continue; // white, or ink too faint to see
        const k = PARTS.findIndex(p => p.rgb.every((c, j) => (c === 0) === low[j] && (c === 0 || px[j] > 215)));
        if (k < 0) continue; // overlapping inks blend into another colour; the boxes still catch the overlap
        const b = boxes[k];
        b.l = Math.min(b.l, x); b.r = Math.max(b.r, x + 1); b.t = Math.min(b.t, y); b.b = Math.max(b.b, y + 1); b.n++;
      }
    }
    const gap = Math.max(2, layout.w * 0.035) * scale;
    const name = `${host} ${cell.rank}${cell.suit.slice(0, 1)} (w ${Math.round(layout.w)})`;
    for (let a = 0; a < PARTS.length; a++) {
      if (boxes[a].n < 4) { out.push(`${name}: no ink for ${PARTS[a].name}`); continue; }
      for (let b = a + 1; b < PARTS.length; b++) {
        const A = boxes[a], B = boxes[b];
        if (B.n < 4) continue;
        const apart = Math.max(B.l - A.r, A.l - B.r, B.t - A.b, A.t - B.b);
        if (apart < gap) out.push(`${name}: ${PARTS[a].name} and ${PARTS[b].name} ink ${(apart / scale).toFixed(1)} px apart (< ${(gap / scale).toFixed(1)})`);
      }
    }
    const pip = boxes[2];
    if ((pip.r - pip.l) / scale < layout.w * minPip) out.push(`${name}: pip too small (${((pip.r - pip.l) / scale).toFixed(1)} px)`);
  }
  return out;
}

for (const theme of ['brass', 'wycinanki', 'midnight']) {
  test(`card faces in ${theme}: rank, suit, centre pip and the mirrored index never touch, on every rank (hand and table)`, async ({ page }) => {
    await firstLaunch(page);
    await page.getByRole('button', { name: 'Practice vs bots' }).click();
    await expect(page.locator('.hand .hand__card').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('.table')).toBeVisible();
    const problems: string[] = [];
    for (const host of ['hand', 'table'] as const) {
      // Lay every rank x suit out on a white, fixed overlay at the host's real card width.
      const layout = await page.evaluate(async ({ host, theme, ranks, tails, suits, parts }) => {
        document.documentElement.dataset.theme = theme;
        const probe = document.createElement('div');
        probe.className = 'card';
        document.querySelector(`.${host}`)!.appendChild(probe);
        const w = probe.getBoundingClientRect().width;
        probe.remove();
        document.querySelector('#face-probe')?.remove();
        const style = document.createElement('style');
        style.id = 'face-probe-style';
        style.textContent = `#face-probe .card { background: #fff !important; box-shadow: none !important; border: 0 !important; position: absolute; }
          #face-probe .card__face::after, #face-probe .card::before { display: none !important; }
          ${parts.map(p => `#face-probe ${p.sel} { color: rgb(${p.rgb.join(',')}) !important; }`).join('\n')}`;
        document.querySelector('#face-probe-style')?.remove();
        document.head.appendChild(style);
        const box = document.createElement('div');
        box.id = 'face-probe';
        box.setAttribute('style', `position: fixed; inset: 0; z-index: 9999; background: #fff; --w: ${w}px; --card-w: ${w}px; pointer-events: none;`);
        document.body.appendChild(box);
        // The cards ride on an inner sheet that slides up for each screenshot slice; the white overlay stays put,
        // so nothing of the game below ever shows through between the cards.
        const sheet = document.createElement('div');
        sheet.id = 'face-sheet';
        sheet.style.position = 'absolute';
        sheet.style.inset = '0';
        box.appendChild(sheet);
        const cols = Math.floor(window.innerWidth / (w + 6));
        const cells: { rank: string; suit: string; x: number; y: number }[] = [];
        let n = 0;
        for (const rank of ranks) {
          for (const suit of suits) {
            const x = 4 + (n % cols) * (w + 6);
            const y = 4 + Math.floor(n / cols) * (w * 1.42 + 6);
            const c = document.createElement('span');
            c.className = 'card';
            c.style.left = `${x}px`;
            c.style.top = `${y}px`;
            const idx = (br: boolean) => `<span class="card__idx ${br ? 'card__idx--br' : ''}"${tails.includes(rank) ? ' data-tail' : ''}><span class="card__rank">${rank}</span><span class="card__suit">${suit}</span></span>`;
            c.innerHTML = `<span class="card__face">${idx(false)}<span class="card__pip">${suit}</span>${idx(true)}</span>`;
            sheet.appendChild(c);
            cells.push({ rank, suit, x, y });
            n++;
          }
        }
        const font = getComputedStyle(box.querySelector('.card__rank')!);
        await document.fonts.load(`${font.fontWeight} ${font.fontSize} ${font.fontFamily}`, 'QKAJ10DWEB');
        await document.fonts.ready;
        return { w, h: w * 1.42, cells, bottom: 4 + Math.ceil(n / cols) * (w * 1.42 + 6) };
      }, { host, theme, ranks: RANKS, tails: RANKS.filter(hasTail), suits: SUIT_GLYPHS, parts: PARTS.map(p => ({ sel: p.sel, rgb: [...p.rgb] })) });
      // The overlay may be taller than the screen on small phones: shoot it in screen-high slices.
      const vh = page.viewportSize()!.height;
      const rows = Math.ceil(layout.cells.length / Math.floor(page.viewportSize()!.width / (layout.w + 6)));
      const perPage = Math.max(1, Math.floor((vh - 8) / (layout.h + 6)));
      for (let first = 0; first < rows; first += perPage) {
        await page.evaluate(({ shift }) => {
          document.querySelector<HTMLElement>('#face-sheet')!.style.transform = `translateY(${-shift}px)`;
        }, { shift: first * (layout.h + 6) });
        await page.waitForTimeout(50);
        // Decoded here in Node, not on a page canvas: WebKit colour-manages images drawn to a canvas, which
        // shifts the pure probe colours and hides ink.
        const raw = await page.screenshot({ animations: 'disabled' });
        const found = faceInk(PNG.sync.read(raw), layout, first * (layout.h + 6), vh, page.viewportSize()!.width, host, MIN_PIP[theme]);
        if (found.length || first === 0) await test.info().attach(`${theme}-${host}-${first}`, { path: await savePng(test.info().outputPath(`${theme}-${host}-${first}.png`), raw), contentType: 'image/png' });
        problems.push(...found);
      }
      await page.evaluate(() => document.querySelector('#face-probe')?.remove());
    }
    expect(problems).toEqual([]);
  });
}
