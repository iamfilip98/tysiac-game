import { describe, it, expect } from 'vitest';
import type { Action } from '../src/types';
import { createGame } from '../src/game';
import { actionsEqual, legalActions, turnOf } from '../src/actions';
import { SEATS3, c, scenario } from './helpers';

describe('turnOf / legalActions', () => {
  it('new game: second active player bids first; others may only pause', () => {
    const s = createGame({ seed: 'act', seats: SEATS3, maxPlayers: 3, firstDealer: 2 }); // dealer c → active a, b, c
    expect(turnOf(s)).toBe('b');
    expect(legalActions(s, 'b')).toEqual([{ type: 'bid', amount: 110 }, { type: 'pass' }, { type: 'pause' }]);
    expect(legalActions(s, 'a')).toEqual([{ type: 'pause' }]);
    expect(legalActions(s, 'zed')).toEqual([]);
  });
  it('no bid action above max bid', () => {
    const s = scenario({ phase: 'bidding', hands: { b: '9S JS 9H JH 9D JD 9C' }, bid: { high: 'a', amount: 120, turn: 'b' } });
    expect(legalActions(s, 'b')).toEqual([{ type: 'pass' }, { type: 'pause' }]);
  });
  it('decision: play or throw for the bidder', () => {
    const s = scenario({ phase: 'decision', hands: { a: 'AH' }, bid: { high: 'a', amount: 110 } });
    expect(turnOf(s)).toBe('a');
    expect(legalActions(s, 'a')).toEqual([{ type: 'play' }, { type: 'throw' }, { type: 'pause' }]);
  });
  it('handout: 90 ways to give 2 of 10 cards to two opponents', () => {
    const s = scenario({ phase: 'handout', hands: { a: 'AH 10H KH QH JH 9H AS 10S KS QS' }, bid: { high: 'a' } });
    const acts = legalActions(s, 'a');
    expect(acts.filter(x => x.type === 'handout')).toHaveLength(90);
    expect(acts[acts.length - 1]).toEqual({ type: 'pause' });
  });
  it('tricks: only valid cards, turn follows the active order from the leader', () => {
    const s = scenario({
      phase: 'tricks', hands: { a: 'KD', b: 'AH 9H 9S', c: 'QC' },
      trick: { leader: 'a', cards: [['a', '10H']] },
    });
    expect(turnOf(s)).toBe('b');
    expect(legalActions(s, 'b')).toEqual([{ type: 'card', card: c('AH') }, { type: 'pause' }]);
  });
  it('paused: everyone may only resume; gameEnd: nothing', () => {
    const s = scenario({ phase: 'decision', hands: { a: 'AH' } });
    s.paused = { by: 'b', at: 1 };
    expect(legalActions(s, 'a')).toEqual([{ type: 'resume' }]);
    expect(legalActions(s, 'c')).toEqual([{ type: 'resume' }]);
    s.paused = null;
    s.phase = 'gameEnd';
    expect(legalActions(s, 'a')).toEqual([]);
    expect(turnOf(s)).toBeNull();
  });
});

describe('actionsEqual', () => {
  const card: Action = { type: 'card', card: c('AH') };
  const handout: Action = { type: 'handout', to: { b: c('9C'), c: c('9D') } };
  it('compares structurally', () => {
    expect(actionsEqual({ type: 'bid', amount: 110 }, { type: 'bid', amount: 110 })).toBe(true);
    expect(actionsEqual({ type: 'bid', amount: 110 }, { type: 'bid', amount: 120 })).toBe(false);
    expect(actionsEqual(card, { type: 'card', card: { suit: 'hearts', rank: 'A' } })).toBe(true);
    expect(actionsEqual(card, { type: 'card', card: c('KH') })).toBe(false);
    expect(actionsEqual(handout, { type: 'handout', to: { c: c('9D'), b: c('9C') } })).toBe(true);
    expect(actionsEqual(handout, { type: 'handout', to: { b: c('9D'), c: c('9C') } })).toBe(false);
    expect(actionsEqual({ type: 'pass' }, { type: 'pass' })).toBe(true);
  });
  it('is safe on garbage', () => {
    for (const junk of [null, undefined, 42, 'card', {}, { type: 'card' }, { type: 'card', card: 'AH' },
      { type: 'bid', amount: '110' }, { type: 'handout', to: null }, { type: 'handout', to: { b: c('9C') } },
      { type: 'handout', to: { b: c('9C'), c: c('9D'), d: c('9H') } }]) {
      expect(actionsEqual(card, junk)).toBe(false);
      expect(actionsEqual(handout, junk)).toBe(false);
      expect(actionsEqual({ type: 'bid', amount: 110 }, junk)).toBe(false);
    }
  });
});
