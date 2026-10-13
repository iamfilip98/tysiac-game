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
  it('finds all six themes', () =>
    expect([...themes.keys()].sort()).toEqual(['boleslawiec', 'brass', 'midnight', 'noir', 'wycinanki', 'zakopane']));
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

/** The table effects keep their own colours in every theme (fx.css, card.css). */
const MARRIAGE_GOLD = parse('#d4af37');
const TRUMP_BLUE = parse('#60a5fa');
const hue = ([r, g, b]: RGBA): number => {
  const [R, G, B] = [r, g, b].map(v => v / 255);
  const max = Math.max(R, G, B);
  const d = max - Math.min(R, G, B);
  if (d === 0) return 0;
  const h = max === R ? ((G - B) / d) % 6 : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  return (h * 60 + 360) % 360;
};
const hueGap = (a: RGBA, b: RGBA) => Math.min(Math.abs(hue(a) - hue(b)), 360 - Math.abs(hue(a) - hue(b)));

describe('marriage gold and trump blue stay readable on every table', () => {
  for (const [name, v] of themes) {
    const table = parse(v['--bg-solid']);
    it(`${name}: the gold ring and the blue glow stand off the table`, () => {
      expect(ratio(MARRIAGE_GOLD, table)).toBeGreaterThanOrEqual(1.5);
      expect(ratio(TRUMP_BLUE, table)).toBeGreaterThanOrEqual(1.5);
    });
    it(`${name}: a trump win (blue) never looks like an ordinary win (accent ring)`, () => {
      const accent = parse(v['--accent']);
      expect(hueGap(TRUMP_BLUE, accent) >= 40 || ratio(TRUMP_BLUE, accent) >= 2).toBe(true);
    });
    it(`${name}: the coach gold is not the trump blue`, () => {
      expect(hueGap(parse(v['--coach']), TRUMP_BLUE)).toBeGreaterThanOrEqual(90);
    });
  }
});

describe("the coach's own colour (teal, apart from the marriage gold, red suits and trump blue)", () => {
  for (const name of themes.keys()) {
    it(`${name}: --assist is a teal hue (160-185 deg)`, () => {
      const h = hue(parse(assistFor(name)['--assist']));
      expect(h).toBeGreaterThanOrEqual(160);
      expect(h).toBeLessThanOrEqual(185);
    });
  }
});
