import { describe, expect, it } from 'vitest';
import { CARD_H, WIN_SCALE, corners, placeBox, ringFor } from './ring';
import type { Spot } from './seating';

type Pt = [number, number];

/** Separating axis test for two convex polygons. */
function overlap(a: Pt[], b: Pt[]): boolean {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const [x1, y1] = poly[i]!;
      const [x2, y2] = poly[(i + 1) % poly.length]!;
      const nx = y2 - y1, ny = x1 - x2;
      const proj = (p: Pt[]) => p.map(([x, y]) => x * nx + y * ny);
      const pa = proj(a), pb = proj(b);
      if (Math.max(...pa) <= Math.min(...pb) || Math.max(...pb) <= Math.min(...pa)) return false;
    }
  }
  return true;
}

/** The corner index (rank over suit, the tallest rank with a tail) in card widths from the card's centre, with a margin. */
const M = 0.02;
const INDEX = { l: -0.47 - M, t: -CARD_H / 2 + 0.057 - M, r: -0.17 + M, b: 0.013 + M };

const SPOTS: Spot[] = ['me', 'left', 'top', 'right'];
/** Every round's three players: the 3-player table and the four ways a 4-player round leaves one seat out. */
const SETS: Spot[][] = [['me', 'left', 'right'], ...SPOTS.map(out => SPOTS.filter(s => s !== out))];

describe('trick ring', () => {
  for (const used of SETS) {
    const ring = ringFor(used);
    it(`${used.join(', ')}: no card, even the grown winner, can cover another card's index`, () => {
      expect(Object.keys(ring.places).sort()).toEqual([...used].sort());
      const hits: string[] = [];
      for (const a of used) {
        for (const b of used) {
          if (a === b) continue;
          if (overlap(corners(ring.places[a]!, WIN_SCALE), placeBox(ring.places[b]!, INDEX))) hits.push(`${a} covers ${b}'s index`);
        }
      }
      expect(hits).toEqual([]);
    });

    it(`${used.join(', ')}: centred top to bottom, and compact enough for a small phone's table`, () => {
      let l = Infinity, r = -Infinity, t = Infinity, b = -Infinity;
      for (const p of Object.values(ring.places)) for (const [x, y] of corners(p!, WIN_SCALE)) {
        l = Math.min(l, x); r = Math.max(r, x); t = Math.min(t, y); b = Math.max(b, y);
      }
      expect(Math.abs(t + b)).toBeLessThan(0.01);
      expect(ring.w).toBeCloseTo(2 * Math.max(-l, r), 2);
      expect(ring.h).toBeCloseTo(b - t, 2);
      // At most 2.6 card widths tall (a 4-player trick on an iPhone SE keeps cards about 55 px wide).
      expect(ring.h).toBeLessThan(2.6);
      expect(ring.w).toBeLessThan(4.4);
    });
  }

  it('a 3-player trick keeps my card in the middle column', () => {
    expect(ringFor(['me', 'left', 'right']).places.me!.x).toBeCloseTo(0, 1);
  });
});
