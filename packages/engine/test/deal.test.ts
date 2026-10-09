import { describe, it, expect } from 'vitest';
import { cardKey, createDeck, parseCards } from '../src/cards';
import { makeRandom, nextRandom, seedState, shuffle } from '../src/rng';
import { activeFor, dealCards, dealerIndexFor, isHandValid } from '../src/deal';
import { createGame } from '../src/game';
import { SEATS3, SEATS4 } from './helpers';

describe('rng', () => {
  it('is deterministic per seed and stays in [0,1)', () => {
    expect(seedState('abc')).toMatch(/^[0-9a-f]{8}$/);
    expect(seedState('abc')).toBe(seedState('abc'));
    expect(seedState('abc')).not.toBe(seedState('abd'));
    let s = seedState('x');
    for (let i = 0; i < 1000; i++) {
      const [v, n] = nextRandom(s);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      s = n;
    }
    const r1 = makeRandom('q');
    const r2 = makeRandom('q');
    expect([r1(), r1(), r1()]).toEqual([r2(), r2(), r2()]);
  });
  it('shuffle is a deterministic permutation', () => {
    const deck = createDeck();
    const [a, sa] = shuffle(deck, seedState('1'));
    const [b, sb] = shuffle(deck, seedState('1'));
    const [c] = shuffle(deck, seedState('2'));
    expect(a).toEqual(b);
    expect(sa).toBe(sb);
    expect(a).not.toEqual(c);
    expect(new Set(a.map(cardKey)).size).toBe(24);
    expect(deck).toEqual(createDeck());
  });
});

describe('deal', () => {
  it('dealer rotates from the chosen first dealer', () => {
    expect(dealerIndexFor(0, 1, 3)).toBe(0);
    expect(dealerIndexFor(0, 2, 3)).toBe(1);
    expect(dealerIndexFor(2, 2, 3)).toBe(0);
    expect(dealerIndexFor(3, 2, 4)).toBe(0);
  });
  it('active players start left of the dealer; 4 players exclude the dealer', () => {
    expect(activeFor(['a', 'b', 'c'], 0)).toEqual(['b', 'c', 'a']);
    expect(activeFor(['a', 'b', 'c', 'd'], 1)).toEqual(['c', 'd', 'a']);
  });
  it('hand is valid with >= 18 points or a marriage', () => {
    expect(isHandValid(parseCards('AH KS 9S 9D JD 9C 9H'))).toBe(false); // 17
    expect(isHandValid(parseCards('AH KS JS 9D JD 9C JC'))).toBe(true); // 21
    expect(isHandValid(parseCards('KS QS 9S 9D JD 9C 9H'))).toBe(true); // marriage
  });
  it('deals 7/7/7 + talon 3, all valid, redealing when needed', () => {
    let sawRedeal = false;
    for (let i = 0; i < 300; i++) {
      const d = dealCards(seedState(`deal-${i}`), ['a', 'b', 'c']);
      expect(Object.values(d.hands).map(h => h.length)).toEqual([7, 7, 7]);
      expect(d.talon).toHaveLength(3);
      const all = [...Object.values(d.hands).flat(), ...d.talon].map(cardKey);
      expect(new Set(all).size).toBe(24);
      for (const h of Object.values(d.hands)) expect(isHandValid(h)).toBe(true);
      if (d.redeals > 0) sawRedeal = true;
    }
    expect(sawRedeal).toBe(true);
  });
});

describe('createGame', () => {
  it('deals round 1 with the chosen first dealer', () => {
    const s = createGame({ seed: 'g1', seats: SEATS3, maxPlayers: 3, firstDealer: 1 });
    expect(s.v).toBe(1);
    expect(s.seq).toBe(0);
    expect(s.phase).toBe('bidding');
    const r = s.round!;
    expect(r.number).toBe(1);
    expect(r.dealer).toBe('b');
    expect(r.active).toEqual(['c', 'a', 'b']);
    expect(r.bid).toEqual({ high: 'c', amount: 100, turn: 'a', passed: [] });
    expect(r.talonPublic).toBe(false);
    expect(r.trump).toBeNull();
    expect(r.trick).toEqual({ leader: 'c', cards: [] });
    expect(r.handoutGiven).toBeNull();
    expect(r.lastTrick).toBeNull();
    expect(s.scores).toEqual({ a: { total: 0, history: [] }, b: { total: 0, history: [] }, c: { total: 0, history: [] } });
    expect(s.rounds).toEqual([]);
    expect(s.paused).toBeNull();
    expect(s.winner).toBeNull();
  });
  it('is deterministic per seed and JSON-safe', () => {
    const a = createGame({ seed: 'same', seats: SEATS3, maxPlayers: 3, firstDealer: 0 });
    const b = createGame({ seed: 'same', seats: SEATS3, maxPlayers: 3, firstDealer: 0 });
    const c = createGame({ seed: 'other', seats: SEATS3, maxPlayers: 3, firstDealer: 0 });
    expect(a).toEqual(b);
    expect(a.round!.hands).not.toEqual(c.round!.hands);
    expect(JSON.parse(JSON.stringify(a))).toEqual(a);
  });
  it('4 players: dealer sits out with no hand', () => {
    const s = createGame({ seed: 'g4', seats: SEATS4, maxPlayers: 4, firstDealer: 3 });
    const r = s.round!;
    expect(r.dealer).toBe('d');
    expect(r.active).toEqual(['a', 'b', 'c']);
    expect(Object.keys(r.hands).sort()).toEqual(['a', 'b', 'c']);
  });
  it('rejects bad options', () => {
    expect(() => createGame({ seed: 'x', seats: SEATS3, maxPlayers: 4, firstDealer: 0 })).toThrow();
    expect(() => createGame({ seed: 'x', seats: [SEATS3[0], SEATS3[0], SEATS3[1]], maxPlayers: 3, firstDealer: 0 })).toThrow();
    expect(() => createGame({ seed: 'x', seats: SEATS3, maxPlayers: 3, firstDealer: 3 })).toThrow();
  });
});
