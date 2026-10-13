import { expect, test, type Page } from '@playwright/test';
import { CARD_STRIP, drive, firstLaunch, labels, move } from './helpers';
import { setSafeInsets } from './layout';

const SHOT_PROJECTS = new Set(['iphone15', 'se']);

/**
 * Stages a table state through the store (exposed only with ?local=1&fast=1). Realistic: after a marriage
 * lead and a follow (and when a card was just received) it is my turn, so view and shown agree and the
 * zone is live; a held trick has no turn and says who takes it.
 */
async function stage(page: Page, kind: 'marriage' | 'held' | 'trumpwin' | 'received' | 'summary'): Promise<void> {
  await page.evaluate(k => {
    type Any = any; // eslint-disable-line @typescript-eslint/no-explicit-any
    const store = (window as unknown as { __tysiacRoom: Any }).__tysiacRoom;
    const s = store.getState();
    const v = s.view;
    const me = v.me;
    const opps: string[] = v.round.active.filter((p: string) => p !== me);
    const [a, b] = opps;
    const hand = v.round.hand;
    const lead = hand[0];
    const other = (suit: string) => ['hearts', 'diamonds', 'clubs', 'spades'].find(x => x !== suit)!;
    const withTrick = (cards: Any[], trump: string | null) => ({ ...v, round: { ...v.round, trump, trick: { leader: cards[0]?.p ?? me, cards } } });
    if (k === 'marriage') {
      const shown = withTrick([{ p: a, card: { suit: 'hearts', rank: 'Q' } }, { p: b, card: { suit: 'hearts', rank: '9' } }], 'hearts');
      store.setState({ shown, view: shown, received: null, marriage: { p: a, suit: 'hearts', id: 1 }, held: null, holding: false, announce: { a: { kind: 'marriage', p: a, suit: 'hearts', points: 100 }, id: 99 } });
    } else if (k === 'held' || k === 'trumpwin') {
      const trump = k === 'trumpwin' ? other(lead.suit) : null;
      const win = k === 'trumpwin' ? { suit: trump, rank: '9' } : { suit: lead.suit, rank: lead.rank === 'A' ? '10' : 'A' };
      const cards = [{ p: me, card: lead }, { p: a, card: win }, { p: b, card: { suit: lead.suit, rank: lead.rank === 'J' ? '9' : 'J' } }];
      store.setState({
        shown: { ...withTrick(cards, trump), turn: null }, note: null, received: null, marriage: null, holding: true, held: { p: a, card: win, byTrump: k === 'trumpwin', points: 15 },
        announce: { a: { kind: 'trick', p: a, points: 15 }, id: 100 },
      });
    } else if (k === 'received') {
      const shown = withTrick([], v.round.trump);
      store.setState({ shown, view: shown, held: null, holding: false, marriage: null, received: { card: hand[1], from: a, open: true }, announce: { a: { kind: 'received', from: a, card: hand[1] }, id: 101 } });
    } else {
      const seats = v.seats.map((x: Any) => x.id);
      const players = seats.map((id: string, i: number) => ({
        playerId: id, trickPoints: [85, 20, 15][i] ?? 0, marriagePoints: i === 0 ? 60 : 0, totalRoundPoints: 0,
        scoreChange: [120, 20, -10][i] ?? 0, newTotalScore: [640, 820, 310][i] ?? 0, wasOnBarrel: false, fellOffBarrel: false, isDealer: i === 2, sittingOut: false,
      }));
      store.setState({ note: null, roundResult: { number: v.round.number, dealer: seats[2], bidder: seats[0], bid: 120, outcome: 'made', wykladana: false, players } });
    }
  }, kind);
}

for (const theme of ['Brass', 'Wycinanki', 'Bolesławiec', 'Zakopane', 'Noir', 'Midnight']) {
  test(`screenshots in ${theme}`, async ({ page }, info) => {
    test.skip(!SHOT_PROJECTS.has(info.project.name), 'owner phone (iphone15) and the smallest phone (se)');
    const dir = `e2e-shots/${info.project.name === 'iphone15' ? '' : `${info.project.name}-`}${theme.toLowerCase().replace('ł', 'l')}`;
    await firstLaunch(page);
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('radio', { name: new RegExp(theme) }).click();
    const coach = page.getByRole('switch', { name: 'Coach hints' });
    if ((await coach.getAttribute('aria-checked')) !== 'true') await coach.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${dir}-settings.png` });
    await page.getByRole('button', { name: 'Close' }).click();
    await page.getByRole('button', { name: 'Practice vs bots' }).click();
    await expect(page.locator('.zone')).toBeVisible({ timeout: 20_000 });
    await setSafeInsets(page, { top: info.project.name === 'se' ? 20 : 59, bottom: info.project.name === 'se' ? 0 : 34, left: 0, right: 0 });
    const shot = async (name: string, settle = 1000) => {
      await page.waitForTimeout(settle); // let hands, ticker and animations settle
      await page.screenshot({ path: `${dir}-${name}.png` });
    };
    await drive(page, {
      bidAlways: true,
      check: async key => { await shot(key.replace(/\s+/g, '-')); },
      stop: async () => (await page.locator('.zone').getAttribute('data-phase')) === 'handout',
    });
    // Hand-out: empty slots, one given (slot and the card under the opponent), both given.
    const hand = page.getByRole('group', { name: 'Your hand' });
    await shot('handout-empty');
    await hand.getByRole('button').first().click({ position: CARD_STRIP });
    await shot('handout-one', 400);
    await hand.getByRole('button').first().click({ position: CARD_STRIP });
    await shot('handout-full', 400);
    await move(page, () => page.getByRole('button', { name: 'Confirm hand-out' }).click());
    await expect(page.locator('.zone')).toHaveAttribute('data-phase', 'tricks', { timeout: 20_000 });
    await shot('coach-arrow');
    for (const kind of ['received', 'marriage', 'held', 'trumpwin'] as const) {
      await stage(page, kind);
      await shot(kind, 900);
    }
    // Reduced motion: static gold ring and static blue glow.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await stage(page, 'marriage');
    await shot('marriage-reduced', 600);
    await stage(page, 'trumpwin');
    await shot('trumpwin-reduced', 600);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await stage(page, 'trumpwin');
    await stage(page, 'summary');
    await shot('summary', 900);
  });
}

// Polish and Danish at the smallest phone: the new hand-out slots, received banner, held trick and summary rows fit.
for (const lang of ['pl', 'da'] as const) {
  test(`screenshots in ${lang} (se)`, async ({ page }, info) => {
    test.skip(info.project.name !== 'se', 'smallest phone only');
    const L = labels(lang);
    await firstLaunch(page, lang);
    await page.getByRole('button', { name: L.practice }).click();
    await expect(page.locator('.zone')).toBeVisible({ timeout: 20_000 });
    await setSafeInsets(page, { top: 20, bottom: 0, left: 0, right: 0 });
    const shot = async (name: string, settle = 900) => {
      await page.waitForTimeout(settle);
      await page.screenshot({ path: `e2e-shots/se-${lang}-${name}.png` });
    };
    await drive(page, { lang, bidAlways: true, check: async () => {}, stop: async () => (await page.locator('.zone').getAttribute('data-phase')) === 'handout' });
    const hand = page.getByRole('group', { name: L.hand });
    await hand.getByRole('button').first().click({ position: CARD_STRIP });
    await shot('handout-one', 400);
    await hand.getByRole('button').first().click({ position: CARD_STRIP });
    await move(page, () => page.getByRole('button', { name: L.confirmHandout }).click());
    await expect(page.locator('.zone')).toHaveAttribute('data-phase', 'tricks', { timeout: 20_000 });
    for (const kind of ['received', 'held', 'summary'] as const) {
      await stage(page, kind);
      await shot(kind);
    }
    // Nothing clipped in the new UI.
    const clipped = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>('.rrow__bid, .rrow__detail, .rrow__total, .received__lbl, .chip--coach'))
        .filter(e => e.offsetParent !== null && e.scrollWidth > e.clientWidth + 1)
        .map(e => `${e.className}: ${e.textContent}`),
    );
    expect(clipped).toEqual([]);
  });
}

/** Text in the Settings and menu rows that must never be cut off, in any language. */
async function clippedSheetText(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('.sheet .srow__label, .sheet .srow__hint, .sheet .segmented__opt, .sheet .tpick__name, .sheet .sgroup__title, .sheet__head h2'))
      .filter(e => e.offsetParent !== null && (e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1))
      .map(e => `${e.className}: ${e.textContent}`),
  );
}

// Settings and the in-game menu (and what they open) in every language, on the owner's phone and the smallest.
const LANG_NAME = { en: 'English', pl: 'Polski', da: 'Dansk' } as const;
for (const lang of ['en', 'pl', 'da'] as const) {
  test(`settings and menu sheets in ${lang}`, async ({ page }, info) => {
    test.skip(!SHOT_PROJECTS.has(info.project.name), 'owner phone (iphone15) and the smallest phone (se)');
    const se = info.project.name === 'se';
    const insets = se ? { top: 20, bottom: 0, left: 0, right: 0 } : { top: 59, bottom: 34, left: 0, right: 0 };
    const base = `e2e-shots/${se ? 'se-' : ''}sheets-${lang}`;
    const L = labels(lang);
    const shot = async (name: string) => {
      await page.waitForTimeout(700);
      await page.locator('.sheet__body').evaluate(e => { e.scrollTop = 0; });
      await page.waitForTimeout(100);
      expect(await clippedSheetText(page), `${lang} ${name}`).toEqual([]);
      await page.screenshot({ path: `${base}-${name}.png` });
      const body = page.locator('.sheet__body');
      if (await body.evaluate(e => e.scrollHeight > e.clientHeight + 1)) {
        await body.evaluate(e => { e.scrollTop = e.scrollHeight; });
        await page.waitForTimeout(300);
        await page.screenshot({ path: `${base}-${name}-end.png` });
      }
    };
    await firstLaunch(page);
    await setSafeInsets(page, insets);
    await page.getByRole('button', { name: 'Settings' }).click();
    if (lang !== 'en') await page.getByRole('radio', { name: LANG_NAME[lang] }).click();
    await expect(page.getByRole('dialog', { name: L.settings })).toBeVisible();
    await shot('settings');
    await page.getByRole('dialog').getByRole('button', { name: L.close }).click();
    await page.getByRole('button', { name: L.practice }).click();
    await expect(page.locator('.zone')).toBeVisible({ timeout: 20_000 });
    await setSafeInsets(page, insets);
    const menu = page.locator('.topbar button').first();
    await menu.click();
    await shot('menu');
    await page.getByRole('dialog').getByRole('button', { name: L.settings }).click();
    await shot('settings-game');
    await page.getByRole('dialog').getByRole('button', { name: L.close }).click();
    await menu.click();
    await page.getByRole('dialog').getByRole('button', { name: L.rules }).click();
    await shot('rules');
    await page.getByRole('dialog').getByRole('button', { name: L.close }).click();
    await page.locator('.topbar button').last().click();
    await shot('score');
  });
}
