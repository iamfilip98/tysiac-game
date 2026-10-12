import { expect, test, type Page } from '@playwright/test';
import { drive, firstLaunch, labels } from './helpers';
import { expectFits } from './layout';

/** English words that must not show in a Polish or Danish game (Danish keeps "talon": it is the Danish word too). */
const ENGLISH = {
  pl: /\b(Your turn|Bid|Pass|Play|Throw in|trick|talon|marriage|Round|Score|Seen)\b/,
  da: /\b(Your turn|Bid|Pass|Play|Throw in|trick|marriage|Round|Score|Seen)\b/,
} as const;

/** Text that no longer fits its button, chip or label (long Polish/Danish words). */
async function clippedText(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('main .btn, main .chip, main .badge, main .lbl, main .selfstrip__turn, main .ticker__text'))
      .filter(e => e.offsetParent !== null && e.scrollWidth > e.clientWidth + 1)
      .map(e => `${e.className}: "${e.textContent}" (${e.scrollWidth} > ${e.clientWidth})`),
  );
}

for (const lang of ['pl', 'da'] as const) {
  test(`a full practice game in ${lang} fits and has no English left`, async ({ page }) => {
    await firstLaunch(page, lang); // opens Settings, picks the language, closes
    const L = labels(lang);
    await expect(page.locator('html')).toHaveAttribute('lang', lang);
    await expect(page.getByRole('heading', { name: 'Tysiąc' })).toBeVisible();
    await page.getByRole('button', { name: L.practice }).click();
    await expect(page.locator('.zone')).toBeVisible({ timeout: 20_000 });
    await drive(page, {
      lang,
      check: async key => {
        await expectFits(page, `${lang} ${key}`);
        expect(await clippedText(page), `${lang} ${key}: clipped text`).toEqual([]);
        const text = await page.locator('main').innerText();
        expect(text, `${lang} ${key}`).not.toMatch(ENGLISH[lang]);
        expect(text, `${lang} ${key}: em dash`).not.toContain('—');
      },
    });
    expect(await page.title()).toBe('Tysiąc');
  });
}

test('English stays the default even when the phone is Polish', async ({ browser }) => {
  const ctx = await browser.newContext({ locale: 'pl-PL' });
  const page = await ctx.newPage();
  await page.goto('/?local=1&fast=1');
  await expect(page.getByLabel('Your name')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await ctx.close();
});

test('the chosen language survives a reload, and switching back is instant', async ({ page }) => {
  await firstLaunch(page, 'da');
  await page.reload();
  await expect(page.getByRole('button', { name: labels('da').practice })).toBeVisible();
  await page.getByRole('button', { name: labels('da').settings }).click();
  await page.getByRole('radio', { name: 'English' }).click();
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();
});
