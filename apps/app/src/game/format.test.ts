import { describe, expect, it } from 'vitest';
import { bidChip, onBarrel, pts } from './format';

describe('number labels', () => {
  it('labels points and bids', () => {
    expect(pts(230)).toBe('230 pts');
    expect(pts(-80)).toBe('\u221280 pts');
    expect(bidChip(140)).toBe('bid 140');
  });
  it('knows the barrel', () => {
    expect(onBarrel(799)).toBe(false);
    expect(onBarrel(800)).toBe(true);
  });
});
