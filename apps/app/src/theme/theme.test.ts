import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { THEMES, THEME_TOKENS, applyTheme, isThemeId } from './theme';

// vitest runs from apps/app; import.meta.url is not a file: URL under jsdom.
const css = readFileSync(resolve(process.cwd(), 'src/theme/themes.css'), 'utf8');

function block(id: string): string {
  const start = css.indexOf(`[data-theme='${id}']`);
  expect(start, `theme ${id} block`).toBeGreaterThanOrEqual(0);
  return css.slice(start, css.indexOf('}', start));
}

describe('themes', () => {
  it('lists the six themes with brass (the default) first', () => {
    expect(THEMES.map(t => t.id)).toEqual(['brass', 'wycinanki', 'boleslawiec', 'zakopane', 'noir', 'midnight']);
  });

  it('every theme has a name in every language', async () => {
    for (const lang of ['en', 'pl', 'da'] as const) {
      const dict = (await import(`../i18n/${lang}.ts`))[lang] as Record<string, string>;
      for (const th of THEMES) expect(dict[`theme.${th.id}`], `${lang} theme.${th.id}`).toBeTruthy();
    }
  });

  it('the first-paint script in index.html knows every theme', () => {
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
    for (const th of THEMES) expect(html, th.id).toContain(`'${th.id}'`);
  });

  it('every theme defines every token', () => {
    for (const t of THEMES) {
      const b = block(t.id);
      for (const token of THEME_TOKENS) expect(b, `${t.id} ${token}`).toContain(`${token}:`);
    }
  });

  it('uses the reference colours', () => {
    expect(block('brass')).toContain('#d4af6a');
    expect(block('brass')).toContain('#f8f4ea');
    expect(block('wycinanki')).toContain('#c8312b');
    expect(block('wycinanki')).toContain('#1f2740');
    expect(block('midnight')).toContain('#ff7a45');
    expect(block('midnight')).toContain('#0e1016');
    expect(block('boleslawiec')).toContain('#2148a8');
    expect(block('zakopane')).toContain('#2e1e13');
    expect(block('noir')).toContain('#f0c75e');
  });

  it('applyTheme sets data-theme and theme-color', () => {
    applyTheme('midnight');
    expect(document.documentElement.dataset.theme).toBe('midnight');
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#0e1016');
    applyTheme('brass');
    expect(document.documentElement.dataset.theme).toBe('brass');
  });

  it('isThemeId guards unknown values', () => {
    expect(isThemeId('wycinanki')).toBe(true);
    expect(isThemeId('neon')).toBe(false);
    expect(isThemeId(null)).toBe(false);
  });
});
