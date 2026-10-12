import { describe, it, expect } from 'vitest';
import type { GameEvent } from '../src/types';
import { explainEvent as explainRaw } from '../src/coach';
import type { PlayerView } from '../src/types';
import { english } from './english';
import { viewFor } from '../src/view';
import { scoreRound, scoreThrow, summarizeRound } from '../src/scoring';
import { c, scenario, SEATS4 } from './helpers';

const s = scenario({ phase: 'tricks', hands: { a: 'AH', b: '9H', c: '10H' } });
const viewAs = (p: string) => viewFor(s, p);
const s4 = scenario({ seats: SEATS4, phase: 'tricks', hands: { a: 'AH', b: '9H', c: '10H' } });
const ev = (e: Omit<GameEvent, 'audience'> & Record<string, unknown>): GameEvent => ({ ...e, audience: 'all' }) as unknown as GameEvent;

function summary(raws: { a: number; b: number; c: number }, bid: number, marriageA = 0) {
  const result = scoreRound({
    order: ['a', 'b', 'c'], bidder: 'a', bid, dealer: 'c', sittingOut: null,
    totals: { a: 0, b: 0, c: 0 }, trickPoints: raws, tricksTaken: { a: 3, b: 3, c: 2 },
    declaredMarriagePoints: { a: marriageA, b: 0, c: 0 }, talonBonus: 0,
  });
  return summarizeRound({ number: 1, dealer: 'c', bidder: 'a', bid, outcome: result.bidderMadeBid ? 'made' : 'failed', wykladana: false }, result);
}

/** explainEvent() rendered in English (as the app shows it). */
function explainEvent(e: GameEvent, view: PlayerView): string | null {
  const m = explainRaw(e, view);
  return m && english(m, view);
}

describe('explainEvent structure', () => {
  it('uses .you keys for the viewer and passes players as params', () => {
    expect(explainRaw(ev({ type: 'biddingWon', p: 'a', amount: 120, talonPublic: true }), viewAs('b')))
      .toEqual({ key: 'event.bidWon.public', params: { player: { player: 'a' }, amount: 120 } });
    expect(explainRaw(ev({ type: 'biddingWon', p: 'a', amount: 100, talonPublic: false }), viewAs('a')))
      .toEqual({ key: 'event.bidWon.private.you', params: { amount: 100 } });
    expect(explainRaw(ev({ type: 'biddingWon', p: 'a', amount: 100, talonPublic: false }), viewAs('b')))
      .toEqual({ key: 'event.bidWon.private', params: { player: { player: 'a' }, amount: 100 } });
  });
});

describe('explainEvent', () => {
  it('marriage', () => {
    expect(explainEvent(ev({ type: 'marriage', p: 'b', suit: 'hearts', points: 100 }), viewAs('a')))
      .toBe('Bartek declared the ♥ marriage: +100. ♥ are trumps now.');
  });
  it('trick won by a trump; ordinary tricks are silent', () => {
    const base = { type: 'trickWon', p: 'c', cards: [], card: c('9S'), points: 11 } as const;
    expect(explainEvent(ev({ ...base, byTrump: true }), viewAs('a'))).toBe('Celina won with 9♠. Trumps beat every other suit.');
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
  it('throw-ins list the real score changes', () => {
    const throwSummary = (bid: number, totals: Record<string, number>, four = false) => summarizeRound(
      { number: 1, dealer: four ? 'd' : 'c', bidder: 'a', bid, outcome: 'thrown', wykladana: false },
      scoreThrow({ order: four ? ['a', 'b', 'c', 'd'] : ['a', 'b', 'c'], dealer: four ? 'd' : 'c', bidder: 'a', bid,
        sittingOut: four ? 'd' : null, totals }));
    const free = throwSummary(100, { a: 0, b: 0, c: 0 });
    expect(explainEvent(ev({ type: 'threw', p: 'a', amount: 100, summary: free }), viewAs('b')))
      .toBe('Ala threw in at 100. Nobody scores, new deal.');
    const paid = throwSummary(130, { a: 0, b: 0, c: 0 });
    expect(explainEvent(ev({ type: 'threw', p: 'a', amount: 130, summary: paid }), viewAs('b')))
      .toBe('Ala threw in at 130: Ala −130, You +60, Celina +60.');
    const four = throwSummary(130, { a: 0, b: 850, c: 0, d: 0 }, true);
    expect(explainEvent(ev({ type: 'threw', p: 'a', amount: 130, summary: four }), viewFor(s4, 'c')))
      .toBe('Ala threw in at 130: Ala −130, Bartek 0, You +60, Darek 0.');
    // a thrown round scored through roundScored is not misprinted as a failed bid
    expect(explainEvent(ev({ type: 'roundScored', summary: paid }), viewAs('b')))
      .toBe('Ala threw in at 130: Ala −130, You +60, Celina +60.');
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
      .toBe("Ala bid 120 but scored only 117 → −120. Rounding doesn't help a bidder who falls short. You: +0.");
  });
  it('round scored: a defender on the barrel scores 0', () => {
    const result = scoreRound({
      order: ['a', 'b', 'c'], bidder: 'a', bid: 100, dealer: 'c', sittingOut: null,
      totals: { a: 0, b: 850, c: 0 }, trickPoints: { a: 100, b: 14, c: 6 }, tricksTaken: { a: 5, b: 2, c: 1 },
      declaredMarriagePoints: { a: 0, b: 0, c: 0 }, talonBonus: 0,
    });
    const sum = summarizeRound({ number: 1, dealer: 'c', bidder: 'a', bid: 100, outcome: 'made', wykladana: false }, result);
    expect(explainEvent(ev({ type: 'roundScored', summary: sum }), viewAs('b')))
      .toBe("Ala bid 100 and scored 100 → +100. You're on the barrel. Only winning a bid scores there.");
  });
  it('wykładana and game won', () => {
    expect(explainEvent(ev({ type: 'wykladana', p: 'a', hand: [], trump: null, marriages: [] }), viewAs('a')))
      .toBe('You have every trick guaranteed. Round won outright (wykładana)!');
    expect(explainEvent(ev({ type: 'wykladana', p: 'a', hand: [], trump: null, marriages: [] }), viewAs('b')))
      .toBe('Ala has every trick guaranteed. Round won outright (wykładana)!');
    expect(explainEvent(ev({ type: 'gameWon', p: 'a', totals: { a: 1010, b: 400, c: 300 } }), viewAs('c')))
      .toBe('Ala won the game with 1010!');
  });
  it('other events are silent', () => {
    expect(explainEvent(ev({ type: 'cardPlayed', p: 'a', card: c('AH') }), viewAs('b'))).toBeNull();
    expect(explainEvent(ev({ type: 'passed', p: 'a' }), viewAs('b'))).toBeNull();
  });
});
