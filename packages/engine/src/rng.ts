// Seeded PRNG (mulberry32) whose whole state is an 8-hex-char string, so it lives in GameState.

/** FNV-1a hash of the seed → initial state. */
export function seedState(seed: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return toHex(h);
}

/** Returns [value in [0,1), next state]. */
export function nextRandom(state: string): [number, string] {
  let a = parseInt(state, 16) | 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [value, toHex(a)];
}

/** Fisher–Yates shuffle; returns [shuffled copy, next state]. */
export function shuffle<T>(items: readonly T[], state: string): [T[], string] {
  const out = [...items];
  let s = state;
  for (let i = out.length - 1; i > 0; i--) {
    const [r, next] = nextRandom(s);
    s = next;
    const j = Math.floor(r * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return [out, s];
}

/** Stateful convenience generator for bots and simulations. */
export function makeRandom(seed: string): () => number {
  let s = seedState(seed);
  return () => {
    const [v, next] = nextRandom(s);
    s = next;
    return v;
  };
}

function toHex(n: number): string {
  return (n >>> 0).toString(16).padStart(8, '0');
}
