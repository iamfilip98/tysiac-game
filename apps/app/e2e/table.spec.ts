import { expect, test, type Page } from '@playwright/test';
import { drive, firstLaunch, handOut, labels, move, selectLegalCard, expectPhase } from './helpers';

/**
 * Records, on every animation frame, each trick card on the table and the cards the store says are in the
 * trick (shown + my pending card). Two things must hold while a card is in the trick:
 * - its spot (its untransformed layout box, which is what the table geometry decides) never moves;
 * - once its own fly-in has finished, what you see (its screen box) never moves: not when the next card
 *   lands, not while the trick is held, not when the winner is highlighted (the winner may grow in place,
 *   so for it only its centre counts).
 */
async function startRecorder(page: Page): Promise<void> {
  await page.evaluate(() => {
    type Any = any; // eslint-disable-line @typescript-eslint/no-explicit-any
    const w = window as unknown as { __frames: Any[]; __rec: boolean; __tysiacRoom: Any };
    w.__frames = [];
    w.__rec = true;
    const key = (c: { suit: string; rank: string }) => `${c.rank}${c.suit}`;
    /** Motion's inline transform is (near) identity: the card's own fly-in or layout animation is over. */
    const still = (tf: string) => {
      if (tf === '' || tf === 'none') return true;
      // translateX/Y in % of the card (motion's own flight), translate3d in px (a layout projection), scale.
      const parts = [...tf.matchAll(/(translate3d|translate[XY]|scale)\(([^)]*)\)/g)];
      return parts.every(([, fn, args]) => {
        const v = args.split(',').map(a => parseFloat(a));
        if (fn === 'scale') return v.every(x => Math.abs(x - 1) < 0.005);
        if (fn === 'translate3d') return v.every(x => Math.abs(x) < 0.75);
        return Math.abs(v[0]) < 1; // per cent of a 46-92 px card: under 1 px
      });
    };
    const tick = () => {
      if (!w.__rec) return;
      const s = w.__tysiacRoom.getState();
      const inTrick: string[] = (s.shown?.round?.trick.cards ?? []).map((tc: Any) => key(tc.card));
      if (s.pending) inTrick.push(key(s.pending.card));
      const table = document.querySelector('.table')!.getBoundingClientRect();
      const cards: Record<string, Any> = {};
      for (const el of Array.from(document.querySelectorAll<HTMLElement>('.table .tcard'))) {
        const r = el.getBoundingClientRect();
        cards[el.getAttribute('data-key')!] = {
          l: r.left, t: r.top, w: r.width, h: r.height,
          spotL: table.left + el.offsetLeft, spotT: table.top + el.offsetTop,
          op: Number(getComputedStyle(el).opacity), still: still(el.style.transform), win: el.hasAttribute('data-win'), tf: el.style.transform, cls: el.className,
        };
      }
      const box = (sel: string) => { const b = document.querySelector(sel)?.getBoundingClientRect(); return b ? `${b.top.toFixed(1)}+${b.height.toFixed(1)}` : null; };
      w.__frames.push({ inTrick, cards, held: !!s.held, table: box('.table'), zone: box('.zone') });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

interface Move { what: string; key: string; frame: number; dx: number; dy: number; dw: number; dh: number; held: boolean; win: boolean; table: string; zone: string }

async function stopRecorder(page: Page): Promise<{ moves: Move[]; checks: number; frames: number; heldFrames: number; winFrames: number }> {
  return page.evaluate(() => {
    type Any = any; // eslint-disable-line @typescript-eslint/no-explicit-any
    const w = window as unknown as { __frames: Any[]; __rec: boolean };
    w.__rec = false;
    const frames = w.__frames;
    const spot: Record<string, Any> = {};
    const rest: Record<string, Any> = {};
    const moves: Any[] = [];
    let heldFrames = 0;
    let winFrames = 0;
    let checks = 0; // frames where a resting card was checked while another card was arriving or the trick was held
    for (let i = 1; i < frames.length; i++) {
      const f = frames[i];
      const prev = frames[i - 1];
      if (f.held) heldFrames++;
      if (Object.values(f.cards).some((c: Any) => c.win)) winFrames++;
      const ctx = (k: string, what: string, a: Any, b: Any, dw: number, dh: number) => moves.push({
        what, key: k, frame: i, dx: +(b.l - a.l).toFixed(1), dy: +(b.t - a.t).toFixed(1), dw: +dw.toFixed(1), dh: +dh.toFixed(1),
        held: f.held, win: b.win, tf: `${a.tf} -> ${b.tf}`, cls: b.cls, table: `${prev.table} -> ${f.table}`, zone: `${prev.zone} -> ${f.zone}`,
      });
      for (const k of Object.keys(spot)) if (!f.inTrick.includes(k)) { delete spot[k]; delete rest[k]; } // swept
      const arriving = f.inTrick.some((k: string) => f.cards[k] && !f.cards[k].still);
      for (const k of f.inTrick) {
        const c = f.cards[k];
        if (!c) continue;
        const home = { l: c.spotL, t: c.spotT };
        if (!spot[k]) spot[k] = home;
        else if (Math.abs(home.l - spot[k].l) > 1 || Math.abs(home.t - spot[k].t) > 1) {
          ctx(k, 'spot', spot[k], home, 0, 0);
          spot[k] = home;
        }
        if (!rest[k]) {
          // Landed: its spring has been (near) identity for three frames running (a single near-zero frame can
          // be the spring passing through zero on its small overshoot).
          const run = [0, 1, 2].every(j => { const x = frames[i - j]?.cards[k]; return x && x.op === 1 && x.still; });
          if (run) rest[k] = c;
          continue;
        }
        if (arriving || f.held) checks++;
        // The winner grows in place: compare its centre. Every other card: its whole box.
        const a = rest[k];
        const cx = (b: Any) => b.l + b.w / 2, cy = (b: Any) => b.t + b.h / 2;
        const moved = c.win
          ? Math.abs(cx(c) - cx(a)) > 1 || Math.abs(cy(c) - cy(a)) > 1
          : Math.abs(c.l - a.l) > 1 || Math.abs(c.t - a.t) > 1 || Math.abs(c.w - a.w) > 1 || Math.abs(c.h - a.h) > 1;
        if (moved) {
          ctx(k, 'seen', a, c, c.w - a.w, c.h - a.h);
          rest[k] = c; // report each jump once
        } else if (c.win !== a.win) rest[k] = c;
      }
    }
    return { moves, checks, frames: frames.length, heldFrames, winFrames };
  });
}

// English with the coach on and off (off, the self strip has no Coach chip and, off my turn, no chip at all),
// and Polish and Danish, whose longer status lines wrap in the top bar.
const RUNS = [
  { lang: 'en', coach: true },
  { lang: 'en', coach: false },
  { lang: 'pl', coach: true },
  { lang: 'da', coach: true },
] as const;

for (const { lang, coach } of RUNS) {
  test(`trick cards sit at fixed spots: a new card, the held trick and the winner never move another card (${lang}, coach ${coach ? 'on' : 'off'})`, async ({ page }, info) => {
    test.skip(!['se', 'iphone15'].includes(info.project.name), 'the two phones');
    const L = labels(lang);
    // Real timing: in fast mode the bots play before the previous card has landed, so too little is checked.
    await firstLaunch(page, lang, { fast: false });
    if (!coach) {
      await page.getByRole('button', { name: L.settings }).click();
      const sheet = page.getByRole('dialog', { name: L.settings });
      const sw = sheet.getByRole('switch', { name: L.coachHints });
      if ((await sw.getAttribute('aria-checked')) === 'true') await sw.click();
      await expect(sw).toHaveAttribute('aria-checked', 'false');
      await sheet.getByRole('button', { name: L.close }).click();
    }
    await page.getByRole('button', { name: L.practice }).click();
    await expect(page.locator('.zone')).toBeVisible({ timeout: 20_000 });
    await drive(page, { lang, bidAlways: true, check: async () => {}, stop: async () => (await page.locator('.zone').getAttribute('data-phase')) === 'handout' });
    await move(page, () => handOut(page, lang));
    await expectPhase(page, 'tricks');
    await expect(page.locator('.selfstrip .chip--coach')).toHaveCount(coach ? 1 : 0);
    await startRecorder(page);
    // Play four tricks through the UI: every one has cards landing next to rested ones, a hold and a winner.
    for (let n = 0; n < 4; n++) {
      await expect(page.getByRole('button', { name: /./ }).first()).toBeVisible();
      await expect.poll(() => page.locator('.zone').getAttribute('data-phase'), { timeout: 20_000 }).toBe('tricks');
      await expect(page.locator('.hand button:not([aria-disabled="true"])').first()).toBeVisible({ timeout: 20_000 });
      await page.waitForFunction(() => {
        const s = (window as unknown as { __tysiacRoom: { getState(): { shown: { turn: string; me: string } | null; queue: unknown[]; holding: boolean } } }).__tysiacRoom.getState();
        return s.shown?.turn === s.shown?.me && s.queue.length === 0 && !s.holding;
      }, null, { timeout: 20_000 });
      await move(page, async () => {
        const label = await selectLegalCard(page, false, lang);
        await page.getByRole('button', { name: L.playCard(label) }).click();
      });
      await page.waitForTimeout(400);
    }
    await page.waitForTimeout(3000);
    const res = await stopRecorder(page);
    console.log(info.project.name, JSON.stringify({ frames: res.frames, checks: res.checks, held: res.heldFrames, win: res.winFrames, moves: res.moves.slice(0, 20) }));
    expect(res.checks, 'resting cards were checked while others landed or the trick was held').toBeGreaterThan(100);
    expect(res.heldFrames, 'a held trick was recorded').toBeGreaterThan(0);
    expect(res.winFrames, 'a highlighted winner was recorded').toBeGreaterThan(0);
    expect(res.moves).toEqual([]);
  });
}

// Four players: the dealer sits out and the other three play to spots fixed for the round. Watched from the
// sit-out round (three opponents' cards) and from a round I play in (with the player across in the trick or not).
test('four players: trick cards sit at fixed spots, sitting out and playing (en)', async ({ page }, info) => {
  test.skip(!['se', 'iphone15'].includes(info.project.name), 'the two phones');
  const L = labels('en');
  await firstLaunch(page, 'en', { fast: false });
  await page.getByRole('button', { name: '4 players' }).click();
  for (let k = 0; k < 3; k++) await page.getByRole('button', { name: 'Add bot' }).click();
  await page.getByRole('button', { name: 'Start game' }).click(); // the host deals first: round 1 is my sit-out round
  await expect(page.locator('.zone')).toBeVisible({ timeout: 20_000 });
  const tricksDone = () => page.evaluate(() => {
    const s = (window as unknown as { __tysiacRoom: { getState(): { shown: { me: string; round: { number: number; sittingOut: string | null; tricksTaken: Record<string, number> } | null } | null } } }).__tysiacRoom.getState();
    const r = s.shown?.round;
    return { round: r?.number ?? 0, out: r?.sittingOut === s.shown?.me, done: Object.values(r?.tricksTaken ?? {}).reduce((a, b) => a + b, 0) };
  });
  expect((await tricksDone()).out, 'round 1: I sit out').toBe(true);
  // Sitting out I still confirm a public talon (bid over 100), then watch the tricks. When the bidder throws in,
  // the round has no tricks: play on to my next sit-out round.
  await drive(page, {
    check: async () => {},
    stop: async () => {
      const seen = page.getByRole('button', { name: L.seen });
      if (await seen.isVisible()) await seen.click();
      const s = await tricksDone();
      return s.out && /Trick 1/.test((await page.locator('.zone').textContent()) ?? '');
    },
  });
  await startRecorder(page);
  await expect.poll(async () => (await tricksDone()).done, { timeout: 60_000 }).toBeGreaterThanOrEqual(4);
  await page.waitForTimeout(3000);
  let res = await stopRecorder(page);
  console.log(info.project.name, '4p out', JSON.stringify({ frames: res.frames, checks: res.checks, held: res.heldFrames, win: res.winFrames, moves: res.moves.slice(0, 20) }));
  expect(res.checks, 'sitting out: resting cards were checked while others landed or the trick was held').toBeGreaterThan(100);
  expect(res.heldFrames).toBeGreaterThan(0);
  expect(res.winFrames).toBeGreaterThan(0);
  expect(res.moves).toEqual([]);

  // A round I play in: win the auction, hand out, then play four tricks through the UI.
  await drive(page, { bidAlways: true, check: async () => {}, stop: async () => (await page.locator('.zone').getAttribute('data-phase')) === 'handout' });
  await move(page, () => handOut(page));
  await expectPhase(page, 'tricks');
  await startRecorder(page);
  for (let n = 0; n < 4; n++) {
    await expect(page.locator('.hand button:not([aria-disabled="true"])').first()).toBeVisible({ timeout: 20_000 });
    await page.waitForFunction(() => {
      const s = (window as unknown as { __tysiacRoom: { getState(): { shown: { turn: string; me: string } | null; queue: unknown[]; holding: boolean } } }).__tysiacRoom.getState();
      return s.shown?.turn === s.shown?.me && s.queue.length === 0 && !s.holding;
    }, null, { timeout: 20_000 });
    await move(page, async () => {
      const label = await selectLegalCard(page, false);
      await page.getByRole('button', { name: L.playCard(label) }).click();
    });
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(3000);
  res = await stopRecorder(page);
  console.log(info.project.name, '4p in', JSON.stringify({ frames: res.frames, checks: res.checks, held: res.heldFrames, win: res.winFrames, moves: res.moves.slice(0, 20) }));
  expect(res.checks, 'playing: resting cards were checked while others landed or the trick was held').toBeGreaterThan(100);
  expect(res.heldFrames).toBeGreaterThan(0);
  expect(res.winFrames).toBeGreaterThan(0);
  expect(res.moves).toEqual([]);
});
