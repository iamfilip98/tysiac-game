import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { en } from './en';
import { loadLang, pluralCategory, t } from './index';

afterEach(() => loadLang('en'));

const placeholders = (m: unknown) => [...new Set([...JSON.stringify(m).matchAll(/\{(\w+)\}/g)].map(x => x[1]))].sort();

describe('t()', () => {
  it('interpolates params', () => {
    expect(t('common.points', { n: 1 })).toBe('1 pt');
    expect(t('common.points', { n: 230 })).toBe('230 pts');
  });
  it('switches dictionaries at once', async () => {
    await loadLang('pl');
    expect(t('common.settings')).toBe('Ustawienia');
    expect(document.documentElement.lang).toBe('pl');
    await loadLang('da');
    expect(t('common.settings')).toBe('Indstillinger');
  });
  it('Polish plurals: 1 / 2–4 / 5+ (12–14 are "many")', async () => {
    expect([1, 2, 4, 5, 12, 14, 22, 25, 0].map(n => pluralCategory('pl', n))).toEqual(['one', 'few', 'few', 'many', 'many', 'many', 'few', 'many', 'many']);
    await loadLang('pl');
    expect(t('common.points', { n: 1 })).toBe('1 punkt');
    expect(t('common.points', { n: 3 })).toBe('3 punkty');
    expect(t('common.points', { n: 12 })).toBe('12 punktów');
  });
  it('Danish plurals: one / other', () => {
    expect([1, 0, 2, 21].map(n => pluralCategory('da', n))).toEqual(['one', 'other', 'other', 'other']);
  });
});

describe('dictionaries', () => {
  it('pl and da have the same placeholders as en for every key, and full plural forms', async () => {
    const { pl } = await import('./pl');
    const { da } = await import('./da');
    expect(Object.keys(pl).sort()).toEqual(Object.keys(en).sort());
    expect(Object.keys(da).sort()).toEqual(Object.keys(en).sort());
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(placeholders(pl[key]), `pl ${key}`).toEqual(placeholders(en[key]));
      expect(placeholders(da[key]), `da ${key}`).toEqual(placeholders(en[key]));
      if (typeof en[key] === 'object') {
        const p = pl[key];
        expect(typeof p === 'object' && p.one && p.few && p.many, `pl ${key} needs one/few/many`).toBeTruthy();
      }
    }
  });
});

describe('punctuation (owner ruling: no em dashes, no en dashes as punctuation)', () => {
  const texts = (m: unknown): string[] => (typeof m === 'string' ? [m] : Object.values(m as Record<string, string>));
  it('no dictionary text in any language uses an em dash or a spaced en dash', async () => {
    const { pl } = await import('./pl');
    const { da } = await import('./da');
    const bad: string[] = [];
    for (const [lang, dict] of [['en', en], ['pl', pl], ['da', da]] as const) {
      for (const [key, m] of Object.entries(dict)) {
        for (const text of texts(m)) if (/—| – /.test(text)) bad.push(`${lang} ${key}: ${text}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('no em dash in app code outside comments (user-visible literals)', () => {
    const SRC = join(process.cwd(), 'src/');
    const files = (d: string): string[] =>
      readdirSync(d).flatMap(f => (statSync(join(d, f)).isDirectory() ? files(join(d, f)) : [join(d, f)]));
    const bad: string[] = [];
    for (const f of files(SRC).filter(x => /\.tsx?$/.test(x) && !/\.test\.tsx?$/.test(x))) {
      readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        const code = line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');
        if (/^\s*\*/.test(code)) return;
        if (code.includes('—')) bad.push(`${f.slice(SRC.length)}:${i + 1}`);
      });
    }
    expect(bad).toEqual([]);
  });
});
