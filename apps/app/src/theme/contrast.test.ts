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

/** The coach's teal (--assist*) lives in base.css: :root defaults, overridden per theme with :root[data-theme='x']. */
const base = readFileSync(join(process.cwd(), 'src/theme/base.css'), 'utf8');
const declsOf = (body: string) => Object.fromEntries([...body.matchAll(/(--assist[\w-]*):\s*([^;]+);/g)].map(d => [d[1], d[2].trim()]));
const assistDefault = declsOf(base.match(/:root\s*\{([^}]*)\}/)![1]);
const assistFor = (theme: string): Record<string, string> => {
  const own = base.match(new RegExp(`:root\\[data-theme='${theme}'\\]\\s*\\{([^}]*)\\}`));
  return { ...assistDefault, ...(own ? declsOf(own[1]) : {}) };
};

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
  // Self-strip chips: "Your turn" (accent fill) is covered above; "Dealer" is --bg-solid text on an --ink fill.
  ['--bg-solid', '--ink'],
  // The Coach chip (text on the teal fill) and the coach line label (teal text on the table).
  ['--assist-ink', '--assist'],
  ['--assist-text', '--bg-solid'],
  ['--assist-text', '--panel'],
];

describe('theme contrast (WCAG AA 4.5:1)', () => {
  it('finds all three themes', () => expect([...themes.keys()].sort()).toEqual(['brass', 'midnight', 'wycinanki']));
  for (const [name, own] of themes) {
    const v = { ...assistFor(name), ...own };
    for (const [fg, bg] of PAIRS) {
      it(`${name}: ${fg} on ${bg}`, () => {
        const base = parse(v['--bg-solid']);
        const b = over(parse(v[bg]), base);
        expect(ratio(over(parse(v[fg]), b), b)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});

describe('coach outline (gold, 3:1 non-text contrast against the table)', () => {
  for (const [name, v] of themes) {
    it(`${name}: --coach on --bg-solid`, () => {
      const b = parse(v['--bg-solid']);
      expect(ratio(parse(v['--coach']), b)).toBeGreaterThanOrEqual(3);
    });
  }
});

describe("the coach's own colour (teal, apart from the marriage gold, red suits and trump blue)", () => {
  const hue = ([r, g, b]: RGBA) => {
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return (h * 60 + 360) % 360;
  };
  for (const name of themes.keys()) {
    it(`${name}: --assist is a teal hue (160-185 deg)`, () => {
      const h = hue(parse(assistFor(name)['--assist']));
      expect(h).toBeGreaterThanOrEqual(160);
      expect(h).toBeLessThanOrEqual(185);
    });
  }
});
