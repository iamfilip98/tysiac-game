import { describe, it, expect } from 'vitest';
import type { Action, GameState } from '../src/types';
import { createGame } from '../src/game';
import { reduce } from '../src/reduce';
import { legalActions, turnOf } from '../src/actions';
import { SEATS3, SEATS4, c, ok, scenario } from './helpers';

const biddingScenario = () => scenario({
  phase: 'bidding',
  hands: { a: 'KH QH AH 10H AS 9C 9D', b: 'KD QD AD 10D 9S JS QS', c: '9H JH JC QC KC 10C AC' },
  talon: 'KS 10S JD',
});

describe('reduce basics', () => {
  it('increments seq and never mutates its input', () => {
    const s = biddingScenario();
    const before = JSON.stringify(s);
    const res = ok(reduce(s, 'b', { type: 'bid', amount: 110 }, 5));
    expect(JSON.stringify(s)).toBe(before);
    expect(res.state.seq).toBe(1);
  });

  it('rejects malformed actions without throwing', () => {
    const s = biddingScenario();
    const junk: unknown[] = [null, undefined, 7, 'bid', {}, { type: 'nuke' }, { type: 'card' },
      { type: 'card', card: 'AH' }, { type: 'bid', amount: '110' }, { type: 'handout', to: null }];
    for (const j of junk) {
      const res = reduce(s, 'b', j as Action, 1);
      expect(res.ok).toBe(false);
    }
    const notSeated = reduce(s, 'mallory', { type: 'pass' }, 1);
    expect(!notSeated.ok && notSeated.error.code).toBe('notSeated');
    expect(JSON.stringify(s)).toBe(JSON.stringify(biddingScenario()));
  });
});

describe('bidding', () => {
  it('bid → bid → pass → bid → pass: b wins at 130, talon public', () => {
    let s: GameState = biddingScenario();
    s = ok(reduce(s, 'b', { type: 'bid', amount: 110 }, 1)).state;
    expect(s.round!.bid).toMatchObject({ high: 'b', amount: 110, turn: 'c' });
    s = ok(reduce(s, 'c', { type: 'bid', amount: 120 }, 2)).state;
    expect(s.round!.bid).toMatchObject({ high: 'c', amount: 120, turn: 'a' });
    s = ok(reduce(s, 'a', { type: 'pass' }, 3)).state;
    expect(s.round!.bid.turn).toBe('b');
    s = ok(reduce(s, 'b', { type: 'bid', amount: 130 }, 4)).state;
    expect(s.round!.bid.turn).toBe('c');
    const res = ok(reduce(s, 'c', { type: 'pass' }, 5));
    s = res.state;
    expect(s.phase).toBe('talon');
    expect(s.round!.bid).toEqual({ high: 'b', amount: 130, turn: null, passed: ['a', 'c'] });
    expect(s.round!.talonPublic).toBe(true);
    expect(s.round!.hands.b).toHaveLength(10);
    expect(turnOf(s)).toBeNull();
    expect(res.events.map(e => e.type)).toEqual(['passed', 'biddingWon', 'talonRevealed']);
    const talon = res.events.find(e => e.type === 'talonRevealed')!;
    expect(talon.audience).toBe('all');
  });

  it('both others pass: the auto-100 player wins and only they see the talon', () => {
    let s: GameState = biddingScenario();
    s = ok(reduce(s, 'b', { type: 'pass' }, 1)).state;
    expect(s.round!.bid.turn).toBe('c');
    const res = ok(reduce(s, 'c', { type: 'pass' }, 2));
    expect(res.state.round!.bid.high).toBe('a');
    expect(res.state.round!.bid.amount).toBe(100);
    expect(res.state.round!.talonPublic).toBe(false);
    expect(res.state.round!.hands.a).toHaveLength(10);
    expect(res.events.find(e => e.type === 'talonRevealed')!.audience).toEqual(['a']);
  });

  it('rejects wrong amounts, over-max bids and out-of-turn moves', () => {
    const s = biddingScenario();
    const wrong = reduce(s, 'b', { type: 'bid', amount: 120 }, 1);
    expect(!wrong.ok && wrong.error).toEqual({ code: 'badBid', message: 'Bid must be exactly 110 (current bid + 10)' });
    const early = reduce(s, 'c', { type: 'pass' }, 1);
    expect(!early.ok && early.error.code).toBe('notYourTurn');
    const poor = scenario({ phase: 'bidding', hands: { b: '9S JS 9H JH 9D JD 9C' }, bid: { high: 'a', amount: 120, turn: 'b' } });
    const over = reduce(poor, 'b', { type: 'bid', amount: 130 }, 1);
    expect(!over.ok && over.error.code).toBe('badBid');
    const play = reduce(s, 'b', { type: 'play' }, 1);
    expect(!play.ok && play.error.code).toBe('illegalAction');
  });
});

describe('decision', () => {
  it('play moves to hand-out without scoring', () => {
    const s = scenario({ phase: 'decision', hands: { a: 'AH' }, bid: { high: 'a', amount: 110 } });
    const res = ok(reduce(s, 'a', { type: 'play' }, 1));
    expect(res.state.phase).toBe('handout');
    expect(res.events).toEqual([]);
  });

  it('throw at 100: nobody scores, next round with the next dealer', () => {
    const s = scenario({ phase: 'decision', hands: { a: 'AH' }, bid: { high: 'a', amount: 100 } }); // dealer c
    const res = ok(reduce(s, 'a', { type: 'throw' }, 1));
    const st = res.state;
    expect(st.phase).toBe('bidding');
    expect(st.round!.number).toBe(2);
    expect(st.round!.dealer).toBe('a');
    expect(Object.values(st.scores)).toEqual([{ total: 0, history: [0] }, { total: 0, history: [0] }, { total: 0, history: [0] }]);
    expect(st.rounds[0]).toMatchObject({ number: 1, bidder: 'a', bid: 100, outcome: 'thrown', wykladana: false });
    expect(res.events[0]).toMatchObject({ type: 'threw', p: 'a', amount: 100, audience: 'all' });
    expect(res.events.filter(e => e.type === 'dealt')).toHaveLength(3);
  });

  it('throw above 100: bidder -bid, others +60, barrel 0', () => {
    const s = scenario({ phase: 'decision', hands: { a: 'AH' }, bid: { high: 'a', amount: 120 }, totals: { a: 0, b: 850, c: 100 } });
    const st = ok(reduce(s, 'a', { type: 'throw' }, 1)).state;
    expect(st.scores.a.total).toBe(-120);
    expect(st.scores.b.total).toBe(850);
    expect(st.scores.c.total).toBe(160);
  });

  it('4 players: sitting-out dealer gets nothing from a throw', () => {
    const s = scenario({ seats: SEATS4, phase: 'decision', hands: { a: 'AH' }, bid: { high: 'a', amount: 120 } });
    const st = ok(reduce(s, 'a', { type: 'throw' }, 1)).state;
    expect([st.scores.a.total, st.scores.b.total, st.scores.c.total, st.scores.d.total]).toEqual([-120, 60, 60, 0]);
    expect(st.round!.dealer).toBe('a');
    expect(st.round!.active).toEqual(['b', 'c', 'd']);
  });

  it('repeated throws at 100 keep rotating the dealer', () => {
    let s = createGame({ seed: 'throws', seats: SEATS3, maxPlayers: 3, firstDealer: 1 });
    for (let n = 1; n <= 6; n++) {
      expect(s.round!.number).toBe(n);
      expect(s.round!.dealer).toBe(SEATS3[(1 + n - 1) % 3].id);
      const [first, second, third] = s.round!.active;
      s = ok(reduce(s, second, { type: 'pass' }, n)).state;
      s = ok(reduce(s, third, { type: 'pass' }, n)).state;
      expect(turnOf(s)).toBe(first);
      s = ok(reduce(s, first, { type: 'throw' }, n)).state;
    }
    expect(s.rounds).toHaveLength(6);
    expect(s.rounds.every(r => r.outcome === 'thrown')).toBe(true);
    expect(Object.values(s.scores).every(x => x.total === 0)).toBe(true);
  });
});

describe('pause / resume', () => {
  it('pause blocks actions until anyone resumes', () => {
    let s: GameState = biddingScenario();
    const paused = ok(reduce(s, 'a', { type: 'pause' }, 1234));
    s = paused.state;
    expect(s.paused).toEqual({ by: 'a', at: 1234 });
    expect(paused.events).toEqual([{ type: 'paused', p: 'a', audience: 'all' }]);
    const blocked = reduce(s, 'b', { type: 'bid', amount: 110 }, 1235);
    expect(!blocked.ok && blocked.error.code).toBe('paused');
    expect(legalActions(s, 'b')).toEqual([{ type: 'resume' }]);
    const again = reduce(s, 'c', { type: 'pause' }, 1236);
    expect(!again.ok && again.error.code).toBe('paused');
    s = ok(reduce(s, 'c', { type: 'resume' }, 1237)).state;
    expect(s.paused).toBeNull();
    s = ok(reduce(s, 'b', { type: 'bid', amount: 110 }, 1238)).state;
    expect(s.round!.bid.high).toBe('b');
  });

  it('pause mid-trick blocks play until anyone resumes', () => {
    let s: GameState = scenario({
      phase: 'tricks', hands: { a: 'KD', b: 'AH 9S', c: 'QC' }, trick: { leader: 'a', cards: [['a', '10H']] },
    });
    const legalBefore = legalActions(s, 'b');
    s = ok(reduce(s, 'c', { type: 'pause' }, 1)).state;
    const blocked = reduce(s, 'b', { type: 'card', card: c('AH') }, 2);
    expect(!blocked.ok && blocked.error.code).toBe('paused');
    s = ok(reduce(s, 'a', { type: 'resume' }, 3)).state;
    expect(turnOf(s)).toBe('b');
    expect(legalActions(s, 'b')).toEqual([{ type: 'card', card: c('AH') }, { type: 'pause' }]);
    expect(legalActions(s, 'b')).toEqual(legalBefore);
    const res = ok(reduce(s, 'b', { type: 'card', card: c('AH') }, 4));
    expect(res.events.map(e => e.type)).toEqual(['cardPlayed']);
    expect(res.state.round!.hands.b).toEqual([c('9S')]);
    expect(res.state.round!.trick.cards.map(t => [t.p, t.card])).toEqual([['a', c('10H')], ['b', c('AH')]]);
    expect(turnOf(res.state)).toBe('c');
  });

  it('resume when not paused is rejected', () => {
    const res = reduce(biddingScenario(), 'a', { type: 'resume' }, 1);
    expect(!res.ok && res.error.code).toBe('illegalAction');
  });
});
