import { describe, expect, it } from 'vitest';
import { opponentIds, spotsFor } from './seating';

describe('seating', () => {
  it('3 players: me at the bottom, then left and right clockwise', () => {
    expect(spotsFor(['a', 'me', 'c'], 'me')).toEqual({ me: 'me', c: 'left', a: 'right' });
    expect(opponentIds(['a', 'me', 'c'], 'me')).toEqual(['c', 'a']);
  });

  it('4 players: left, top, right', () => {
    expect(spotsFor(['me', 'b', 'c', 'd'], 'me')).toEqual({ me: 'me', b: 'left', c: 'top', d: 'right' });
    expect(opponentIds(['me', 'b', 'c', 'd'], 'me')).toEqual(['b', 'c', 'd']);
  });
});
