import { expect, test, type Page } from '@playwright/test';

export async function firstLaunch(page: Page): Promise<void> {
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
}

/**
 * Runs a move and waits until the server's next state arrives (data-seq changes). A tap that produces no
 * new state within 4 s is retried once (and annotated on the test) — a rare, unexplained dropped tap in
 * WebKit that a human would simply repeat; a second miss fails the test with a DOM summary.
 */
export async function move(page: Page, run: () => Promise<void>): Promise<void> {
  const game = page.locator('.game');
  const before = (await game.getAttribute('data-seq')) ?? '';
  await run();
  try {
    await expect(game).not.toHaveAttribute('data-seq', before, { timeout: 4000 });
    return;
  } catch {
    test.info().annotations.push({ type: 'dropped-tap', description: `no new state after seq ${before}; retried` });
  }
  await run();
  try {
    await expect(game).not.toHaveAttribute('data-seq', before);
  } catch (err) {
    const state = await page.evaluate(() => {
      const g = document.querySelector('.game');
      return `alerts: ${Array.from(document.querySelectorAll('[role=status],[role=alert]')).map(e => e.textContent).join('|')} | zone: ${g?.querySelector('.zone')?.textContent}`;
    });
    throw new Error(`no new game state after a move (seq ${before}). ${state}\n${String(err)}`);
  }
}

export async function handOut(page: Page): Promise<void> {
  const hand = page.getByRole('group', { name: 'Your hand' });
  for (let k = 0; k < 2; k++) {
    await hand.getByRole('button').first().click();
    await page.getByRole('button', { name: /^Give to / }).first().click();
  }
  await page.getByRole('button', { name: 'Confirm hand-out' }).click();
}

/** Taps the first legal card (selecting it) and returns its label; the caller taps Play. */
export async function selectLegalCard(page: Page, checkTapDoesNotPlay: boolean): Promise<string> {
  const hand = page.getByRole('group', { name: 'Your hand' });
  const selected = hand.locator('button[aria-pressed="true"]');
  const card = (await selected.count()) > 0 ? selected.first() : hand.locator('button:not([aria-disabled="true"])').first();
  const label = (await card.getAttribute('aria-label'))!;
  if ((await card.getAttribute('aria-pressed')) !== 'true') await card.click(); // tapping a selected card again would deselect it
  if (checkTapDoesNotPlay) {
    await page.waitForTimeout(300);
    await expect(hand.getByRole('button', { name: label })).toHaveAttribute('aria-pressed', 'true');
  }
  return label;
}

export interface DriveOptions {
  /** Called once per distinct screen key, at the moment it is on screen. */
  check: (key: string) => Promise<void>;
  /** Stop when this returns true (checked each step). Default: the Game over dialog. */
  stop?: () => Promise<boolean>;
}

/** Plays the game through the UI: bids, plays, hands out, continues past round results. */
export async function drive(page: Page, opts: DriveOptions): Promise<void> {
  const zone = page.locator('.zone');
  const seen = new Set<string>();
  const check = async (key: string) => {
    if (seen.has(key)) return;
    seen.add(key);
    await opts.check(key);
  };
  const stop = opts.stop ?? (() => page.getByRole('dialog', { name: 'Game over' }).isVisible());
  let tapChecked = false;
  for (let i = 0; i < 6000; i++) {
    if (await stop()) break;
    const cont = page.getByRole('button', { name: 'Continue' });
    if (await cont.isVisible()) {
      await check('round result');
      if (await stop()) break;
      await cont.click();
      continue;
    }
    const phase = await zone.getAttribute('data-phase');
    if (phase === 'bidding') {
      await check('bidding');
      const bid = page.getByRole('button', { name: /^Bid (110|120)$/ });
      await move(page, async () => {
        if (await bid.isVisible()) await bid.click();
        else await page.getByRole('button', { name: 'Pass' }).click();
      });
    } else if (phase === 'decision') {
      await check('decision');
      await move(page, () => page.getByRole('button', { name: 'Play', exact: true }).click());
    } else if (phase === 'handout') {
      await check('handout');
      await move(page, () => handOut(page));
    } else if (phase === 'tricks') {
      await move(page, async () => {
        const label = await selectLegalCard(page, !tapChecked);
        tapChecked = true;
        await check('tricks'); // a card is selected: the Play button is on screen
        await page.getByRole('button', { name: `Play ${label}` }).click();
      });
    } else {
      if (phase === 'wait') await check('waiting');
      await page.waitForTimeout(40);
    }
  }
  if (!(await stop())) throw new Error('drive ended without reaching the stop condition');
  await check(opts.stop ? 'stopped' : 'game over');
}
