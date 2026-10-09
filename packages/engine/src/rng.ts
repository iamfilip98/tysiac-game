// Seeded PRNG (sfc32, 128-bit state) whose whole state is a 32-hex-char string, so it lives in GameState.

const STATE_RE = /^[0-9a-f]{32}$/;

/** cyrb128 string hash → four uint32 words. */
function cyrb128(str: string): [number, number, number, number] {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  return [(h1 ^ h2 ^ h3 ^ h4) >>> 0, (h2 ^ h1) >>> 0, (h3 ^ h1) >>> 0, (h4 ^ h1) >>> 0];
}

/** Hashes any seed string into a 32-hex-char state. */
export function seedState(seed: string): string {
  const words = cyrb128(seed);
  // sfc32 must not start from the all-zero state.
  if (words.every(w => w === 0)) words[0] = 1;
  return words.map(toHex).join('');
}

/** Returns [value in [0,1), next state]. A malformed state is re-derived via seedState, never zeroed. */
export function nextRandom(state: string): [number, string] {
  const st = STATE_RE.test(state) ? state : seedState(state);
  let a = parseInt(st.slice(0, 8), 16);
  let b = parseInt(st.slice(8, 16), 16);
  let c = parseInt(st.slice(16, 24), 16);
  let d = parseInt(st.slice(24, 32), 16);
  const t = (((a + b) | 0) + d) | 0;
  d = (d + 1) | 0;
  a = b ^ (b >>> 9);
  b = (c + (c << 3)) | 0;
  c = (c << 21) | (c >>> 11);
  c = (c + t) | 0;
  return [(t >>> 0) / 4294967296, [a, b, c, d].map(toHex).join('')];
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
