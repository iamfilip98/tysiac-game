import { describe, it, expect } from 'vitest';
import { RULES, SUITS, RANKS } from '../src/rules';
import {
  createDeck, cardEquals, cardKey, parseCard, parseCards, cardLabel, cardPoints, handPoints,
  hasMarriage, marriagesInHand, totalMarriageValue, removeCard, isCard,
} from '../src/cards';

describe('cards', () => {
  it('builds a 24-card deck of unique cards', () => {
    const deck = createDeck();
    expect(deck).toHaveLength(24);
    expect(new Set(deck.map(cardKey)).size).toBe(24);
  });

  it('deck is worth exactly 120 points', () => {
    expect(handPoints(createDeck())).toBe(RULES.pointsPerRound);
    expect(RULES.pointsPerRound).toBe(120);
  });

  it('card points follow A11 10:10 K4 Q3 J2 9:0', () => {
    expect(parseCards('AS 10S KS QS JS 9S').map(cardPoints)).toEqual([11, 10, 4, 3, 2, 0]);
  });

  it('rank strength is A > 10 > K > Q > J > 9', () => {
    const order = [...RANKS].sort((a, b) => RULES.rankStrength[b] - RULES.rankStrength[a]);
    expect(order).toEqual(['A', '10', 'K', 'Q', 'J', '9']);
  });

  it('marriage values are ♥100 ♦80 ♣60 ♠40', () => {
    expect(RULES.marriageValues).toEqual({ hearts: 100, diamonds: 80, clubs: 60, spades: 40 });
    expect(SUITS).toHaveLength(4);
  });

  it('parses and labels cards', () => {
    expect(parseCard('10D')).toEqual({ rank: '10', suit: 'diamonds' });
    expect(parseCard('qh')).toEqual({ rank: 'Q', suit: 'hearts' });
    expect(parseCards('')).toEqual([]);
    expect(() => parseCard('XX')).toThrow();
    expect(cardLabel(parseCard('KD'))).toBe('K♦');
    expect(cardLabel(parseCard('10C'))).toBe('10♣');
    expect(cardKey(parseCard('9S'))).toBe('9S');
  });

  it('finds marriages in ♥♦♣♠ order and totals them', () => {
    const hand = parseCards('KS QS KH QH 9C');
    expect(hasMarriage(hand, 'hearts')).toBe(true);
    expect(hasMarriage(hand, 'clubs')).toBe(false);
    expect(marriagesInHand(hand)).toEqual(['hearts', 'spades']);
    expect(totalMarriageValue(hand)).toBe(140);
  });

  it('removeCard returns a new array without the card and throws when missing', () => {
    const hand = parseCards('AH 9S');
    const rest = removeCard(hand, parseCard('AH'));
    expect(rest).toEqual(parseCards('9S'));
    expect(hand).toHaveLength(2);
    expect(() => removeCard(hand, parseCard('KD'))).toThrow();
  });

  it('cardEquals and isCard', () => {
    expect(cardEquals(parseCard('AH'), { suit: 'hearts', rank: 'A' })).toBe(true);
    expect(isCard({ suit: 'hearts', rank: 'A' })).toBe(true);
    expect(isCard({ suit: 'hearts', rank: '7' })).toBe(false);
    expect(isCard(null)).toBe(false);
    expect(isCard('AH')).toBe(false);
  });
});
