import { describe, it, expect } from 'vitest';
import { parseCards } from '../src/cards';
import {
  decideBid, decideHandout, decidePlayOrThrow, expectedBidPoints, handoutGiveScore, postTalonExpectedPoints,
} from '../src/bot/eval';
import { c } from './helpers';

const STRONG7 = parseCards('KH QH AH 10H AS 9C 9D');
const WEAK7 = parseCards('9H JH 9S JS 9C JC 9D');
const STRONG10 = parseCards('AH 10H KH QH AS 10S AD 9C 9D JS');
const WEAK10 = parseCards('9H JH 9S JS 9C JC 9D JD QH QS');

describe('bidding heuristics', () => {
  it('estimates points like the original AI', () => {
    // 100 marriage + 22 aces + 9 (10♥ with A♥) + 2 (K♥) + 10 talon = 143
    expect(expectedBidPoints(STRONG7)).toBe(143);
    expect(expectedBidPoints(WEAK7)).toBe(10);
  });
  it('bids the minimum while the floored estimate is at least next − 10; the reason carries that estimate', () => {
    expect(decideBid(STRONG7, 100, 0)).toEqual({
      action: { type: 'bid', amount: 110 },
      reason: { code: 'bid.worth', next: 110, worth: 140, boosted: false },
    });
    expect(decideBid(STRONG7, 140, 0)).toEqual({
      action: { type: 'bid', amount: 150 },
      reason: { code: 'bid.close', next: 150, worth: 140, boosted: false },
    });
    expect(decideBid(STRONG7, 150, 0)).toEqual({
      action: { type: 'pass' },
      reason: { code: 'pass.worth', next: 160, worth: 140, boosted: false },
    });
    // 143 × 1.15 = 164 → 160 after someone passed
    expect(decideBid(STRONG7, 160, 1)).toEqual({
      action: { type: 'bid', amount: 170 },
      reason: { code: 'bid.close', next: 170, worth: 160, boosted: true },
    });
  });
  it('passes with a weak hand or above max', () => {
    expect(decideBid(WEAK7, 100, 0).reason).toEqual({ code: 'pass.worth', next: 110, worth: 10, boosted: false });
    expect(decideBid(WEAK7, 120, 1)).toEqual({ action: { type: 'pass' }, reason: { code: 'pass.overMax', next: 130, max: 120 } });
  });
  it('D1: no "hand strength" override — a hand worth 80 passes at 110 instead of bidding', () => {
    const hand = parseCards('KS QS AH 10H AC 9D 9C'); // 40 marriage + 11 + 9 + 11 + 2 (K) + 10 talon = 83
    expect(decideBid(hand, 100, 0)).toEqual({
      action: { type: 'pass' },
      reason: { code: 'pass.worth', next: 110, worth: 80, boosted: false },
    });
  });
});

describe('play or throw', () => {
  it('estimates the 10-card hand', () => {
    expect(postTalonExpectedPoints(STRONG10)).toBe(176);
    expect(postTalonExpectedPoints(WEAK10)).toBe(2);
  });
  it('at 100 plays with >= 80 expected, else throws for free', () => {
    expect(decidePlayOrThrow(STRONG10, 100)).toEqual({ action: { type: 'play' }, reason: { code: 'play.enough', est: 170, bid: 100 } });
    expect(decidePlayOrThrow(WEAK10, 100)).toEqual({ action: { type: 'throw' }, reason: { code: 'throw.free', est: 0, bid: 100 } });
    const close = parseCards('AH 10H KS QS AD 9D JC 9C QC 9S'); // estimate 86
    expect(decidePlayOrThrow(close, 100)).toEqual({ action: { type: 'play' }, reason: { code: 'play.close', est: 80, bid: 100 } });
  });
  it('D5: above 100 it never throws — a throw costs the bid anyway and pays each opponent 60', () => {
    expect(decidePlayOrThrow(STRONG10, 200)).toEqual({
      action: { type: 'play' },
      reason: { code: 'play.noThrow', est: 170, bid: 200, share: 60 },
    });
    expect(decidePlayOrThrow(STRONG10, 170)).toEqual({ action: { type: 'play' }, reason: { code: 'play.enough', est: 170, bid: 170 } });
    expect(decidePlayOrThrow(WEAK10, 110).action).toEqual({ type: 'play' });
  });
});

describe('hand-out', () => {
  it('never gives away marriage cards and prefers short-suit nines', () => {
    expect(handoutGiveScore(c('KH'), STRONG10)).toBe(-100);
    expect(handoutGiveScore(c('9C'), STRONG10)).toBe(28);
    expect(handoutGiveScore(c('9D'), STRONG10)).toBe(20);
    expect(handoutGiveScore(c('JS'), STRONG10)).toBe(-12);
  });
  it("penalises a lone K/Q (it can complete an opponent's marriage) and any 10 or A", () => {
    const hand = parseCards('AH 10H KH QH AS 10S QD JC 9C KC');
    expect(handoutGiveScore(c('QD'), hand)).toBe(20 - 10 - 3 - 25);
    expect(handoutGiveScore(c('10S'), hand)).toBe(12 - 28 - 10 - 25);
  });
  it('gives the better card to the opponent with the lower score, and says why each card goes', () => {
    expect(decideHandout(STRONG10, ['b', 'c'], { b: 100, c: 50 })).toEqual({
      action: { type: 'handout', to: { c: c('9C'), b: c('9D') } },
      reason: {
        code: 'handout',
        gives: [{ to: 'c', card: c('9C'), why: 'void' }, { to: 'b', card: c('9D'), why: 'zero' }],
        betterTo: 'c',
      },
    });
  });
  it('D11: never hands out a lone K or Q', () => {
    for (const text of ['AH 10H KH QH AS 10S QD JC 9C KC', 'AH 10H KH QH 9H AS QS QD KC 9D']) {
      const { action } = decideHandout(parseCards(text), ['b', 'c'], { b: 0, c: 0 });
      const given = action.type === 'handout' ? Object.values(action.to) : [];
      expect(given).toHaveLength(2);
      for (const card of given) expect(['K', 'Q', '10', 'A']).not.toContain(card.rank);
    }
  });
  it('D12: with one card already given, recommends the best remaining card for the other opponent', () => {
    const first = decideHandout(STRONG10, ['b', 'c'], { b: 100, c: 50 }, { c: c('9C') });
    expect(first.action).toEqual({ type: 'handout', to: { c: c('9C'), b: c('9D') } });
    expect(first.reason).toEqual({ code: 'handout', gives: [{ to: 'b', card: c('9D'), why: 'zero' }], betterTo: null });
    // A different card went to b: the coach adapts and gives c the best card that is left.
    const other = decideHandout(STRONG10, ['b', 'c'], { b: 100, c: 50 }, { b: c('9C') });
    expect(other.action).toEqual({ type: 'handout', to: { b: c('9C'), c: c('9D') } });
  });
});
