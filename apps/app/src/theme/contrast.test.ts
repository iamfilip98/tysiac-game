import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(process.cwd(), 'src/theme/themes.css'), 'utf8');
const themes = new Map<string, Record<string, string>>();
for (const m of css.matchAll(/\[data-theme='(\w+)'\]\s*\{([^}]*)\}/g)) {
  const vars: Record<string, string> = {};
  for (const d of m[2].matchAll(/(--[\w-]+):\s*([^;]+);/g)) vars[d[1]] = d[2].trim();
  themes.set(m[1], vars);
}

type RGBA = [number, number, number, number];
function parse(raw: string): RGBA {
  const c = raw.replace(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i, '#$1$1$2$2$3$3');
  const hex = c.match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/i);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, hex[2] ? parseInt(hex[2], 16) / 255 : 1];
  }
  const rgb = c.match(/^rgba?\(([^)]+)\)$/);
  if (rgb) {
    const [r, g, b, a = '1'] = rgb[1].split(',').map(s => s.trim());
    return [Number(r), Number(g), Number(b), Number(a)];
  }
  throw new Error(`unsupported colour ${c}`);
}
const over = (fg: RGBA, bg: RGBA): RGBA => [0, 1, 2].map(i => fg[i] * fg[3] + bg[i] * (1 - fg[3])).concat(1) as RGBA;
const lum = ([r, g, b]: RGBA) =>
  [r, g, b].map(v => v / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
const ratio = (a: RGBA, b: RGBA) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);

/** [foreground, background] token pairs that carry numbers or card ranks. */
const PAIRS: [string, string][] = [
  ['--ink', '--bg-solid'],
  ['--accent-ink', '--accent'],
  ['--accent-soft', '--bg-solid'],
  ['--card-ink', '--card-bg'],
  ['--card-red', '--card-bg'],
];

describe('theme contrast (WCAG AA 4.5:1)', () => {
  it('finds all three themes', () => expect([...themes.keys()].sort()).toEqual(['brass', 'midnight', 'wycinanki']));
  for (const [name, v] of themes) {
    for (const [fg, bg] of PAIRS) {
      it(`${name}: ${fg} on ${bg}`, () => {
        const base = parse(v['--bg-solid']);
        const b = over(parse(v[bg]), base);
        expect(ratio(over(parse(v[fg]), b), b)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});
