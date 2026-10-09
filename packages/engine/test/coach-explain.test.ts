import { describe, it, expect } from 'vitest';
import type { GameEvent } from '../src/types';
import { explainEvent } from '../src/coach';
import { viewFor } from '../src/view';
import { scoreRound, scoreThrow, summarizeRound } from '../src/scoring';
import { c, scenario } from './helpers';

const s = scenario({ phase: 'tricks', hands: { a: 'AH', b: '9H', c: '10H' } });
const viewAs = (p: string) => viewFor(s, p);
const ev = (e: Omit<GameEvent, 'audience'> & Record<string, unknown>): GameEvent => ({ ...e, audience: 'all' }) as unknown as GameEvent;

function summary(raws: { a: number; b: number; c: number }, bid: number, marriageA = 0) {
  const result = scoreRound({
    order: ['a', 'b', 'c'], bidder: 'a', bid, dealer: 'c', sittingOut: null,
    totals: { a: 0, b: 0, c: 0 }, trickPoints: raws, tricksTaken: { a: 3, b: 3, c: 2 },
    declaredMarriagePoints: { a: marriageA, b: 0, c: 0 }, talonBonus: 0,
  });
  return summarizeRound({ number: 1, dealer: 'c', bidder: 'a', bid, outcome: result.bidderMadeBid ? 'made' : 'failed', wykladana: false }, result);
}

describe('explainEvent', () => {
  it('marriage', () => {
    expect(explainEvent(ev({ type: 'marriage', p: 'b', suit: 'hearts', points: 100 }), viewAs('a')))
      .toBe('Bartek declared the ♥ marriage: +100. ♥ are trumps now.');
  });
  it('trick won by a trump; ordinary tricks are silent', () => {
    const base = { type: 'trickWon', p: 'c', cards: [], card: c('9S'), points: 11 } as const;
    expect(explainEvent(ev({ ...base, byTrump: true }), viewAs('a'))).toBe('Celina won with 9♠ — trumps beat every other suit.');
    expect(explainEvent(ev({ ...base, byTrump: false }), viewAs('a'))).toBeNull();
  });
  it('bidding won', () => {
    expect(explainEvent(ev({ type: 'biddingWon', p: 'a', amount: 120, talonPublic: true }), viewAs('b')))
      .toBe('Ala won the bid at 120. Over 100, so everyone sees the talon.');
    expect(explainEvent(ev({ type: 'biddingWon', p: 'a', amount: 100, talonPublic: false }), viewAs('a')))
      .toBe('You won the bid at 100. At 100 only you see the talon.');
    expect(explainEvent(ev({ type: 'biddingWon', p: 'a', amount: 100, talonPublic: false }), viewAs('b')))
      .toBe('Ala won the bid at 100. At 100 only Ala sees the talon.');
  });
  it('throw-ins', () => {
    const free = summarizeRound({ number: 1, dealer: 'c', bidder: 'a', bid: 100, outcome: 'thrown', wykladana: false },
      scoreThrow({ order: ['a', 'b', 'c'], dealer: 'c', bidder: 'a', bid: 100, sittingOut: null, totals: { a: 0, b: 0, c: 0 } }));
    expect(explainEvent(ev({ type: 'threw', p: 'a', amount: 100, summary: free }), viewAs('b')))
      .toBe('Ala threw in at 100 — nobody scores, new deal.');
    expect(explainEvent(ev({ type: 'threw', p: 'a', amount: 130, summary: free }), viewAs('b')))
      .toBe('Ala threw in at 130: −130, everyone else +60 (0 on the barrel).');
  });
  it('round scored: made with rounding, failed, and the viewer line', () => {
    const made = summary({ a: 96, b: 14, c: 10 }, 120, 40);
    expect(explainEvent(ev({ type: 'roundScored', summary: made }), viewAs('b')))
      .toBe('Ala bid 120 and scored 136 → +140 (rounded). You: +10.');
    const failed = summary({ a: 96, b: 14, c: 10 }, 120);
    expect(explainEvent(ev({ type: 'roundScored', summary: failed }), viewAs('a')))
      .toBe('You bid 120 but scored only 96 → −120.');
  });
  it('round scored: a near miss says rounding does not help', () => {
    const near = summary({ a: 117, b: 3, c: 0 }, 120);
    expect(explainEvent(ev({ type: 'roundScored', summary: near }), viewAs('b')))
      .toBe("Ala bid 120 but scored only 117 → −120 — rounding doesn't help a bidder who falls short. You: +0.");
  });
  it('wykładana and game won', () => {
    expect(explainEvent(ev({ type: 'wykladana', p: 'a', hand: [], trump: null, marriages: [] }), viewAs('a')))
      .toBe('You have every trick guaranteed — round won outright (wykładana)!');
    expect(explainEvent(ev({ type: 'wykladana', p: 'a', hand: [], trump: null, marriages: [] }), viewAs('b')))
      .toBe('Ala has every trick guaranteed — round won outright (wykładana)!');
    expect(explainEvent(ev({ type: 'gameWon', p: 'a', totals: { a: 1010, b: 400, c: 300 } }), viewAs('c')))
      .toBe('Ala won the game with 1010!');
  });
  it('other events are silent', () => {
    expect(explainEvent(ev({ type: 'cardPlayed', p: 'a', card: c('AH') }), viewAs('b'))).toBeNull();
    expect(explainEvent(ev({ type: 'passed', p: 'a' }), viewAs('b'))).toBeNull();
  });
});
