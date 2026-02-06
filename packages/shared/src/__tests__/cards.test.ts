import { describe, it, expect } from 'vitest';
import {
  createDeck, shuffleDeck, getCardPoints, getCardStrength, cardEquals,
  cardToString, parseCard, hasMarriage, countMarriagesInHand, getTotalMarriageValue,
  CARD_POINTS, MARRIAGE_VALUES, RANK_STRENGTH, SUITS, RANKS,
  type Card, type Suit
} from '../types/cards.js';

describe('createDeck', () => {
  it('returns 24 cards (6 ranks x 4 suits)', () => {
    const deck = createDeck();
    expect(deck).toHaveLength(24);
  });

  it('contains each suit exactly 6 times', () => {
    const deck = createDeck();
    for (const suit of SUITS) {
      const count = deck.filter(c => c.suit === suit).length;
      expect(count).toBe(6);
    }
  });

  it('contains each rank exactly 4 times', () => {
    const deck = createDeck();
    for (const rank of RANKS) {
      const count = deck.filter(c => c.rank === rank).length;
      expect(count).toBe(4);
    }
  });

  it('all cards are unique', () => {
    const deck = createDeck();
    const serialized = deck.map(c => `${c.suit}-${c.rank}`);
    const unique = new Set(serialized);
    expect(unique.size).toBe(deck.length);
  });
});

describe('shuffleDeck', () => {
  it('returns same length as input', () => {
    const deck = createDeck();
    const shuffled = shuffleDeck(deck);
    expect(shuffled).toHaveLength(deck.length);
  });

  it('contains same cards (just reordered)', () => {
    const deck = createDeck();
    const shuffled = shuffleDeck(deck);
    const sortFn = (a: Card, b: Card) =>
      `${a.suit}-${a.rank}`.localeCompare(`${b.suit}-${b.rank}`);
    const sortedOriginal = [...deck].sort(sortFn);
    const sortedShuffled = [...shuffled].sort(sortFn);
    expect(sortedShuffled).toEqual(sortedOriginal);
  });

  it('does not modify original deck', () => {
    const deck = createDeck();
    const originalCopy = deck.map(c => ({ ...c }));
    shuffleDeck(deck);
    expect(deck).toEqual(originalCopy);
  });
});

describe('getCardPoints', () => {
  it.each([
    ['9', 0],
    ['J', 2],
    ['Q', 3],
    ['K', 4],
    ['10', 10],
    ['A', 11],
  ] as const)('rank %s returns %d points', (rank, expected) => {
    const card: Card = { suit: 'hearts', rank };
    expect(getCardPoints(card)).toBe(expected);
  });
});

describe('getCardStrength', () => {
  it.each([
    ['9', 0],
    ['J', 1],
    ['Q', 2],
    ['K', 3],
    ['10', 4],
    ['A', 5],
  ] as const)('rank %s has strength %d', (rank, expected) => {
    const card: Card = { suit: 'hearts', rank };
    expect(getCardStrength(card)).toBe(expected);
  });
});

describe('cardEquals', () => {
  it('returns true for same card', () => {
    const a: Card = { suit: 'hearts', rank: 'A' };
    const b: Card = { suit: 'hearts', rank: 'A' };
    expect(cardEquals(a, b)).toBe(true);
  });

  it('returns false for different suit', () => {
    const a: Card = { suit: 'hearts', rank: 'A' };
    const b: Card = { suit: 'clubs', rank: 'A' };
    expect(cardEquals(a, b)).toBe(false);
  });

  it('returns false for different rank', () => {
    const a: Card = { suit: 'hearts', rank: 'A' };
    const b: Card = { suit: 'hearts', rank: 'K' };
    expect(cardEquals(a, b)).toBe(false);
  });
});

describe('cardToString', () => {
  it('converts ace of hearts to AH', () => {
    expect(cardToString({ suit: 'hearts', rank: 'A' })).toBe('AH');
  });

  it('converts 10 of clubs to 10C', () => {
    expect(cardToString({ suit: 'clubs', rank: '10' })).toBe('10C');
  });
});

describe('parseCard', () => {
  it('parses AH to ace of hearts', () => {
    expect(parseCard('AH')).toEqual({ suit: 'hearts', rank: 'A' });
  });

  it('parses 10C to 10 of clubs', () => {
    expect(parseCard('10C')).toEqual({ suit: 'clubs', rank: '10' });
  });

  it('returns null for invalid input', () => {
    expect(parseCard('invalid')).toBeNull();
  });
});

describe('hasMarriage', () => {
  it('returns true when hand has K and Q of the suit', () => {
    const hand: Card[] = [
      { suit: 'hearts', rank: 'Q' },
      { suit: 'hearts', rank: 'K' },
      { suit: 'clubs', rank: '9' },
    ];
    expect(hasMarriage(hand, 'hearts')).toBe(true);
  });

  it('returns false when hand has only K of the suit', () => {
    const hand: Card[] = [
      { suit: 'hearts', rank: 'K' },
      { suit: 'clubs', rank: '9' },
    ];
    expect(hasMarriage(hand, 'hearts')).toBe(false);
  });

  it('returns false when hand has only Q of the suit', () => {
    const hand: Card[] = [
      { suit: 'hearts', rank: 'Q' },
      { suit: 'clubs', rank: '9' },
    ];
    expect(hasMarriage(hand, 'hearts')).toBe(false);
  });
});

describe('countMarriagesInHand', () => {
  it('returns both marriages when hand has 2', () => {
    const hand: Card[] = [
      { suit: 'hearts', rank: 'Q' },
      { suit: 'hearts', rank: 'K' },
      { suit: 'clubs', rank: 'Q' },
      { suit: 'clubs', rank: 'K' },
      { suit: 'spades', rank: '9' },
    ];
    const marriages = countMarriagesInHand(hand);
    expect(marriages).toHaveLength(2);
    expect(marriages).toContainEqual({ suit: 'hearts', value: 100 });
    expect(marriages).toContainEqual({ suit: 'clubs', value: 60 });
  });

  it('returns empty array when hand has no marriages', () => {
    const hand: Card[] = [
      { suit: 'hearts', rank: 'Q' },
      { suit: 'clubs', rank: 'K' },
      { suit: 'spades', rank: '9' },
    ];
    const marriages = countMarriagesInHand(hand);
    expect(marriages).toEqual([]);
  });
});

describe('getTotalMarriageValue', () => {
  it('returns 160 for hearts marriage (100) + clubs marriage (60)', () => {
    const hand: Card[] = [
      { suit: 'hearts', rank: 'Q' },
      { suit: 'hearts', rank: 'K' },
      { suit: 'clubs', rank: 'Q' },
      { suit: 'clubs', rank: 'K' },
    ];
    expect(getTotalMarriageValue(hand)).toBe(160);
  });
});

describe('constants', () => {
  it('SUITS has 4 entries', () => {
    expect(SUITS).toHaveLength(4);
  });

  it('RANKS has 6 entries', () => {
    expect(RANKS).toHaveLength(6);
  });

  it('MARRIAGE_VALUES are correct for each suit', () => {
    expect(MARRIAGE_VALUES.hearts).toBe(100);
    expect(MARRIAGE_VALUES.diamonds).toBe(80);
    expect(MARRIAGE_VALUES.clubs).toBe(60);
    expect(MARRIAGE_VALUES.spades).toBe(40);
  });
});
