import { expect, test, type Page } from '@playwright/test';
import { drive, firstLaunch, handOut, labels, move } from './helpers';
import { setSafeInsets } from './layout';
import type { Lang } from '../src/i18n/types';
import { en } from '../src/i18n/en';
import { da } from '../src/i18n/da';

const DICTS = { en, da } as const;

/**
 * The announcement ticker never covers a card on the table (trick cards or the talon) and never covers an
 * opponent's avatar, name, score, chips or card backs (nor the top bar's buttons), is never cut short, and
 * showing it never changes a row height. Checked on the two phones during bidding, talon and marriage
 * announcements, with 2 opponents (practice) and 3 (lobby).
 */

type Ann = Record<string, unknown>;

/**
 * Sets the announcement (null: none) through the store (?local=1&fast=1). `opps` are the opponents who play
 * this round (with four players the dealer sits out: a sitter-out never bids, sees, declares or plays), in
 * the round's own order; the staged announcement must never name the sitter-out.
 */
async function setAnnounce(page: Page, ann: (opps: string[], me: string) => Ann | null): Promise<void> {
  const fn = ann.toString();
  await page.evaluate(src => {
    type Any = any; // eslint-disable-line @typescript-eslint/no-explicit-any
    const store = (window as unknown as { __tysiacRoom: Any }).__tysiacRoom;
    const v = store.getState().shown;
    const opps: string[] = (v.round?.active ?? v.seats.map((x: Any) => x.id)).filter((p: string) => p !== v.me);
    const a = (0, eval)(`(${src})`)(opps, v.me);
    if (a && v.round?.sittingOut && a.p === v.round.sittingOut) throw new Error(`staged ${a.kind} by the player who sits out`);
    store.setState({ announce: a ? { a, id: Math.floor(Math.random() * 1e9) } : null });
  }, fn);
  await page.waitForTimeout(350); // the ticker's fade-in
}

/**
 * A marriage lead and a follow on the table, my turn, with the marriage announced. Realistic: only the round's
 * players are in the trick (with four players the dealer sits out), the first of them in the round's order (the
 * opponent the ticker names) leads the queen of a suit whose king and queen I do not hold, the next one follows
 * with a card I do not hold, and I am to play.
 */
async function stageMarriage(page: Page): Promise<void> {
  await page.evaluate(() => {
    type Any = any; // eslint-disable-line @typescript-eslint/no-explicit-any
    const store = (window as unknown as { __tysiacRoom: Any }).__tysiacRoom;
    const v = store.getState().view;
    const me = v.me;
    const hand: { suit: string; rank: string }[] = v.round.hand;
    const mine = (suit: string, rank: string) => hand.some(c => c.suit === suit && c.rank === rank);
    const suit = ['hearts', 'diamonds', 'clubs', 'spades'].find(x => !mine(x, 'Q') && !mine(x, 'K'))!;
    const follow = ['9', 'J', '10', 'A'].find(r => !mine(suit, r))!;
    const [lead, next] = v.round.active.filter((p: string) => p !== me);
    const cards = [{ p: lead, card: { suit, rank: 'Q' } }, { p: next, card: { suit, rank: follow } }];
    if (cards.some(c => c.p === v.round.sittingOut)) throw new Error('staged a card for the player who sits out');
    const shown = { ...v, turn: me, round: { ...v.round, trump: suit, trick: { leader: lead, cards } } };
    store.setState({
      shown, view: shown, received: null, held: null, holding: false, marriage: { p: lead, suit, id: 7 },
      announce: { a: { kind: 'marriage', p: lead, suit, points: 100 }, id: 777 },
    });
  });
  await page.waitForTimeout(900);
}

/** With three opponents the ticker lies over the round title: its pill must be opaque from its first frame. */
async function pillOpacityAtStart(page: Page): Promise<number> {
  await setAnnounce(page, () => null);
  return page.evaluate(async () => {
    type Any = any; // eslint-disable-line @typescript-eslint/no-explicit-any
    const store = (window as unknown as { __tysiacRoom: Any }).__tysiacRoom;
    const v = store.getState().shown;
    const p = v.round.active.find((x: string) => x !== v.me);
    store.setState({ announce: { a: { kind: 'talonSeen', p }, id: 4242 } });
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    return Number(getComputedStyle(document.querySelector('.ticker__text')!).opacity);
  });
}

/** Row boxes, and what the ticker overlaps. */
async function geometry(page: Page) {
  return page.evaluate(() => {
    const box = (e: Element) => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom }; };
    const rows = Object.fromEntries(['.topbar', '.opps', '.table', '.zone', '.selfstrip', '.hand'].map(s => {
      const r = document.querySelector(s)!.getBoundingClientRect();
      return [s, `${r.top.toFixed(1)}+${r.height.toFixed(1)}`];
    }));
    const text = document.querySelector<HTMLElement>('.ticker__text');
    if (!text) return { rows, text: null, hits: [], clamped: false };
    const t = box(text);
    const hit = (b: ReturnType<typeof box>) => t.l < b.r - 0.5 && t.r > b.l + 0.5 && t.t < b.b - 0.5 && t.b > b.t + 0.5;
    const guarded = ['.topbar > .iconbtn', '.table .tcard', '.talon > .card', '.talon > .back', '.opp .avatar', '.opp__name', '.opp__score', '.opp .chip', '.opp .backs', '.opp__given'];
    const hits = guarded.flatMap(sel => Array.from(document.querySelectorAll(sel))
      .filter(e => hit(box(e)))
      .map(e => `${sel} "${(e.getAttribute('aria-label') ?? e.textContent ?? '').slice(0, 20)}" ${JSON.stringify(box(e))}`));
    return { rows, text: { ...t, s: text.textContent }, hits, clamped: (() => { const l = text.querySelector<HTMLElement>('.ticker__line')!; return l.scrollHeight > l.clientHeight + 1 || l.scrollWidth > l.clientWidth + 1; })() };
  });
}

/** With and without the announcement: same rows, and the ticker covers nothing it must not. */
async function checkTicker(page: Page, where: string, ann: (opps: string[], me: string) => Ann, shot?: string): Promise<void> {
  await setAnnounce(page, () => null);
  const before = await geometry(page);
  await setAnnounce(page, ann);
  const g = await geometry(page);
  expect(g.text, `${where}: the ticker shows`).not.toBeNull();
  expect(g.hits, `${where}: "${g.text?.s}" ${JSON.stringify(g.text)} covers`).toEqual([]);
  expect(g.clamped, `${where}: "${g.text?.s}" is cut short`).toBe(false);
  expect(g.rows, `${where}: rows unchanged by the ticker`).toEqual(before.rows);
  if (shot) await page.screenshot({ path: shot });
}

const insetsFor = (project: string) => (project === 'se' ? { top: 20, bottom: 0, left: 0, right: 0 } : { top: 59, bottom: 34, left: 0, right: 0 });

/** The staged marriage (run in the page): the lead and suit stageMarriage chose. */
const stagedMarriage = () => {
  const m = (window as unknown as { __tysiacRoom: { getState(): { marriage: { p: string; suit: string } } } }).__tysiacRoom.getState().marriage;
  return { kind: 'marriage', p: m.p, suit: m.suit, points: 100 };
};
const bidWon = (opps: string[]) => ({ kind: 'bidWon', p: opps[0], amount: 120 });
const passed = (opps: string[]) => ({ kind: 'pass', p: opps[1] ?? opps[0] });
const talonSeen = (opps: string[]) => ({ kind: 'talonSeen', p: opps[0] });
const wykladana = (opps: string[]) => ({ kind: 'wykladana', p: opps[0] });

for (const lang of ['en', 'pl', 'da'] as const satisfies readonly Lang[]) {
  test(`the ticker covers no card or opponent, two opponents (${lang})`, async ({ page }, info) => {
    test.skip(!['se', 'iphone15'].includes(info.project.name), 'the two phones');
    const L = labels(lang);
    const dir = `e2e-shots/ticker-${info.project.name}-${lang}`;
    await firstLaunch(page, lang);
    await page.getByRole('button', { name: L.practice }).click();
    await expect(page.locator('.zone')).toBeVisible({ timeout: 20_000 });
    await setSafeInsets(page, insetsFor(info.project.name));
    const checked = new Set<string>();
    await drive(page, {
      lang,
      bidAlways: true,
      check: async key => {
        if (key === 'bidding') {
          await checkTicker(page, `${lang} bidding (pass)`, passed);
          await checkTicker(page, `${lang} bidding (won)`, bidWon, `${dir}-bidding.png`);
        } else if (key === 'talon' || key === 'decision') {
          await checkTicker(page, `${lang} ${key}`, talonSeen, `${dir}-${key}.png`);
        } else return;
        checked.add(key);
      },
      stop: async () => (await page.locator('.zone').getAttribute('data-phase')) === 'handout',
    });
    expect(checked.has('bidding'), 'checked during bidding').toBe(true);
    await move(page, () => handOut(page, lang));
    await expect(page.locator('.zone')).toHaveAttribute('data-phase', 'tricks', { timeout: 20_000 });
    await stageMarriage(page);
    await checkTicker(page, `${lang} marriage`, stagedMarriage, `${dir}-marriage.png`);
    await checkTicker(page, `${lang} wykladana`, wykladana);
  });
}

for (const lang of ['en', 'da'] as const satisfies readonly Lang[]) {
  test(`the ticker covers no card or opponent, three opponents (${lang})`, async ({ page }, info) => {
    test.skip(!['se', 'iphone15'].includes(info.project.name), 'the two phones');
    const d = (k: keyof typeof en) => DICTS[lang][k] as string;
    const dir = `e2e-shots/ticker-${info.project.name}-4p-${lang}`;
    await firstLaunch(page, lang);
    await page.getByRole('button', { name: d('screens.home.players4') }).click();
    for (let k = 0; k < 3; k++) await page.getByRole('button', { name: d('screens.lobby.addBot') }).click();
    await page.getByRole('button', { name: d('screens.lobby.start') }).click();
    await expect(page.locator('.zone')).toBeVisible({ timeout: 20_000 });
    await setSafeInsets(page, insetsFor(info.project.name));
    let bidding = false;
    await drive(page, {
      lang,
      bidAlways: true,
      check: async key => {
        if (key === 'bidding') {
          bidding = true;
          await checkTicker(page, `4p ${lang} bidding (pass)`, passed);
          await checkTicker(page, `4p ${lang} bidding (won)`, bidWon, `${dir}-bidding.png`);
        } else if (key === 'talon' || key === 'decision') await checkTicker(page, `4p ${lang} ${key}`, talonSeen, `${dir}-${key}.png`);
      },
      stop: async () => (await page.locator('.zone').getAttribute('data-phase')) === 'handout',
    });
    expect(bidding, 'checked during bidding').toBe(true);
    await move(page, () => handOut(page, lang));
    await expect(page.locator('.zone')).toHaveAttribute('data-phase', 'tricks', { timeout: 20_000 });
    await stageMarriage(page);
    await checkTicker(page, `4p ${lang} marriage`, stagedMarriage, `${dir}-marriage.png`);
    expect(await pillOpacityAtStart(page), 'the pill over the round title is opaque from its first frame').toBe(1);
    await checkTicker(page, `4p ${lang} wykladana`, wykladana);
  });
}
