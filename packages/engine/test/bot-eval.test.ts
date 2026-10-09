import { describe, it, expect } from 'vitest';
import { parseCards } from '../src/cards';
import {
  decideBid, decideHandout, decidePlayOrThrow, evaluateHandStrength, expectedBidPoints, handoutGiveScore,
  postTalonExpectedPoints,
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
    expect(evaluateHandStrength(WEAK7)).toBe(0);
  });
  it('bids the minimum with a good hand, passes with a weak one or above max', () => {
    expect(decideBid(STRONG7, 100, 0)).toEqual({ shouldBid: true, amount: 110 });
    expect(decideBid(WEAK7, 100, 0)).toEqual({ shouldBid: false });
    expect(decideBid(WEAK7, 120, 1)).toEqual({ shouldBid: false });
    expect(decideBid(STRONG7, 140, 0)).toEqual({ shouldBid: false }); // target 140 < 150
    expect(decideBid(STRONG7, 120, 1)).toEqual({ shouldBid: true, amount: 130 }); // 143*1.15 → 160
  });
});

describe('play or throw', () => {
  it('estimates the 10-card hand', () => {
    expect(postTalonExpectedPoints(STRONG10)).toBe(176);
    expect(postTalonExpectedPoints(WEAK10)).toBe(2);
  });
  it('at 100 plays with >= 80 expected, else throws', () => {
    expect(decidePlayOrThrow(STRONG10, 100, false)).toBe('play');
    expect(decidePlayOrThrow(WEAK10, 100, false)).toBe('throw');
  });
  it('above 100 needs 80/85/90% of the bid; always plays on the barrel', () => {
    expect(decidePlayOrThrow(STRONG10, 200, false)).toBe('throw'); // 176 < 180
    expect(decidePlayOrThrow(STRONG10, 190, false)).toBe('play'); // 176 >= 171
    expect(decidePlayOrThrow(STRONG10, 200, true)).toBe('play');
  });
});

describe('hand-out', () => {
  it('never gives away marriage cards and prefers short-suit nines', () => {
    expect(handoutGiveScore(c('KH'), STRONG10)).toBe(-100);
    expect(handoutGiveScore(c('9C'), STRONG10)).toBe(28);
    expect(handoutGiveScore(c('9D'), STRONG10)).toBe(20);
    expect(handoutGiveScore(c('JS'), STRONG10)).toBe(-12);
  });
  it('gives the better card to the opponent with the lower score', () => {
    const to = decideHandout(STRONG10, ['b', 'c'], { b: 100, c: 50 });
    expect(to).toEqual({ c: c('9C'), b: c('9D') });
    expect(Object.keys(to)).toEqual(['c', 'b']);
  });
});
