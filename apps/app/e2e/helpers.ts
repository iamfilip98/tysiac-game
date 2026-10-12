import { expect, type Page } from '@playwright/test';
import { en } from '../src/i18n/en';
import { pl } from '../src/i18n/pl';
import { da } from '../src/i18n/da';
import type { Lang } from '../src/i18n/types';

const DICTS = { en, pl, da } as const;
const LANG_NAMES: Record<Lang, string> = { en: 'English', pl: 'Polski', da: 'Dansk' };
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** UI labels in one language, straight from the app's dictionaries (so the e2e follows any rewording). */
export function labels(lang: Lang = 'en') {
  const d = DICTS[lang];
  const str = (k: keyof typeof en): string => {
    const m = d[k];
    return typeof m === 'string' ? m : m.other;
  };
  const withN = (k: keyof typeof en, n: string) => new RegExp(`^${escape(str(k)).replace(escape('{n}'), n)}$`);
  return {
    practice: str('screens.home.practice'),
    /** Any Bid button, or (with `amounts`) only those amounts. */
    bid: (amounts = '\\d+') => withN('game.bid.button', amounts),
    pass: str('game.pass'),
    play: str('game.decision.play'),
    playCard: (card: string) => str('game.trick.playCard').replace('{card}', card),
    seen: str('game.talon.seen'),
    continue: str('game.result.continue'),
    confirmHandout: str('game.handout.confirm'),
    giveTo: new RegExp(`^${escape(str('game.opp.giveTo')).replace(escape('{name}'), '.+')}$`),
    hand: str('game.hand'),
    gameOver: str('game.over.title'),
    rematch: str('game.over.rematch'),
    settings: str('common.settings'),
    close: str('common.close'),
  };
}

/** Records the targets of recent pointer/click events so a failed move can say where a tap actually landed. */
async function recordTaps(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __taps: string[] };
    w.__taps = [];
    const name = (e: EventTarget | null) => {
      if (!(e instanceof Element)) return String(e);
      return `${e.tagName.toLowerCase()}.${String(e.className).replace(/\s+/g, '.')}[${e.getAttribute('aria-label') ?? (e.textContent ?? '').slice(0, 24)}]`;
    };
    for (const type of ['pointerdown', 'pointerup', 'click']) {
      window.addEventListener(type, ev => {
        w.__taps.push(`${type} → ${name(ev.target)}`);
        if (w.__taps.length > 12) w.__taps.shift();
      }, true);
    }
  });
}

/** First launch through the profile form; with a `lang`, picks it in Settings (the default is always English). */
export async function firstLaunch(page: Page, lang: Lang = 'en'): Promise<void> {
  await recordTaps(page);
  await page.goto('/?local=1&fast=1');
  const name = page.getByLabel('Your name');
  await name.focus();
  await name.fill('Tester');
  await name.blur();
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await page.getByRole('button', { name: 'Avatar 🐻' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('button', { name: 'Practice vs bots' })).toBeVisible();
  if (lang !== 'en') {
    await page.getByRole('button', { name: labels('en').settings }).click();
    await page.getByRole('radio', { name: LANG_NAMES[lang] }).click();
    const L = labels(lang);
    const sheet = page.getByRole('dialog', { name: L.settings });
    await expect(sheet).toBeVisible();
    await sheet.getByRole('button', { name: L.close }).click();
    await expect(page.getByRole('button', { name: L.practice })).toBeVisible();
  }
}

/**
 * Runs a move and waits until the server's next state arrives (data-seq changes). There is no retry: a tap
 * that does nothing is a bug (see dropped-tap-report.md), so it fails with the DOM state and the targets
 * the last taps actually landed on.
 */
export async function move(page: Page, run: () => Promise<void>): Promise<void> {
  const game = page.locator('.game');
  const before = (await game.getAttribute('data-seq')) ?? '';
  await run();
  try {
    await expect(game).not.toHaveAttribute('data-seq', before);
  } catch (err) {
    const state = await page.evaluate(() => {
      const g = document.querySelector('.game');
      const taps = (window as unknown as { __taps?: string[] }).__taps ?? [];
      return `alerts: ${Array.from(document.querySelectorAll('[role=status],[role=alert]')).map(e => e.textContent).join('|')} | zone: ${g?.querySelector('.zone')?.textContent}\nlast taps:\n  ${taps.join('\n  ')}`;
    });
    throw new Error(`no new game state after a move (seq ${before}). ${state}\n${String(err)}`);
  }
}

/**
 * Nothing on the table may take a tap: trick cards fly over the action zone and hand (a sweep to the
 * viewer passes right over the Play button while it is already the viewer's turn) and used to swallow it.
 */
export async function expectTableIgnoresTaps(page: Page): Promise<void> {
  const problems = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.table, .table *'))
      .filter(e => getComputedStyle(e).pointerEvents !== 'none')
      .map(e => `${String(e.className)} [${e.getAttribute('aria-label') ?? ''}]`),
  );
  expect(problems, 'table elements that can intercept a tap').toEqual([]);
}

export async function handOut(page: Page, lang: Lang = 'en'): Promise<void> {
  const L = labels(lang);
  const hand = page.getByRole('group', { name: L.hand });
  for (let k = 0; k < 2; k++) {
    await hand.getByRole('button').first().click({ position: CARD_STRIP }); // the visible index strip: later cards overlap the centre
    await page.getByRole('button', { name: L.giveTo }).first().click();
  }
  await page.getByRole('button', { name: L.confirmHandout }).click();
}

/** Taps the first legal card (selecting it) and returns its label; the caller taps Play. */
export async function selectLegalCard(page: Page, checkTapDoesNotPlay: boolean, lang: Lang = 'en'): Promise<string> {
  const hand = page.getByRole('group', { name: labels(lang).hand });
  const selected = hand.locator('button[aria-pressed="true"]');
  const card = (await selected.count()) > 0 ? selected.first() : hand.locator('button:not([aria-disabled="true"])').first();
  const label = (await card.getAttribute('aria-label'))!;
  if ((await card.getAttribute('aria-pressed')) !== 'true') await card.click({ position: CARD_STRIP }); // tapping a selected card again would deselect it
  if (checkTapDoesNotPlay) {
    await page.waitForTimeout(300);
    await expect(hand.getByRole('button', { name: label })).toHaveAttribute('aria-pressed', 'true');
  }
  return label;
}

/** Hand cards overlap; only their left strip is always uncovered. */
export const CARD_STRIP = { x: 6, y: 10 };

export interface DriveOptions {
  /** Called once per distinct screen key, at the moment it is on screen. */
  check: (key: string) => Promise<void>;
  /** Stop when this returns true (checked each step). Default: the Game over dialog. */
  stop?: () => Promise<boolean>;
  /** Bid whenever any Bid button is offered, so the human wins the auction (reaches decision and hand-out). */
  bidAlways?: boolean;
  /** Pass at every auction, so a bot wins (and above 100 the human must confirm the talon). */
  passAlways?: boolean;
  /** UI language the buttons are found in (default English). */
  lang?: Lang;
}

/** Plays the game through the UI: bids, plays, hands out, continues past round results. */
export async function drive(page: Page, opts: DriveOptions): Promise<void> {
  const zone = page.locator('.zone');
  const L = labels(opts.lang);
  const seen = new Set<string>();
  const check = async (key: string) => {
    if (seen.has(key)) return;
    seen.add(key);
    await opts.check(key);
  };
  const stop = opts.stop ?? (() => page.getByRole('dialog', { name: L.gameOver }).isVisible());
  let tapChecked = false;
  for (let i = 0; i < 6000; i++) {
    if (await stop()) break;
    const cont = page.getByRole('button', { name: L.continue });
    if (await cont.isVisible()) {
      await check('round result');
      if (await stop()) break;
      await cont.click();
      continue;
    }
    const phase = await zone.getAttribute('data-phase');
    if (phase === 'bidding') {
      await check('bidding');
      const bid = page.getByRole('button', { name: opts.bidAlways ? L.bid() : L.bid('(110|120)') }).first();
      await move(page, async () => {
        if (!opts.passAlways && (await bid.isVisible())) await bid.click();
        else await page.getByRole('button', { name: L.pass }).click();
      });
    } else if (phase === 'talon') {
      await check('talon');
      const seen = page.getByRole('button', { name: L.seen });
      if (await seen.isVisible()) await move(page, () => seen.click());
      else await page.waitForTimeout(40);
    } else if (phase === 'decision') {
      await check('decision');
      await move(page, () => page.getByRole('button', { name: L.play, exact: true }).click());
    } else if (phase === 'handout') {
      await check('handout');
      await move(page, () => handOut(page, opts.lang));
    } else if (phase === 'tricks') {
      await move(page, async () => {
        const label = await selectLegalCard(page, !tapChecked, opts.lang);
        tapChecked = true;
        await check('tricks'); // a card is selected: the Play button is on screen
        await expectTableIgnoresTaps(page);
        await page.getByRole('button', { name: L.playCard(label) }).click();
      });
    } else {
      if (phase === 'wait') await check('waiting');
      await page.waitForTimeout(40);
    }
  }
  if (!(await stop())) throw new Error('drive ended without reaching the stop condition');
  await check(opts.stop ? 'stopped' : 'game over');
}
