import { describe, it, expect } from 'vitest';
import type { GameState } from '../src/types';
import { reduce } from '../src/reduce';
import { actorsOf, legalActions, talonWaiting, turnOf } from '../src/actions';
import { viewFor } from '../src/view';
import { botAction } from '../src/bot';
import { SEATS4, ok, scenario } from './helpers';

const HANDS = { a: 'KH QH AH 10H AS 9C 9D', b: 'KD QD AD 10D 9S JS QS', c: '9H JH JC QC KC 10C AC' };
/** c passes: b wins at 110, so the talon is public. */
const wonAt110 = (): GameState =>
  ok(reduce(scenario({ phase: 'bidding', hands: HANDS, talon: 'KS 10S JD', bid: { high: 'b', amount: 110, turn: 'c', passed: ['a'] } }), 'c', { type: 'pass' }, 1)).state;

describe('talon confirmation', () => {
  it('over 100: bidding ends in the talon phase and everyone but the bidder must confirm', () => {
    const s = wonAt110();
    expect(s.phase).toBe('talon');
    expect(talonWaiting(s)).toEqual(['a', 'c']);
    expect(turnOf(s)).toBeNull();
    expect(actorsOf(s)).toEqual(['a', 'c']);
    expect(legalActions(s, 'a')).toContainEqual({ type: 'ackTalon' });
    expect(legalActions(s, 'b')).toEqual([{ type: 'pause' }]);
  });

  it('the bidder cannot play or throw in until everyone has seen it', () => {
    const s = wonAt110();
    for (const action of [{ type: 'play' }, { type: 'throw' }] as const) {
      const res = reduce(s, 'b', action, 2);
      expect(res.ok).toBe(false);
      expect(!res.ok && res.error.code).toBe('notYourTurn');
    }
  });

  it('each confirmation emits talonSeen; the last one opens the decision', () => {
    let s = wonAt110();
    const first = ok(reduce(s, 'c', { type: 'ackTalon' }, 2));
    expect(first.events).toEqual([{ type: 'talonSeen', p: 'c', audience: 'all' }]);
    s = first.state;
    expect(s.phase).toBe('talon');
    expect(talonWaiting(s)).toEqual(['a']);
    s = ok(reduce(s, 'a', { type: 'ackTalon' }, 3)).state;
    expect(s.phase).toBe('decision');
    expect(turnOf(s)).toBe('b');
    expect(actorsOf(s)).toEqual(['b']);
  });

  it('rejects a second confirmation and a confirmation by the bidder', () => {
    const s = ok(reduce(wonAt110(), 'c', { type: 'ackTalon' }, 2)).state;
    expect(reduce(s, 'c', { type: 'ackTalon' }, 3).ok).toBe(false);
    expect(reduce(s, 'b', { type: 'ackTalon' }, 3).ok).toBe(false);
  });

  it('at 100 only the bidder sees the talon: no confirmation step', () => {
    let s = scenario({ phase: 'bidding', hands: HANDS, talon: 'KS 10S JD', bid: { high: 'a', amount: 100, turn: 'b', passed: [] } });
    s = ok(reduce(s, 'b', { type: 'pass' }, 1)).state;
    s = ok(reduce(s, 'c', { type: 'pass' }, 2)).state;
    expect(s.phase).toBe('decision');
    expect(talonWaiting(s)).toEqual([]);
  });

  it('4 players: the sitting-out dealer must confirm too', () => {
    const s = scenario({ seats: SEATS4, phase: 'talon', talonPublic: true, hands: HANDS, talon: 'KS 10S JD', bid: { high: 'a', amount: 120, turn: null } });
    expect(s.round!.dealer).toBe('d');
    expect(talonWaiting(s)).toEqual(['b', 'c', 'd']);
    expect(legalActions(s, 'd')).toContainEqual({ type: 'ackTalon' });
  });

  it('paused: no ack until resume', () => {
    const s = ok(reduce(wonAt110(), 'a', { type: 'pause' }, 2)).state;
    expect(legalActions(s, 'c')).toEqual([{ type: 'resume' }]);
    expect(reduce(s, 'c', { type: 'ackTalon' }, 3).ok).toBe(false);
    const resumed = ok(reduce(s, 'c', { type: 'resume' }, 3)).state;
    expect(ok(reduce(resumed, 'c', { type: 'ackTalon' }, 4)).state.phase).toBe('talon');
  });

  it('every viewer sees the talon and who is still looking; bots confirm', () => {
    const s = wonAt110();
    for (const p of ['a', 'b', 'c']) {
      const v = viewFor(s, p);
      expect(v.round!.talon).toHaveLength(3);
      expect(v.round!.talonWaiting).toEqual(['a', 'c']);
    }
    expect(botAction(viewFor(s, 'a'), () => 0)).toEqual({ type: 'ackTalon' });
  });
});
