import { expect, test, type Page } from '@playwright/test';
import { firstLaunch, labels } from './helpers';
import { expectFits } from './layout';
import { en } from '../src/i18n/en';
import { pl } from '../src/i18n/pl';
import { da } from '../src/i18n/da';
import type { Lang } from '../src/i18n/types';

const DICTS = { en, pl, da } as const;
const LANG_NAMES: Record<Lang, string> = { en: 'English', pl: 'Polski', da: 'Dansk' };

/**
 * Stages the game chrome's widest realistic state through the store (?local=1&fast=1): my turn, I deal, the
 * coach is on, and I have 1000 points (four digits in the score box and the self strip).
 */
async function stageChrome(page: Page, score = 1000): Promise<void> {
  // On my own turn nothing else happens until I act, so the staged state stays put.
  await page.waitForFunction(() => {
    const s = (window as unknown as { __tysiacRoom: { getState(): { view: { turn: string; me: string } | null; queue: unknown[]; holding: boolean } } }).__tysiacRoom.getState();
    return s.view?.turn === s.view?.me && s.queue.length === 0 && !s.holding;
  }, null, { timeout: 20_000 });
  await page.evaluate(score => {
    type Any = any; // eslint-disable-line @typescript-eslint/no-explicit-any
    const store = (window as unknown as { __tysiacRoom: Any }).__tysiacRoom;
    const s = store.getState();
    const v = s.view;
    const view = { ...v, turn: v.me, paused: false, round: { ...v.round, dealer: v.me }, scores: { ...v.scores, [v.me]: { ...v.scores[v.me], total: score } } };
    const room = { ...s.room, seats: s.room.seats.map((x: Any) => (x?.id === s.me ? { ...x, coach: true } : x)) };
    store.setState({ view, shown: view, room, queue: [], holding: false, roundResult: null });
  }, score);
  await page.waitForTimeout(150);
}

/** Text ink boxes (Range rects, so the glyphs and not the block) of the top bar and self strip. */
async function chromeGeometry(page: Page) {
  return page.evaluate(() => {
    const text = (el: Element | null) => {
      if (!el) return null;
      const r = document.createRange();
      r.selectNodeContents(el);
      const b = r.getBoundingClientRect();
      return { l: b.left, r: b.right, t: b.top, b: b.bottom, w: b.width };
    };
    const box = (el: Element | null) => {
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { l: b.left, r: b.right, t: b.top, b: b.bottom, w: b.width, h: b.height };
    };
    const chips = Array.from(document.querySelectorAll('.selfstrip__chip')).map(c => ({
      cls: String(c.className), text: c.textContent, box: box(c)!, ink: text(c)!, font: parseFloat(getComputedStyle(c).fontSize),
      clipped: (c as HTMLElement).scrollWidth > (c as HTMLElement).clientWidth + 1,
    }));
    return {
      vw: window.innerWidth,
      title: text(document.querySelector('.topbar__info b')),
      status: text(document.querySelector('.topbar__info span')),
      score: box(document.querySelector('.topbar__score')),
      scoreLabel: text(document.querySelector('.topbar__scorelbl')),
      scoreValue: text(document.querySelector('.topbar__scoreval')),
      scoreFont: parseFloat(getComputedStyle(document.querySelector('.topbar__scorelbl')!).fontSize),
      self: box(document.querySelector('.selfstrip')),
      selfAvatar: box(document.querySelector('.selfstrip__avatar')),
      oppAvatar: box(document.querySelector('.opp .avatar')),
      selfScore: text(document.querySelector('.selfstrip__score')),
      name: text(document.querySelector('.selfstrip__name')),
      nameClipped: (() => { const n = document.querySelector<HTMLElement>('.selfstrip__name')!; return n.scrollWidth > n.clientWidth + 1; })(),
      chips,
    };
  });
}

type Geo = Awaited<ReturnType<typeof chromeGeometry>>;
const inside = (a: { l: number; r: number; t: number; b: number }, b: { l: number; r: number; t: number; b: number }, tol = 0.5) =>
  a.l >= b.l - tol && a.r <= b.r + tol && a.t >= b.t - tol && a.b <= b.b + tol;

function checkChrome(g: Geo, where: string): void {
  // 1. The score's label and number are inside the score box.
  expect(inside(g.scoreLabel!, g.score!), `${where}: score label ${JSON.stringify(g.scoreLabel)} inside ${JSON.stringify(g.score)}`).toBe(true);
  expect(inside(g.scoreValue!, g.score!), `${where}: score value ${JSON.stringify(g.scoreValue)} inside ${JSON.stringify(g.score)}`).toBe(true);
  expect(g.scoreFont, `${where}: score label readable`).toBeGreaterThanOrEqual(10);
  // 7. The round title and the status line under it are centred on the screen.
  for (const [name, t] of [['round title', g.title], ['status line', g.status]] as const) {
    expect(Math.abs((t!.l + t!.r) / 2 - g.vw / 2), `${where}: ${name} centred (${t!.l.toFixed(1)}..${t!.r.toFixed(1)} in ${g.vw})`).toBeLessThanOrEqual(2);
  }
  // 3. Self-strip chips: >= 13 px text, all of it inside the chip, the strip inside the screen.
  expect(g.chips.map(c => c.cls).join(' '), `${where}: turn, dealer and coach chips shown`).toMatch(/selfstrip__turn.*selfstrip__dealer.*chip--coach/);
  for (const c of g.chips) {
    expect(c.font, `${where}: ${c.text} font size`).toBeGreaterThanOrEqual(13);
    expect(c.clipped, `${where}: ${c.text} clipped`).toBe(false);
    expect(inside(c.ink, c.box), `${where}: ${c.text} text inside its chip`).toBe(true);
    expect(c.box.r, `${where}: ${c.text} on screen`).toBeLessThanOrEqual(g.vw);
  }
  // 4. My avatar is about the opponents' size, and the strip (with my score) fits.
  expect(g.selfAvatar!.w, `${where}: my avatar size`).toBeGreaterThanOrEqual(Math.min(34, g.oppAvatar!.w * 0.85));
  expect(g.selfScore!.r, `${where}: my score on screen`).toBeLessThanOrEqual(g.self!.r + 0.5);
  expect(g.nameClipped, `${where}: my name shown in full`).toBe(false);
  expect(g.name!.r, `${where}: name clear of my score`).toBeLessThanOrEqual(g.selfScore!.l);
  const last = g.chips[g.chips.length - 1];
  expect(last.box.r, `${where}: chips inside the strip`).toBeLessThanOrEqual(g.self!.r + 0.5);
  // The strip is no taller than the avatar plus a little: it fits at se.
  expect(g.self!.h, `${where}: strip height`).toBeLessThanOrEqual(g.selfAvatar!.h + 4);
}

async function switchLanguage(page: Page, from: Lang, to: Lang): Promise<void> {
  await page.getByRole('button', { name: DICTS[from]['game.top.menu'] as string }).click();
  await page.getByRole('button', { name: labels(from).settings }).click();
  await page.getByRole('radio', { name: LANG_NAMES[to] }).click();
  const L = labels(to);
  const settings = page.getByRole('dialog', { name: L.settings });
  await settings.getByRole('button', { name: L.close }).click();
  await expect(settings).toBeHidden();
  const menu = page.getByRole('dialog', { name: DICTS[to]['game.menu.title'] as string });
  if (await menu.isVisible()) await menu.getByRole('button', { name: L.close }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

for (const lang of ['en', 'pl', 'da'] as const) {
  test(`top bar and self strip fit and are centred in ${lang}, with 1000 points, and after switching language`, async ({ page }, info) => {
    test.skip(info.project.name === 'desktop', 'phones only');
    await firstLaunch(page, lang);
    await page.getByRole('button', { name: labels(lang).practice }).click();
    await expect(page.locator('.zone')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('.topbar__info span')).not.toBeEmpty({ timeout: 20_000 });
    await stageChrome(page);
    checkChrome(await chromeGeometry(page), `${lang} 1000`);
    await expectFits(page, `${lang} chrome`);
    await page.screenshot({ path: `e2e-shots/chrome-${info.project.name}-${lang}.png`, clip: { x: 0, y: 0, width: page.viewportSize()!.width, height: page.viewportSize()!.height } });
    await stageChrome(page, -1200);
    checkChrome(await chromeGeometry(page), `${lang} -1200`);
    // Mid-game language switch: everything re-centres and still fits.
    const other: Lang = lang === 'da' ? 'pl' : 'da';
    await switchLanguage(page, lang, other);
    await stageChrome(page);
    checkChrome(await chromeGeometry(page), `${lang} -> ${other}`);
    await expectFits(page, `${lang} -> ${other} chrome`);
  });
}
