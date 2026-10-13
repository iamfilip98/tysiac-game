import type { Spot } from './seating';

/**
 * Where the trick cards lie on the table, in card widths from the table's centre (y down), and how they are
 * turned. Only the seats that play the round get a spot (three: with four players the dealer sits out), and the
 * spots are fixed for the whole round, so a card never moves when another lands.
 *
 * Every card's top-left corner index (rank over suit) stays uncovered whatever order the cards land in and
 * whichever card wins (the winner grows to WIN_SCALE and is drawn on top); ring.test.ts checks this with the
 * real polygons. The ring's size (w × h card widths, the winner's growth included) lets the table size its
 * cards to its own box, so the trick never spills over the opponents' row or the action zone.
 */
export interface Place {
  x: number;
  y: number;
  /** Degrees, clockwise. */
  rot: number;
}

export interface Ring {
  places: Partial<Record<Spot, Place>>;
  /** Extent of the cards (the winner grown) in card widths. */
  w: number;
  h: number;
}

/** Card height / width (card.css). */
export const CARD_H = 1.42;
/** The winning card of a held trick grows to this (fx.css .tcard--win). */
export const WIN_SCALE = 1.1;

const ROT: Record<Spot, number> = { me: 0, left: -9, top: 3, right: 8 };

/** The spots of the seats that play, laid out so no card can cover another's corner index. */
export function ringFor(used: readonly Spot[]): Ring {
  const has = (s: Spot) => used.includes(s);
  // Me and the player across share the middle column. When both play, the card across sits a little right
  // of mine and high enough that, drawn over mine, it stops short of my index (and mine of its index).
  const both = has('me') && has('top');
  const shift = both ? 0.26 : 0;
  const side = 1.2 + shift;
  const raw: Partial<Record<Spot, Place>> = {};
  if (has('me')) raw.me = { x: -shift, y: has('top') ? 0.44 : 0.3, rot: ROT.me };
  if (has('top')) raw.top = { x: shift, y: has('me') ? -0.44 : -0.3, rot: ROT.top };
  if (has('left')) raw.left = { x: -side, y: 0, rot: ROT.left };
  if (has('right')) raw.right = { x: side, y: 0, rot: ROT.right };
  // Centre the cards' bounding box (winner-sized) on the table vertically, where room is short. Across, the
  // middle column stays in the middle (my card in front of me, the card across in front of that player).
  let l = Infinity, r = -Infinity, t = Infinity, b = -Infinity;
  for (const p of Object.values(raw)) {
    for (const [x, y] of corners(p, WIN_SCALE)) {
      l = Math.min(l, x); r = Math.max(r, x); t = Math.min(t, y); b = Math.max(b, y);
    }
  }
  const cy = (t + b) / 2;
  const places: Partial<Record<Spot, Place>> = {};
  for (const [s, p] of Object.entries(raw) as [Spot, Place][]) places[s] = { x: round(p.x), y: round(p.y - cy), rot: p.rot };
  return { places, w: round(2 * Math.max(-l, r)), h: round(b - t) };
}

const round = (n: number) => Math.round(n * 1000) / 1000;

/** A box's corners, in card widths from the card's centre, placed on the table (turned, then scaled about its centre). */
export function placeBox(p: Place, box: { l: number; t: number; r: number; b: number }, scale = 1): [number, number][] {
  const a = (p.rot * Math.PI) / 180;
  const cos = Math.cos(a), sin = Math.sin(a);
  return ([[box.l, box.t], [box.r, box.t], [box.r, box.b], [box.l, box.b]] as [number, number][]).map(([x, y]) => [
    p.x + scale * (x * cos - y * sin),
    p.y + scale * (x * sin + y * cos),
  ]);
}

export function corners(p: Place, scale = 1): [number, number][] {
  return placeBox(p, { l: -0.5, t: -CARD_H / 2, r: 0.5, b: CARD_H / 2 }, scale);
}
