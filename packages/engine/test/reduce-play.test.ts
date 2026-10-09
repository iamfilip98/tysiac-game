import { describe, it, expect } from 'vitest';
import type { Action, GameState } from '../src/types';
import { reduce } from '../src/reduce';
import { SEATS4, c, ok, scenario } from './helpers';

const card = (text: string): Action => ({ type: 'card', card: c(text) });

const handoutScenario = (aHand: string) => scenario({
  phase: 'handout',
  bid: { high: 'a', amount: 100 },
  hands: { a: aHand, b: 'KS QS JH 9H KC QC JC', c: '10C AC 10D KD QD JD 9S' },
});

describe('hand-out', () => {
  it('gives one card to each opponent', () => {
    const s = handoutScenario('AH 10H KH QH AS 10S AD 9C 9D JS');
    const res = ok(reduce(s, 'a', { type: 'handout', to: { b: c('9C'), c: c('9D') } }, 1));
    const r = res.state.round!;
    expect(res.state.phase).toBe('tricks');
    expect(r.hands.a).toHaveLength(8);
    expect(r.hands.b).toContainEqual(c('9C'));
    expect(r.hands.c).toContainEqual(c('9D'));
    expect(r.trick).toEqual({ leader: 'a', cards: [] });
    expect(r.handoutGiven).toEqual({ b: c('9C'), c: c('9D') });
  });

  it('rejects bad hand-outs', () => {
    const s = handoutScenario('AH 10H KH QH AS 10S AD 9C 9D JS');
    const bad: Record<string, unknown>[] = [
      { a: c('9C'), b: c('9D') },
      { b: c('9C'), c: c('9C') },
      { b: c('9C') },
      { b: c('9C'), c: c('KC') },
    ];
    for (const to of bad) {
      const res = reduce(s, 'a', { type: 'handout', to } as Action, 1);
      expect(!res.ok && res.error.code).toBe('badHandout');
    }
  });

  it('wykładana: round ends at once, bidder gets 120 + marriages in hand', () => {
    const s = handoutScenario('AD 10D KD QD AS 10S KS 9S 9C 9H');
    const res = ok(reduce(s, 'a', { type: 'handout', to: { b: c('9C'), c: c('9H') } }, 1));
    const types = res.events.map(e => e.type);
    expect(types.slice(0, 5)).toEqual(['handedOut', 'handedOut', 'handedOut', 'wykladana', 'roundScored']);
    expect(res.events.find(e => e.type === 'wykladana')).toMatchObject({ p: 'a', trump: 'diamonds', marriages: ['diamonds'] });
    const sum = res.state.rounds[0];
    expect(sum).toMatchObject({ outcome: 'made', wykladana: true, bidder: 'a', bid: 100 });
    const a = sum.players.find(p => p.playerId === 'a')!;
    expect(a).toMatchObject({ trickPoints: 120, marriagePoints: 80, scoreChange: 200 });
    expect(sum.players.filter(p => p.playerId !== 'a').map(p => p.scoreChange)).toEqual([0, 0]);
    expect(res.state.phase).toBe('bidding');
    expect(res.state.round!.number).toBe(2);
  });
});

describe('tricks', () => {
  it('must follow suit', () => {
    const s = scenario({ phase: 'tricks', hands: { a: '9C', b: 'KH 9S', c: 'QC' }, trick: { leader: 'a', cards: [['a', '10H']] } });
    const res = reduce(s, 'b', card('9S'), 1);
    expect(!res.ok && res.error).toEqual({ code: 'illegalCard', message: 'You must follow ♥' });
    ok(reduce(s, 'b', card('KH'), 1));
  });

  it('only the first responder must beat the lead', () => {
    const s = scenario({ phase: 'tricks', hands: { a: '9C', b: 'AH 9H 9S', c: 'QC' }, trick: { leader: 'a', cards: [['a', '10H']] } });
    const res = reduce(s, 'b', card('9H'), 1);
    expect(!res.ok && res.error.message).toBe('First to respond must beat 10♥ if you can');
    const third = scenario({ phase: 'tricks', hands: { a: '9C', b: '9S', c: 'KH 9H' }, trick: { leader: 'a', cards: [['a', '10H'], ['b', 'AH']] } });
    ok(reduce(third, 'c', card('9H'), 1));
  });

  it('leading Q with K declares the marriage, sets trump at once, and trump wins later tricks', () => {
    let s: GameState = scenario({
      phase: 'tricks', bid: { high: 'a', amount: 100 },
      hands: { a: 'QH KH 9C', b: 'AH 9S JD', c: '10D JS QC' },
    });
    let res = ok(reduce(s, 'a', card('QH'), 1));
    expect(res.events.map(e => e.type)).toEqual(['marriage', 'cardPlayed']);
    expect(res.events[0]).toMatchObject({ type: 'marriage', p: 'a', suit: 'hearts', points: 100 });
    s = res.state;
    expect(s.round!.trump).toBe('hearts');
    expect(s.round!.marriages.a).toEqual(['hearts']);
    s = ok(reduce(s, 'b', card('AH'), 2)).state;
    res = ok(reduce(s, 'c', card('10D'), 3));
    expect(res.events.find(e => e.type === 'trickWon')).toMatchObject({ p: 'b', points: 24, byTrump: false });
    s = res.state;
    expect(s.round!.trick).toEqual({ leader: 'b', cards: [] });
    expect(s.round!.lastTrick).toMatchObject({ winner: 'b', points: 24 });
    s = ok(reduce(s, 'b', card('9S'), 4)).state;
    s = ok(reduce(s, 'c', card('JS'), 5)).state;
    res = ok(reduce(s, 'a', card('KH'), 6));
    expect(res.events.find(e => e.type === 'trickWon')).toMatchObject({ p: 'a', card: c('KH'), points: 6, byTrump: true });
    s = res.state;
    s = ok(reduce(s, 'a', card('9C'), 7)).state;
    s = ok(reduce(s, 'b', card('JD'), 8)).state;
    res = ok(reduce(s, 'c', card('QC'), 9));
    // round over: a has 6 trick points + 100 marriage = 106 >= 100 → +110
    const sum = res.state.rounds[0];
    expect(sum.outcome).toBe('made');
    expect(sum.players.find(p => p.playerId === 'a')).toMatchObject({ trickPoints: 6, marriagePoints: 100, scoreChange: 110 });
    expect(sum.players.find(p => p.playerId === 'b')).toMatchObject({ trickPoints: 24, scoreChange: 20 });
    expect(res.events.map(e => e.type)).toContain('roundScored');
    expect(res.state.round!.number).toBe(2);
  });

  it('playing a Q while following does not declare a marriage', () => {
    const s = scenario({ phase: 'tricks', hands: { a: '9C', b: 'QH KH 9S', c: 'QC' }, trick: { leader: 'a', cards: [['a', '9H']] } });
    const res = ok(reduce(s, 'b', card('QH'), 1));
    expect(res.events.map(e => e.type)).toEqual(['cardPlayed']);
    expect(res.state.round!.trump).toBeNull();
  });
});

const lastTrick = (extra: Partial<Parameters<typeof scenario>[0]> = {}) => scenario({
  phase: 'tricks',
  bid: { high: 'a', amount: 100 },
  hands: { a: 'AH', b: '9H', c: '10H' },
  tricksWon: { a: ['AS 10S KS', 'AD 10D KD', 'AC 10C KC', 'QS JS 9S'], b: ['QD JD 9D'], c: ['QC JC 9C', 'KH QH JH'] },
  ...extra,
});

describe('round end', () => {
  it('scores the 8th trick and deals the next round', () => {
    let s = lastTrick();
    s = ok(reduce(s, 'a', card('AH'), 1)).state;
    s = ok(reduce(s, 'b', card('9H'), 2)).state;
    const res = ok(reduce(s, 'c', card('10H'), 3));
    const sum = res.state.rounds[0];
    expect(sum.players.map(p => [p.playerId, p.trickPoints, p.scoreChange])).toEqual([
      ['a', 101, 100], ['b', 5, 0], ['c', 14, 10],
    ]);
    expect(sum.players.reduce((t, p) => t + p.trickPoints, 0)).toBe(120);
    expect(res.state.scores.a).toEqual({ total: 100, history: [100] });
    expect(res.state.phase).toBe('bidding');
    expect(res.state.round!.dealer).toBe('a');
    expect(res.events.filter(e => e.type === 'dealt')).toHaveLength(3);
  });

  it('reaching 1000 ends the game', () => {
    let s = lastTrick({ totals: { a: 900, b: 0, c: 0 } });
    s = ok(reduce(s, 'a', card('AH'), 1)).state;
    s = ok(reduce(s, 'b', card('9H'), 2)).state;
    const res = ok(reduce(s, 'c', card('10H'), 3));
    expect(res.state.phase).toBe('gameEnd');
    expect(res.state.winner).toBe('a');
    expect(res.events[res.events.length - 1]).toMatchObject({ type: 'gameWon', p: 'a', totals: { a: 1000, b: 0, c: 10 } });
    const after = reduce(res.state, 'b', { type: 'pause' }, 4);
    expect(!after.ok && after.error.code).toBe('gameOver');
  });

  it('4 players: sitting-out dealer scores talon marriages + 50 per ace', () => {
    let s = lastTrick({ seats: SEATS4, talon: 'KC QC AD' });
    s = ok(reduce(s, 'a', card('AH'), 1)).state;
    s = ok(reduce(s, 'b', card('9H'), 2)).state;
    const st = ok(reduce(s, 'c', card('10H'), 3)).state;
    const d = st.rounds[0].players.find(p => p.playerId === 'd')!;
    expect(d).toMatchObject({ sittingOut: true, isDealer: true, trickPoints: 0, marriagePoints: 110, scoreChange: 110 });
  });
});
const JUNK: unknown[] = [
  null, undefined, 7, 'card', {}, { type: 'nuke' }, { type: 'card' }, { type: 'card', card: null },
  { type: 'card', card: {} }, { type: 'card', card: { suit: 'x' } }, { type: 'card', card: 'AH' },
  { type: 'card', card: { suit: 'hearts', rank: 'Z' } },
  { type: 'bid', amount: '110' }, { type: 'bid', amount: NaN }, { type: 'bid', amount: 110 },
  { type: 'handout' }, { type: 'handout', to: null }, { type: 'handout', to: 'x' }, { type: 'handout', to: {} },
];

function expectRejectsJunk(s: GameState, who: string): void {
  const before = JSON.stringify(s);
  for (const j of JUNK) {
    const res = reduce(s, who, j as Action, 1);
    expect(res.ok).toBe(false);
  }
  const ghost = reduce(s, 'zed', card('9H'), 1);
  expect(!ghost.ok && ghost.error.code).toBe('notSeated');
  expect(JSON.stringify(s)).toBe(before);
}

describe('malformed actions', () => {
  it('are rejected in the tricks phase', () => {
    const s = scenario({ phase: 'tricks', hands: { a: '9C', b: 'KH 9S', c: 'QC' }, trick: { leader: 'a', cards: [['a', '10H']] } });
    expectRejectsJunk(s, 'b');
  });

  it('are rejected in the hand-out phase', () => {
    expectRejectsJunk(handoutScenario('AH 10H KH QH AS 10S AD 9C 9D JS'), 'a');
  });
});

describe('hand-out shape validation', () => {
  const s = handoutScenario('AH 10H KH QH AS 10S AD 9C 9D JS');
  const before = JSON.stringify(s);

  it('rejects to = null', () => {
    const res = reduce(s, 'a', { type: 'handout', to: null } as unknown as Action, 1);
    expect(res.ok).toBe(false);
  });

  it('rejects an extra key for a non-recipient', () => {
    const res = reduce(s, 'a', { type: 'handout', to: { b: c('9C'), c: c('9D'), zed: c('JS') } } as Action, 1);
    expect(res.ok).toBe(false);
    expect(JSON.stringify(s)).toBe(before);
  });
});

describe('game end', () => {
  it('rejects every further action with gameOver', () => {
    let s = lastTrick({ totals: { a: 900, b: 0, c: 0 } });
    s = ok(reduce(s, 'a', card('AH'), 1)).state;
    s = ok(reduce(s, 'b', card('9H'), 2)).state;
    s = ok(reduce(s, 'c', card('10H'), 3)).state;
    expect(s.phase).toBe('gameEnd');
    expect(s.winner).toBe('a');
    const before = JSON.stringify(s);
    for (const who of ['a', 'b', 'c']) {
      for (const act of [{ type: 'pass' }, { type: 'resume' }, { type: 'card', card: c('AH') }, { type: 'bid', amount: 110 }] as Action[]) {
        const res = reduce(s, who, act, 9);
        expect(!res.ok && res.error.code).toBe('gameOver');
      }
    }
    expect(JSON.stringify(s)).toBe(before);
  });
});
