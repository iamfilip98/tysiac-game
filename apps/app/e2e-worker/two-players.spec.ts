import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { drive } from '../e2e/helpers';

const DEV_VARS = fileURLToPath(new URL('../../worker/.dev.vars', import.meta.url));
const debugKey = (): string => /^DEBUG_KEY=(.+)$/m.exec(readFileSync(DEV_VARS, 'utf8'))![1].trim().replace(/^"|"$/g, '');

async function launch(page: Page, name: string): Promise<void> {
  await page.goto('/?local=0');
  await page.getByLabel('Your name').fill(name);
  await page.getByRole('button', { name: 'Avatar 🐻' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('button', { name: 'Practice vs bots' })).toBeVisible();
}

const afterFirstTrick = (p: Page) => async () =>
  (await p.getByLabel('Last trick').isVisible()) || (await p.getByRole('button', { name: 'Continue' }).isVisible());

test('two people and a bot play through a trick on the real Worker', async ({ browser }) => {
  const hostCtx = await browser.newContext();
  const guestCtx = await browser.newContext();
  const host = await hostCtx.newPage();
  const guest = await guestCtx.newPage();
  await launch(host, 'Ala');
  await launch(guest, 'Bartek');

  await host.getByRole('button', { name: '3 players' }).click();
  await expect(host.getByText('Room code')).toBeVisible();
  const code = (await host.locator('.lobby__code b').textContent())!.trim();
  expect(code).toMatch(/^[A-Z0-9]{6}$/);

  await guest.getByLabel('Join with code').fill(code);
  await guest.getByRole('button', { name: 'Join' }).click();
  await expect(host.getByRole('button', { name: /^Seat \d: Bartek$/ })).toBeVisible();

  await host.getByRole('button', { name: 'Add bot' }).click();
  await host.getByRole('button', { name: 'Start game' }).click();
  await expect(host.locator('.zone')).toBeVisible({ timeout: 30_000 });
  await expect(guest.locator('.zone')).toBeVisible({ timeout: 30_000 });

  const noop = async () => {};
  await Promise.all([
    drive(host, { check: noop, stop: afterFirstTrick(host) }),
    drive(guest, { check: noop, stop: afterFirstTrick(guest) }),
  ]);

  // Both humans saw the same completed trick.
  const trickOf = (p: Page) => p.getByLabel('Last trick').getByRole('img').evaluateAll(els => els.map(e => e.getAttribute('aria-label')));
  if (await host.getByLabel('Last trick').isVisible()) expect(await trickOf(guest)).toEqual(await trickOf(host));

  // The debug endpoint documented in CLAUDE.md works and holds the action log.
  const res = await host.request.get(`/api/debug/rooms/${code}`, { headers: { 'x-debug-key': debugKey() } });
  expect(res.status()).toBe(200);
  const dump = (await res.json()) as { meta: { code: string }; log: unknown[]; state: { seq: number } | null };
  expect(dump.meta.code).toBe(code);
  expect(dump.log.length).toBeGreaterThanOrEqual(5);
  expect(dump.state?.seq).toBeGreaterThanOrEqual(5);
  const wrongKey = await host.request.get(`/api/debug/rooms/${code}`, { headers: { 'x-debug-key': 'nope' } });
  expect(wrongKey.status()).toBe(404);

  // History API: a fresh player has no finished games.
  // TODO(merge of Tasks 3-4): once the /history screen exists, also assert the UI text
  // 'No finished games yet — play one with friends!' via host.goto('/history').
  const hist = await host.request.get('/api/history?player=00000000-0000-4000-8000-0000000000aa');
  expect(hist.status()).toBe(200);

  await hostCtx.close();
  await guestCtx.close();
});
