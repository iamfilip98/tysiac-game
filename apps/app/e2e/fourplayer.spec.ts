import { expect, test, type Page } from '@playwright/test';
import { firstLaunch, handOut, labels, move, selectLegalCard } from './helpers';
import { layoutProblems, setSafeInsets } from './layout';
import { en } from '../src/i18n/en';
import { pl } from '../src/i18n/pl';
import { da } from '../src/i18n/da';
import type { Lang } from '../src/i18n/types';

/**
 * Real four-player games against three bots (real timing), where the dealer sits each round out and the other
 * three play. Each round a different seat sits out, the viewer included. At every resting table state (the
 * talon, two cards down, the held trick with its winner, a marriage) the table is measured:
 * - no opponent label, avatar, chip, card backs or badge, the ticker, the action zone or the self strip is
 *   covered by a trick or talon card (or by the ticker);
 * - each trick card's corner index (rank and suit) is uncovered, whatever order the cards landed in;
 * - every card stays inside the table's own box (it used to spill over the opponents' row on a small phone);
 * - nothing is off screen.
 */

const DICTS = { en, pl, da } as const;

interface Sample {
  key: string;
  problems: string[];
  cards: number;
  held: boolean;
  out: boolean;
  sitter: number;
  phase: string;
}

/**
 * Waits (inside the page, frame by frame) until the table is at rest: no trick card flying, fading or growing,
 * no card leaving. Then measures that same frame. Returns null when the state changes before it settles.
 */
async function measure(page: Page): Promise<Sample | null> {
  return page.evaluate(async () => {
    type Any = any; // eslint-disable-line @typescript-eslint/no-explicit-any
    const store = (window as unknown as { __tysiacRoom: Any }).__tysiacRoom;
    const keyOf = () => {
      const s = store.getState();
      const v = s.shown;
      const r = v?.round;
      return `${r?.number}:${v?.phase}:${r?.trick.cards.length}:${s.pending ? 1 : 0}:${s.holding ? 1 : 0}:${s.roundResult ? 1 : 0}`;
    };
    const still = (el: HTMLElement) => {
      const tf = el.style.transform;
      const cs = getComputedStyle(el);
      if (Number(cs.opacity) !== 1) return false;
      if (el.getAnimations().some(a => a.playState === 'running' && !(a as Any).animationName?.startsWith?.('trump'))) {
        // CSS animations that change geometry (none on trick cards except the winner's box-shadow pulse).
        return false;
      }
      if (tf === '' || tf === 'none') return true;
      const parts = [...tf.matchAll(/(translate3d|translate[XY]|scale)\(([^)]*)\)/g)];
      return parts.every(([, fn, args]) => {
        const v = args.split(',').map(a => parseFloat(a));
        if (fn === 'scale') return v.every(x => Math.abs(x - 1) < 0.002);
        if (fn === 'translate3d') return v.every(x => Math.abs(x) < 0.5);
        return Math.abs(v[0]) < 0.5;
      });
    };
    const start = keyOf();
    const t0 = performance.now();
    let calm = 0;
    // Three calm frames in a row (a spring passes through zero on its overshoot).
    while (calm < 3) {
      await new Promise(r => requestAnimationFrame(r));
      if (keyOf() !== start || performance.now() - t0 > 2500) return null;
      const s = store.getState();
      const cards = Array.from(document.querySelectorAll<HTMLElement>('.table .tcard'));
      const inTrick = (s.shown?.round?.trick.cards.length ?? 0) + (s.pending ? 1 : 0);
      calm = cards.length === inTrick && cards.every(still) && !s.sweepTo ? calm + 1 : 0;
    }
    // The ticker's own 0.25 s fade-in is irrelevant here: hit testing ignores opacity.
    const style = document.createElement('style');
    style.textContent = '.table, .table *, .ticker, .ticker * { pointer-events: auto !important; }';
    document.head.append(style);
    const problems: string[] = [];
    const desc = (e: Element | null) => {
      if (!e) return 'nothing';
      const card = e.closest('.tcard, .talon > .card, .talon > .back');
      const el = card ?? e.closest('.ticker__text, .talon__lbl, .received, .fx') ?? e;
      return `${el.tagName.toLowerCase()}.${String(el.className).trim().split(/\s+/).slice(0, 3).join('.')}${card ? `[${card.getAttribute('aria-label') ?? 'back'}]` : ''}`;
    };
    /** Points on a grid over the middle of a box (an axis-aligned box of a rotated span: keep to its middle). */
    const grid = (r: DOMRect, inset: number, n = 3) => {
      const pts: [number, number][] = [];
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        pts.push([r.left + r.width * (inset + ((1 - 2 * inset) * i) / (n - 1)), r.top + r.height * (inset + ((1 - 2 * inset) * j) / (n - 1))]);
      }
      return pts;
    };
    /** The topmost element at a point, looking through the decorative marriage / trump-win glow. */
    const hitAt = (x: number, y: number) => document.elementsFromPoint(x, y).find(e => !e.closest('.fx')) ?? null;
    const visible = (e: HTMLElement) => {
      const cs = getComputedStyle(e);
      const r = e.getBoundingClientRect();
      return cs.visibility !== 'hidden' && cs.display !== 'none' && r.width > 0 && r.height > 0;
    };
    const name = (e: HTMLElement, sel: string) => `${sel} "${(e.getAttribute('aria-label') ?? e.textContent ?? '').trim().slice(0, 24)}"`;
    // 1. Nothing on the table (and not the ticker) covers a label, an avatar, a chip, the zone or the self strip.
    const guarded = ['.topbar > .iconbtn', '.topbar__score', '.opp .avatar', '.opp__name', '.opp__score', '.opp .chip', '.opp .backs', '.opp__out', '.opp .badge', '.opp__given', '.zone', '.selfstrip', '.ticker__text'];
    for (const sel of guarded) {
      for (const e of Array.from(document.querySelectorAll<HTMLElement>(sel)).filter(visible)) {
        for (const [x, y] of grid(e.getBoundingClientRect(), 0.08, 4)) {
          const hit = hitAt(x, y);
          if (hit && !e.contains(hit) && hit.closest('.table, .ticker')) {
            problems.push(`${name(e, sel)} covered at ${Math.round(x)},${Math.round(y)} by ${desc(hit)}`);
            break;
          }
        }
      }
    }
    // 2. Every trick card's corner index (rank and suit) is on top: nothing covers it.
    for (const card of Array.from(document.querySelectorAll<HTMLElement>('.table .tcard'))) {
      const idx = card.querySelector('.card__idx');
      for (const part of Array.from(idx?.children ?? []) as HTMLElement[]) {
        for (const [x, y] of grid(part.getBoundingClientRect(), 0.3)) {
          const hit = hitAt(x, y);
          if (hit?.closest('.tcard') !== card) {
            problems.push(`${card.getAttribute('aria-label')} ${part.className.replace('card__', '')} covered at ${Math.round(x)},${Math.round(y)} by ${desc(hit)}`);
            break;
          }
        }
      }
    }
    style.remove();
    // 3. Cards stay inside the table's box.
    const table = document.querySelector('.table')!.getBoundingClientRect();
    for (const c of Array.from(document.querySelectorAll<HTMLElement>('.table .tcard, .talon > .card, .talon > .back, .talon__lbl'))) {
      const r = c.getBoundingClientRect();
      const out = Math.max(table.top - r.top, r.bottom - table.bottom, table.left - r.left, r.right - table.right);
      if (out > 2) problems.push(`${c.getAttribute('aria-label') ?? c.className} sticks ${Math.round(out)} px out of the table`);
    }
    const s = store.getState();
    const v = s.shown;
    const r = v.round;
    const seats: string[] = v.seats.map((x: Any) => x.id);
    return {
      key: start,
      problems: [...new Set(problems)].slice(0, 10),
      cards: document.querySelectorAll('.table .tcard').length,
      held: !!s.holding,
      out: r?.sittingOut === v.me,
      sitter: seats.indexOf(r?.sittingOut),
      phase: v.phase,
    };
  });
}

async function startFourPlayers(page: Page, lang: Lang): Promise<void> {
  const d = (k: keyof typeof en) => DICTS[lang][k] as string;
  await page.getByRole('button', { name: d('screens.home.players4') }).click();
  for (let k = 0; k < 3; k++) await page.getByRole('button', { name: d('screens.lobby.addBot') }).click();
  // The host is the first dealer by default, so round 1 is the viewer's sit-out round.
  await page.getByRole('button', { name: d('screens.lobby.start') }).click();
  await expect(page.locator('.zone')).toBeVisible({ timeout: 20_000 });
}

const RUNS: { lang: Lang; theme: string; rounds: number }[] = [
  { lang: 'en', theme: 'brass', rounds: 4 },
  { lang: 'pl', theme: 'wycinanki', rounds: 2 },
  { lang: 'da', theme: 'boleslawiec', rounds: 2 },
];

for (const { lang, theme, rounds } of RUNS) {
  test(`four players: nothing overlaps, every trick card's index shows, all fits (${lang}, ${theme})`, async ({ page }, info) => {
    test.skip(!['se', 'iphone15', 'landscape'].includes(info.project.name), 'phones and landscape');
    const L = labels(lang);
    const d = (k: keyof typeof en) => DICTS[lang][k] as string;
    const dir = `e2e-shots/4p-${info.project.name}-${lang}-${theme}`;
    await firstLaunch(page, lang, { fast: false });
    await page.evaluate(t => { document.documentElement.dataset.theme = t; }, theme);
    await startFourPlayers(page, lang);
    if (info.project.name !== 'landscape') await setSafeInsets(page, info.project.name === 'se' ? { top: 20, bottom: 0, left: 0, right: 0 } : { top: 59, bottom: 34, left: 0, right: 0 });

    const samples: Sample[] = [];
    const shots = new Set<string>();
    const check = async () => {
      const m = await measure(page);
      if (!m) return;
      samples.push(m);
      const what = m.phase === 'tricks' ? (m.held ? 'held' : `trick${m.cards}`) : m.phase;
      const shot = `${m.out ? 'out' : `seat${m.sitter}out`}-${what}`;
      if (!shots.has(shot)) {
        shots.add(shot);
        await page.screenshot({ path: `${dir}-${shot}.png` });
      }
      expect.soft(m.problems, `${lang} ${m.key} (seat ${m.sitter} sits out${m.out ? ': me' : ''})`).toEqual([]);
      // Fits (a separate look: only counted when the table is still in the state just measured).
      const fit = await layoutProblems(page);
      const still = await page.evaluate(k => {
        const s = (window as unknown as { __tysiacRoom: { getState(): any } }).__tysiacRoom.getState(); // eslint-disable-line @typescript-eslint/no-explicit-any
        const r = s.shown?.round;
        return k === `${r?.number}:${s.shown?.phase}:${r?.trick.cards.length}:${s.pending ? 1 : 0}:${s.holding ? 1 : 0}:${s.roundResult ? 1 : 0}`;
      }, m.key);
      if (still) expect.soft(fit, `${lang} ${m.key} fits`).toEqual([]);
    };

    for (let i = 0; i < 20000; i++) {
      const state = await page.evaluate(() => {
        const s = (window as unknown as { __tysiacRoom: { getState(): any } }).__tysiacRoom.getState(); // eslint-disable-line @typescript-eslint/no-explicit-any
        const r = s.shown?.round;
        return { round: r?.number ?? 0, out: r?.sittingOut === s.shown?.me, cards: (r?.trick.cards.length ?? 0) + (s.pending ? 1 : 0), holding: !!s.holding };
      });
      if (state.round > rounds) break;
      if (await page.getByRole('dialog', { name: L.gameOver }).isVisible()) break;
      const cont = page.getByRole('button', { name: L.continue });
      if (await cont.isVisible()) {
        await page.waitForTimeout(600);
        await page.screenshot({ path: `${dir}-summary-r${state.round}.png` });
        await cont.click();
        continue;
      }
      const phase = await page.locator('.zone').getAttribute('data-phase');
      if (state.cards >= 2 || phase === 'talon' || (phase === 'bidding' && state.out)) await check();
      if (phase === 'bidding') {
        const bid = page.getByRole('button', { name: L.bid('(110|120)') }).first();
        await move(page, async () => {
          if (await bid.isVisible()) await bid.click();
          else await page.getByRole('button', { name: L.pass }).click();
        });
      } else if (phase === 'talon') {
        const seen = page.getByRole('button', { name: L.seen });
        if (await seen.isVisible()) await move(page, () => seen.click());
        else await page.waitForTimeout(50);
      } else if (phase === 'decision') {
        await move(page, () => page.getByRole('button', { name: L.play, exact: true }).click());
      } else if (phase === 'handout') {
        await move(page, () => handOut(page, lang));
      } else if (phase === 'tricks') {
        await move(page, async () => {
          const label = await selectLegalCard(page, false, lang);
          await page.getByRole('button', { name: L.playCard(label) }).click();
        });
      } else await page.waitForTimeout(50);
    }
    const heldBySitter = new Map<number, number>();
    for (const s of samples) if (s.held && s.cards === 3) heldBySitter.set(s.sitter, (heldBySitter.get(s.sitter) ?? 0) + 1);
    console.log(info.project.name, lang, JSON.stringify({ samples: samples.length, heldBySitter: [...heldBySitter] }));
    // Every round's sitter was seen with full held tricks (four rounds: every seat, the viewer included).
    expect(heldBySitter.size, 'rounds with held three-card tricks measured').toBe(rounds);
    for (const [, n] of heldBySitter) expect(n).toBeGreaterThanOrEqual(3);
  });
}
