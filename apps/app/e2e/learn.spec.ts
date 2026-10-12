import { expect, test, type Page } from '@playwright/test';
import { CARD_STRIP, firstLaunch, move } from './helpers';
import { expectFits, expectSafe, setSafeInsets } from './layout';

interface ExpectedHint { type: string; amount?: number; card?: string; give?: { card: string; to: string }[] }

async function perform(page: Page, e: ExpectedHint): Promise<void> {
  const hand = page.getByRole('group', { name: 'Your hand' });
  switch (e.type) {
    case 'bid':
      return page.getByRole('button', { name: `Bid ${e.amount}` }).click();
    case 'pass':
      return page.getByRole('button', { name: 'Pass' }).click();
    case 'play':
      return page.getByRole('button', { name: 'Play', exact: true }).click();
    case 'throw':
      return page.getByRole('button', { name: 'Throw in' }).click();
    case 'card':
      await hand.getByRole('button', { name: e.card! }).click({ position: CARD_STRIP });
      return page.getByRole('button', { name: `Play ${e.card}` }).click();
    case 'handout':
      for (const g of e.give!) {
        await hand.getByRole('button', { name: g.card }).click({ position: CARD_STRIP });
        await page.getByRole('button', { name: `Give to ${g.to}` }).click();
      }
      return page.getByRole('button', { name: 'Confirm hand-out' }).click();
  }
  throw new Error(`unknown expected action ${e.type}`);
}

/** Walks the whole lesson; calls check(label) at each beat and each move. Returns the beat ids seen. */
async function walkLesson(page: Page, check: (label: string) => Promise<void>): Promise<string[]> {
  const hook = page.getByTestId('lesson');
  const beats: string[] = [];
  let triedOffScript = false;
  for (let i = 0; i < 4000; i++) {
    if (await page.getByRole('button', { name: 'Practice with coach' }).isVisible()) {
      beats.push('done');
      await check('beat done');
      return beats;
    }
    const next = page.getByRole('button', { name: 'Next' });
    if (await next.isVisible()) {
      const id = (await hook.getAttribute('data-beat')) ?? '?';
      if (beats.at(-1) !== id) beats.push(id);
      await check(`beat ${id}`);
      await next.click();
      continue;
    }
    const cont = page.getByRole('button', { name: 'Continue' });
    if (await cont.isVisible()) {
      await cont.click();
      continue;
    }
    const raw = await hook.getAttribute('data-expected');
    if (raw) {
      const e = JSON.parse(raw) as ExpectedHint;
      await check(`move ${e.type}`);
      if (!triedOffScript && e.type === 'bid') {
        triedOffScript = true;
        await page.getByRole('button', { name: 'Pass' }).click();
        await expect(page.getByText(/^Lesson: Bid \d+\.$/)).toBeVisible();
      }
      await move(page, () => perform(page, e));
      continue;
    }
    await page.waitForTimeout(40);
  }
  throw new Error(`lesson did not finish; beats so far: ${beats.join(', ')}`);
}

test('the lesson walks a new player through one round, then opens practice with the coach', async ({ page }) => {
  await firstLaunch(page);
  await page.getByRole('link', { name: 'Learn to play' }).click();
  await expect(page.getByRole('dialog', { name: 'Welcome to Tysiąc' })).toBeVisible({ timeout: 20_000 });
  const beats = await walkLesson(page, label => expectFits(page, `learn ${label}`));
  expect([...beats].sort()).toEqual(['welcome', 'cards', 'marriage', 'bidding', 'talon', 'handout', 'marriageLead', 'trump', 'mustBeat', 'noSuit', 'scoring', 'done'].sort());
  await page.getByRole('button', { name: 'Practice with coach' }).click();
  await expect(page).toHaveURL(/\/r\/[A-Z0-9]{6}$/);
  await expect(page.locator('.zone')).toBeVisible({ timeout: 20_000 });
});

test('iPhone insets: lesson sheets, hand and action buttons stay in the safe area', async ({ page }, info) => {
  test.skip(info.project.name !== 'iphone15', 'one safe-area run is enough');
  const insets = { top: 59, right: 0, bottom: 34, left: 0 };
  await firstLaunch(page);
  await page.getByRole('link', { name: 'Learn to play' }).click();
  await expect(page.getByRole('dialog', { name: 'Welcome to Tysiąc' })).toBeVisible({ timeout: 20_000 });
  await setSafeInsets(page, insets);
  await walkLesson(page, async label => {
    const scope = (await page.getByRole('dialog').count()) > 0 ? '[role="dialog"]' : 'body';
    await expectSafe(page, `learn ${label}`, insets, scope);
  });
});
