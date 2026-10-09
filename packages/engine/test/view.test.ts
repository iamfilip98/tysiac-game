import { describe, it, expect } from 'vitest';
import type { GameState, PlayerView } from '../src/types';
import { createGame } from '../src/game';
import { reduce } from '../src/reduce';
import { legalActions } from '../src/actions';
import { cardKey } from '../src/cards';
import { eventsFor, explainIllegal, viewFor } from '../src/view';
import { SEATS3, SEATS4, c, cardKeysIn, hiddenCardKeys, ok, scenario } from './helpers';

function expectNoLeak(s: GameState, me: string, view: PlayerView = viewFor(s, me)) {
  const hidden = hiddenCardKeys(s, me);
  const leaked = cardKeysIn(view).filter(k => hidden.has(k));
  expect(leaked).toEqual([]);
}

describe('viewFor', () => {
  it('shows only the own hand, counts for others, no talon during bidding', () => {
    const s = createGame({ seed: 'view', seats: SEATS3, maxPlayers: 3, firstDealer: 2 });
    for (const me of ['a', 'b', 'c']) {
      const v = viewFor(s, me);
      expect(v.me).toBe(me);
      expect(v.round!.hand).toEqual(s.round!.hands[me]);
      expect(v.round!.handCounts).toEqual({ a: 7, b: 7, c: 7 });
      expect(v.round!.talon).toBeNull();
      expect(v.legal).toEqual(legalActions(s, me));
      expect(v.turn).toBe('b');
      expectNoLeak(s, me, v);
    }
  });

  it('bid stays at 100: only the bidder sees the talon', () => {
    let s = createGame({ seed: 'view100', seats: SEATS3, maxPlayers: 3, firstDealer: 2 });
    s = ok(reduce(s, 'b', { type: 'pass' }, 1)).state;
    s = ok(reduce(s, 'c', { type: 'pass' }, 2)).state;
    expect(viewFor(s, 'a').round!.talon).toEqual(s.round!.talon);
    expect(viewFor(s, 'a').round!.hand).toHaveLength(10);
    expect(viewFor(s, 'b').round!.talon).toBeNull();
    expect(viewFor(s, 'b').round!.handCounts.a).toBe(10);
    for (const me of ['a', 'b', 'c']) expectNoLeak(s, me);
  });

  it('bid above 100: everyone sees the talon', () => {
    let s = createGame({ seed: 'view110', seats: SEATS3, maxPlayers: 3, firstDealer: 2 });
    s = ok(reduce(s, 'b', { type: 'bid', amount: 110 }, 1)).state;
    s = ok(reduce(s, 'c', { type: 'pass' }, 2)).state;
    s = ok(reduce(s, 'a', { type: 'pass' }, 3)).state;
    for (const me of ['a', 'b', 'c']) {
      expect(viewFor(s, me).round!.talon).toEqual(s.round!.talon);
      expectNoLeak(s, me);
    }
  });

  it('4 players: the sitting-out dealer sees no hand', () => {
    const s = createGame({ seed: 'view4', seats: SEATS4, maxPlayers: 4, firstDealer: 3 });
    const v = viewFor(s, 'd');
    expect(v.round!.hand).toEqual([]);
    expect(v.round!.sittingOut).toBe('d');
    expect(v.round!.maxBid).toBe(0);
    expect(v.legal).toEqual([{ type: 'pause' }]);
    expectNoLeak(s, 'd', v);
  });

  it('hand-out: bidder sees both cards, recipients only their own', () => {
    const s = scenario({
      phase: 'handout', bid: { high: 'a', amount: 100 },
      hands: { a: 'AH 10H KH QH AS 10S AD 9C 9D JS', b: 'KS QS JH 9H KC QC JC', c: '10C AC 10D KD QD JD 9S' },
    });
    const st = ok(reduce(s, 'a', { type: 'handout', to: { b: c('9C'), c: c('9D') } }, 1)).state;
    expect(viewFor(st, 'a').round!.handout).toEqual({ b: c('9C'), c: c('9D') });
    expect(viewFor(st, 'b').round!.handout).toEqual({ b: c('9C') });
    expect(viewFor(st, 'c').round!.handout).toEqual({ c: c('9D') });
    for (const me of ['a', 'b', 'c']) expectNoLeak(st, me);
  });

  it('public trick info: played cards, tricks taken, trick points, last trick', () => {
    let s = scenario({
      phase: 'tricks', bid: { high: 'a', amount: 100 },
      hands: { a: 'AH 9C', b: '9H 9D', c: '10H 9S' },
      tricksWon: { a: ['AS 10S KS'] },
    });
    s = ok(reduce(s, 'a', { type: 'card', card: c('AH') }, 1)).state;
    s = ok(reduce(s, 'b', { type: 'card', card: c('9H') }, 2)).state;
    s = ok(reduce(s, 'c', { type: 'card', card: c('10H') }, 3)).state;
    const v = viewFor(s, 'b').round!;
    expect(v.played.map(cardKey).sort()).toEqual(['10H', '10S', '9H', 'AH', 'AS', 'KS'].sort());
    expect(v.tricksTaken).toEqual({ a: 2, b: 0, c: 0 });
    expect(v.trickPoints).toEqual({ a: 46, b: 0, c: 0 });
    expect(v.lastTrick).toMatchObject({ winner: 'a', points: 21 });
    expect(v.trick).toEqual({ leader: 'a', cards: [] });
  });

  it('never serializes rng or other players\' held cards', () => {
    const s = createGame({ seed: 'rngleak', seats: SEATS3, maxPlayers: 3, firstDealer: 2 });
    for (const me of ['a', 'b', 'c']) {
      const json = JSON.stringify(viewFor(s, me));
      expect(json).not.toContain(s.rng);
      expect(json).not.toContain('"rng"');
      const own = new Set(s.round!.hands[me].map(cardKey));
      const others = Object.entries(s.round!.hands).filter(([p]) => p !== me).flatMap(([, h]) => h.map(cardKey));
      const seen = cardKeysIn(JSON.parse(json));
      for (const k of others) if (!own.has(k)) expect(seen).not.toContain(k);
    }
  });

  it('does not throw for an unknown player: spectator view with empty hand', () => {
    const s = createGame({ seed: 'spec', seats: SEATS3, maxPlayers: 3, firstDealer: 2 });
    const v = viewFor(s, 'zzz');
    expect(v.round!.hand).toEqual([]);
    expect(v.round!.maxBid).toBe(0);
    expect(v.round!.talon).toBeNull();
    expect(v.legal).toEqual([]);
    expect(cardKeysIn(v)).toEqual([]);
    expect(JSON.stringify(v)).not.toContain(s.rng);
  });

  it('prototype-key ids do not throw and get an empty hand', () => {
    const s = createGame({ seed: 'proto', seats: SEATS3, maxPlayers: 3, firstDealer: 2 });
    for (const id of ['constructor', 'toString', '__proto__']) {
      const v = viewFor(s, id);
      expect(v.round!.hand).toEqual([]);
      expect(v.round!.maxBid).toBe(0);
      expect(v.legal).toEqual([]);
      expect(() => explainIllegal(v, c('AH'))).not.toThrow();
    }
    const h = scenario({
      phase: 'handout', bid: { high: 'a', amount: 100 },
      hands: { a: 'AH 10H KH QH AS 10S AD 9C 9D JS', b: 'KS QS JH 9H KC QC JC', c: '10C AC 10D KD QD JD 9S' },
    });
    const st = ok(reduce(h, 'a', { type: 'handout', to: { b: c('9C'), c: c('9D') } }, 1)).state;
    for (const id of ['constructor', '__proto__']) expect(viewFor(st, id).round!.handout).toEqual({});
  });

  it('4p hand-out: bidder sees both, recipients one, sitting-out dealer none', () => {
    const s = scenario({
      seats: SEATS4, phase: 'handout', bid: { high: 'a', amount: 100 },
      hands: { a: 'AH 10H KH QH AS 10S AD 9C 9D JS', b: 'KS QS JH 9H KC QC JC', c: '10C AC 10D KD QD JD 9S' },
    });
    const st = ok(reduce(s, 'a', { type: 'handout', to: { b: c('9C'), c: c('9D') } }, 1)).state;
    expect(viewFor(st, 'a').round!.handout).toEqual({ b: c('9C'), c: c('9D') });
    expect(viewFor(st, 'b').round!.handout).toEqual({ b: c('9C') });
    expect(viewFor(st, 'd').round!.handout).toEqual({});
    for (const me of ['a', 'b', 'c', 'd']) expectNoLeak(st, me);
  });

  it('is JSON-serializable', () => {
    const s = createGame({ seed: 'json', seats: SEATS3, maxPlayers: 3, firstDealer: 0 });
    const v = viewFor(s, 'a');
    expect(JSON.parse(JSON.stringify(v))).toEqual(v);
  });
});

describe('eventsFor', () => {
  it('events never leak hidden cards', () => {
    // throw at 100 → next round dealt: every seat gets exactly its own dealt event
    const s = scenario({ phase: 'decision', hands: { a: 'AH' }, bid: { high: 'a', amount: 100 } });
    const res = ok(reduce(s, 'a', { type: 'throw' }, 1));
    for (const me of ['a', 'b', 'c']) {
      const dealt = eventsFor(res.events, me).filter(e => e.type === 'dealt');
      expect(dealt).toHaveLength(1);
      expect(dealt[0]).toMatchObject({ hand: res.state.round!.hands[me] });
    }
    // private talon at 100: only the bidder gets talonRevealed
    let st = res.state; // round 2: dealer a → active b, c, a; c bids first
    st = ok(reduce(st, 'c', { type: 'pass' }, 2)).state;
    const end = ok(reduce(st, 'a', { type: 'pass' }, 3));
    expect(eventsFor(end.events, 'b').some(e => e.type === 'talonRevealed')).toBe(true);
    expect(eventsFor(end.events, 'a').some(e => e.type === 'talonRevealed')).toBe(false);
    expect(eventsFor(end.events, 'c').some(e => e.type === 'talonRevealed')).toBe(false);
    expect(eventsFor(end.events, 'c').some(e => e.type === 'biddingWon')).toBe(true);
    // the private talon never shows up for non-bidders, in views or events
    const talonKeys = end.state.round!.talon.map(cardKey);
    for (const me of ['a', 'c']) {
      expect(cardKeysIn(viewFor(end.state, me)).filter(k => talonKeys.includes(k) && !end.state.round!.hands[me].map(cardKey).includes(k))).toEqual([]);
      expect(cardKeysIn(eventsFor(end.events, me)).filter(k => talonKeys.includes(k) && !end.state.round!.hands[me].map(cardKey).includes(k))).toEqual([]);
    }
  });

  it('hand-out events: recipients see only their own card; 4p sitting-out dealer sees none', () => {
    for (const seats of [SEATS3, SEATS4]) {
      const s = scenario({
        seats, phase: 'handout', bid: { high: 'a', amount: 100 },
        hands: { a: 'AH 10H KH QH AS 10S AD 9C 9D JS', b: 'KS QS JH 9H KC QC JC', c: '10C AC 10D KD QD JD 9S' },
      });
      const res = ok(reduce(s, 'a', { type: 'handout', to: { b: c('9C'), c: c('9D') } }, 1));
      const handed = (p: string) => eventsFor(res.events, p).filter(e => e.type === 'handedOut');
      const keysOf = (p: string) => cardKeysIn(handed(p));
      expect(keysOf('a').sort()).toEqual(['9C', '9D']);
      expect(keysOf('b')).toEqual(['9C']);
      expect(keysOf('c')).toEqual(['9D']);
      if (seats.length === 4) {
        const all = cardKeysIn(eventsFor(res.events, 'd'));
        for (const p of ['a', 'b', 'c']) for (const card of res.state.round!.hands[p]) expect(all).not.toContain(cardKey(card));
        expect(keysOf('d')).toEqual([]);
      }
    }
  });
});

describe('explainIllegal', () => {
  const s = scenario({ phase: 'tricks', hands: { a: '9C', b: 'AH 9H 9S', c: 'QC' }, trick: { leader: 'a', cards: [['a', '10H']] } });
  it('explains rule violations and returns null for legal cards', () => {
    const v = viewFor(s, 'b');
    expect(explainIllegal(v, c('9S'))).toBe('You must follow ♥');
    expect(explainIllegal(v, c('9H'))).toBe('First to respond must beat 10♥ if you can');
    expect(explainIllegal(v, c('KD'))).toBe("That card isn't in your hand");
    expect(explainIllegal(v, c('AH'))).toBeNull();
  });
  it('explains turn, phase and pause', () => {
    expect(explainIllegal(viewFor(s, 'c'), c('QC'))).toBe('Wait for Bartek to play');
    const bidding = createGame({ seed: 'x', seats: SEATS3, maxPlayers: 3, firstDealer: 0 });
    expect(explainIllegal(viewFor(bidding, 'b'), c('AH'))).toBe("You can't play a card right now");
    const paused = { ...s, paused: { by: 'a', at: 1 } };
    expect(explainIllegal(viewFor(paused, 'b'), c('AH'))).toBe('The game is paused');
  });
});
